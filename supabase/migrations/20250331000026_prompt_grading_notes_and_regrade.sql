-- Grading notes for seeker feedback emails; allow re-grading with earnings adjustments.

ALTER TABLE public.prompt_submissions
  ADD COLUMN IF NOT EXISTS grading_note text;

COMMENT ON COLUMN public.prompt_submissions.grading_note IS
  'Admin feedback emailed to the seeker when the submission is graded or re-graded.';

DROP FUNCTION IF EXISTS public.grade_prompt_submission(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.grade_prompt_submission(
  p_submission_id uuid,
  p_grade text,
  p_graded_by uuid,
  p_grading_note text DEFAULT NULL
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
  v_previous_grade text;
  v_net_credited numeric(14, 2);
  v_has_reward_credit boolean;
  v_adjustment numeric(14, 2);
  v_trimmed_note text;
BEGIN
  v_trimmed_note := NULLIF(trim(p_grading_note), '');

  SELECT * INTO v_sub
  FROM public.prompt_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF p_grade NOT IN ('pass', 'fail') THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_grade');
  END IF;

  v_previous_grade := v_sub.grade_status;

  IF v_previous_grade = p_grade THEN
    UPDATE public.prompt_submissions
    SET
      grading_note = v_trimmed_note,
      graded_at = now(),
      graded_by = p_graded_by
    WHERE id = p_submission_id;

    RETURN json_build_object(
      'ok', true,
      'grade_changed', false,
      'previous_grade', v_previous_grade,
      'new_grade', p_grade,
      'earnings_adjustment_kes', 0
    );
  END IF;

  SELECT * INTO v_prompt FROM public.prompts WHERE id = v_sub.prompt_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'prompt_not_found');
  END IF;

  v_series_id := v_prompt.series_id;
  v_reward := COALESCE(v_prompt.reward_kes, 0);

  SELECT COALESCE(SUM(amount_kes), 0)
  INTO v_net_credited
  FROM public.earnings_ledger
  WHERE reference_type = 'prompt_submission'
    AND reference_id = p_submission_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.earnings_ledger
    WHERE reference_type = 'prompt_submission'
      AND reference_id = p_submission_id
      AND entry_type = 'reward_credit'
  )
  INTO v_has_reward_credit;

  v_adjustment := 0;

  IF p_grade = 'fail' THEN
    IF v_net_credited > 0 THEN
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
        -v_net_credited,
        'reversal',
        'prompt_submission',
        p_submission_id,
        jsonb_build_object(
          'graded_by', p_graded_by::text,
          'submission_id', p_submission_id::text,
          'series_id', v_series_id::text,
          'reason', 'grade_changed_to_fail',
          'previous_grade', v_previous_grade
        )
      );
      v_adjustment := -v_net_credited;
    END IF;

    UPDATE public.prompt_submissions
    SET
      grade_status = 'fail',
      graded_at = now(),
      graded_by = p_graded_by,
      grading_note = v_trimmed_note
    WHERE id = p_submission_id;

    RETURN json_build_object(
      'ok', true,
      'grade_changed', true,
      'previous_grade', v_previous_grade,
      'new_grade', 'fail',
      'earnings_adjustment_kes', v_adjustment
    );
  END IF;

  -- pass
  IF v_reward > v_net_credited THEN
    v_adjustment := v_reward - v_net_credited;

    IF NOT v_has_reward_credit THEN
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
          v_adjustment,
          'reward_credit',
          'prompt_submission',
          p_submission_id,
          jsonb_build_object(
            'graded_by', p_graded_by::text,
            'submission_id', p_submission_id::text,
            'series_id', v_series_id::text,
            'previous_grade', v_previous_grade
          )
        );
      EXCEPTION
        WHEN unique_violation THEN
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
            v_adjustment,
            'adjustment',
            'prompt_submission',
            p_submission_id,
            jsonb_build_object(
              'graded_by', p_graded_by::text,
              'submission_id', p_submission_id::text,
              'series_id', v_series_id::text,
              'reason', 'regrade_pass_credit',
              'previous_grade', v_previous_grade
            )
          );
      END;
    ELSE
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
        v_adjustment,
        'adjustment',
        'prompt_submission',
        p_submission_id,
        jsonb_build_object(
          'graded_by', p_graded_by::text,
          'submission_id', p_submission_id::text,
          'series_id', v_series_id::text,
          'reason', 'regrade_pass_credit',
          'previous_grade', v_previous_grade
        )
      );
    END IF;
  END IF;

  UPDATE public.prompt_submissions
  SET
    grade_status = 'pass',
    graded_at = now(),
    graded_by = p_graded_by,
    grading_note = v_trimmed_note
  WHERE id = p_submission_id;

  RETURN json_build_object(
    'ok', true,
    'grade_changed', true,
    'previous_grade', v_previous_grade,
    'new_grade', 'pass',
    'earnings_adjustment_kes', v_adjustment,
    'duplicate_reward', v_adjustment = 0 AND v_previous_grade = 'pass'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.grade_prompt_submission(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_prompt_submission(uuid, text, uuid, text) TO service_role;
