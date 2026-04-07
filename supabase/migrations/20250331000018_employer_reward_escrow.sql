-- Employer-funded prompt rewards: per-series escrow + employer KES balance.
-- Server-only mutations via RPCs (triggers block direct client changes).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employer_kes_balance numeric(14, 2) NOT NULL DEFAULT 0
  CHECK (employer_kes_balance >= 0);

ALTER TABLE public.prompt_series
  ADD COLUMN IF NOT EXISTS reward_escrow_kes numeric(14, 2) NOT NULL DEFAULT 0
  CHECK (reward_escrow_kes >= 0);

COMMENT ON COLUMN public.profiles.employer_kes_balance IS
  'KES available for employers to move into prompt-series reward escrow (server-managed).';
COMMENT ON COLUMN public.prompt_series.reward_escrow_kes IS
  'KES reserved for this series; decremented when admin grades a submission pass.';

-- Block authenticated users from changing server-managed money columns (service_role bypasses RLS only; triggers still run).
CREATE OR REPLACE FUNCTION public._guard_employer_kes_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employer_kes_balance IS DISTINCT FROM OLD.employer_kes_balance THEN
    IF current_setting('app.allow_employer_kes_mutate', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'employer_kes_balance is server-managed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._guard_prompt_series_escrow()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.reward_escrow_kes IS DISTINCT FROM OLD.reward_escrow_kes THEN
    IF current_setting('app.allow_series_escrow_mutate', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'reward_escrow_kes is server-managed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_employer_kes ON public.profiles;
CREATE TRIGGER trg_profiles_guard_employer_kes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public._guard_employer_kes_balance();

DROP TRIGGER IF EXISTS trg_prompt_series_guard_escrow ON public.prompt_series;
CREATE TRIGGER trg_prompt_series_guard_escrow
  BEFORE UPDATE ON public.prompt_series
  FOR EACH ROW
  EXECUTE PROCEDURE public._guard_prompt_series_escrow();

-- Atomic grade: escrow check, ledger insert (idempotent), escrow debit, submission update.
CREATE OR REPLACE FUNCTION public.grade_prompt_submission(
  p_submission_id uuid,
  p_grade text,
  p_graded_by uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.prompt_submissions%ROWTYPE;
  v_prompt public.prompts%ROWTYPE;
  v_series_id uuid;
  v_escrow numeric(14, 2);
  v_reward numeric(14, 2);
BEGIN
  SELECT * INTO v_sub
  FROM public.prompt_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_sub.grade_status IS DISTINCT FROM 'pending' THEN
    RETURN json_build_object('ok', false, 'error', 'already_graded');
  END IF;

  IF p_grade NOT IN ('pass', 'fail') THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_grade');
  END IF;

  SELECT * INTO v_prompt FROM public.prompts WHERE id = v_sub.prompt_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'prompt_not_found');
  END IF;

  v_series_id := v_prompt.series_id;
  v_reward := COALESCE(v_prompt.reward_kes, 0);

  IF p_grade = 'fail' THEN
    UPDATE public.prompt_submissions
    SET
      grade_status = 'fail',
      graded_at = now(),
      graded_by = p_graded_by
    WHERE id = p_submission_id;
    RETURN json_build_object('ok', true);
  END IF;

  -- pass
  IF v_reward > 0 THEN
    SELECT reward_escrow_kes INTO v_escrow
    FROM public.prompt_series
    WHERE id = v_series_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'series_not_found');
    END IF;

    IF v_escrow < v_reward THEN
      RETURN json_build_object(
        'ok', false,
        'error', 'insufficient_escrow',
        'needed', v_reward,
        'available', v_escrow
      );
    END IF;

    BEGIN
      INSERT INTO public.earnings_ledger (
        user_id,
        amount_kes,
        entry_type,
        reference_type,
        reference_id,
        metadata
      )
      VALUES (
        v_sub.user_id,
        v_reward,
        'reward_credit',
        'prompt_submission',
        p_submission_id,
        jsonb_build_object(
          'graded_by', p_graded_by::text,
          'submission_id', p_submission_id::text,
          'series_id', v_series_id::text,
          'funded_by', 'employer_escrow'
        )
      );
    EXCEPTION
      WHEN unique_violation THEN
        UPDATE public.prompt_submissions
        SET
          grade_status = 'pass',
          graded_at = now(),
          graded_by = p_graded_by
        WHERE id = p_submission_id AND grade_status = 'pending';
        RETURN json_build_object('ok', true, 'duplicate_reward', true);
    END;

    PERFORM set_config('app.allow_series_escrow_mutate', '1', true);
    UPDATE public.prompt_series
    SET
      reward_escrow_kes = reward_escrow_kes - v_reward,
      updated_at = now()
    WHERE id = v_series_id;
    PERFORM set_config('app.allow_series_escrow_mutate', '', true);
  END IF;

  UPDATE public.prompt_submissions
  SET
    grade_status = 'pass',
    graded_at = now(),
    graded_by = p_graded_by
  WHERE id = p_submission_id;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.grade_prompt_submission(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_prompt_submission(uuid, text, uuid) TO service_role;

-- Move KES from employer profile balance into a series escrow (same employer).
CREATE OR REPLACE FUNCTION public.employer_fund_series_escrow(
  p_series_id uuid,
  p_employer_id uuid,
  p_amount_kes numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_bal numeric(14, 2);
BEGIN
  IF p_amount_kes IS NULL OR p_amount_kes <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  SELECT created_by INTO v_owner FROM public.prompt_series WHERE id = p_series_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'series_not_found');
  END IF;
  IF v_owner IS DISTINCT FROM p_employer_id THEN
    RETURN json_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT employer_kes_balance INTO v_bal FROM public.profiles WHERE id = p_employer_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'profile_not_found');
  END IF;
  IF v_bal < p_amount_kes THEN
    RETURN json_build_object('ok', false, 'error', 'insufficient_balance', 'available', v_bal);
  END IF;

  PERFORM set_config('app.allow_employer_kes_mutate', '1', true);
  UPDATE public.profiles
  SET employer_kes_balance = employer_kes_balance - p_amount_kes
  WHERE id = p_employer_id;
  PERFORM set_config('app.allow_employer_kes_mutate', '', true);

  PERFORM set_config('app.allow_series_escrow_mutate', '1', true);
  UPDATE public.prompt_series
  SET
    reward_escrow_kes = reward_escrow_kes + p_amount_kes,
    updated_at = now()
  WHERE id = p_series_id;
  PERFORM set_config('app.allow_series_escrow_mutate', '', true);

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.employer_fund_series_escrow(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employer_fund_series_escrow(uuid, uuid, numeric) TO service_role;

-- Admin credits an employer KES balance (e.g. after bank / M-Pesa receipt).
CREATE OR REPLACE FUNCTION public.admin_credit_employer_kes(
  p_employer_id uuid,
  p_amount_kes numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_amount_kes IS NULL OR p_amount_kes <= 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_employer_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'profile_not_found');
  END IF;
  IF v_role IS DISTINCT FROM 'employer' THEN
    RETURN json_build_object('ok', false, 'error', 'not_employer');
  END IF;

  PERFORM set_config('app.allow_employer_kes_mutate', '1', true);
  UPDATE public.profiles
  SET employer_kes_balance = employer_kes_balance + p_amount_kes
  WHERE id = p_employer_id;
  PERFORM set_config('app.allow_employer_kes_mutate', '', true);

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_credit_employer_kes(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_credit_employer_kes(uuid, numeric) TO service_role;
