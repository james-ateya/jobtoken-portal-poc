-- After the 2x hybrid reward adjustment (migration 33), passed submissions still
-- have earnings_ledger credits based on the OLD (higher) reward amounts.
-- This inserts negative 'adjustment' entries to bring each seeker's net credited
-- amount in line with the new (reduced) reward_kes on the prompt.

INSERT INTO public.earnings_ledger (
  user_id,
  amount_kes,
  entry_type,
  reference_type,
  reference_id,
  metadata
)
SELECT
  sub.user_id,
  -(net.net_credited - p.reward_kes),
  'adjustment',
  'prompt_submission',
  sub.id,
  jsonb_build_object(
    'reason', 'reward_reduction_2x_adjustment',
    'old_credited', net.net_credited,
    'new_reward', p.reward_kes,
    'submission_id', sub.id::text,
    'prompt_id', sub.prompt_id::text
  )
FROM public.prompt_submissions sub
JOIN public.prompts p ON p.id = sub.prompt_id
JOIN (
  SELECT reference_id, SUM(amount_kes) AS net_credited
  FROM public.earnings_ledger
  WHERE reference_type = 'prompt_submission'
  GROUP BY reference_id
) net ON net.reference_id = sub.id
WHERE sub.grade_status = 'pass'
  AND net.net_credited > p.reward_kes;
