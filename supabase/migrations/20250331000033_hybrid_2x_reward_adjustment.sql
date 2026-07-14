-- Hybrid 2x adjustment: double submit_cost_tokens, cap reward_kes at the new safe maximum.
-- Formula: max_reward = (submit_cost_tokens * 20 * 0.60) / 0.50
-- Both columns update in a single statement so the reward_cap trigger passes.

UPDATE public.prompts
SET
  submit_cost_tokens = submit_cost_tokens * 2,
  reward_kes = LEAST(
    reward_kes,
    (submit_cost_tokens * 2 * 20 * 0.60) / 0.50
  );
