-- Stop tracking per-series / employer KES escrow. Pass grades credit seeker earnings without balance checks.

DROP TRIGGER IF EXISTS trg_profiles_guard_employer_kes ON public.profiles;
DROP TRIGGER IF EXISTS trg_prompt_series_guard_escrow ON public.prompt_series;

DROP FUNCTION IF EXISTS public.employer_fund_series_escrow(uuid, uuid, numeric);
DROP FUNCTION IF EXISTS public.admin_credit_employer_kes(uuid, numeric);

DROP FUNCTION IF EXISTS public._guard_employer_kes_balance();
DROP FUNCTION IF EXISTS public._guard_prompt_series_escrow();

ALTER TABLE public.profiles DROP COLUMN IF EXISTS employer_kes_balance;
ALTER TABLE public.prompt_series DROP COLUMN IF EXISTS reward_escrow_kes;

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

  IF v_reward > 0 THEN
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
          'series_id', v_series_id::text
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
