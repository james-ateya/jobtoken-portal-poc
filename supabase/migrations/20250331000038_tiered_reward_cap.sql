-- Tiered reward cap (KES/token = 20):
--   Starter (≤6 tokens):  margin 20%, pass rate 45% → max = C * 20 * 0.80 / 0.45
--   Core    (7–20):       margin 30%, pass rate 50% → max = C * 20 * 0.70 / 0.50
--   Premium (>20):        margin 40%, pass rate 50% → max = C * 20 * 0.60 / 0.50

CREATE OR REPLACE FUNCTION public.check_reward_cap()
RETURNS trigger AS $$
DECLARE
  kes_per_token numeric := 20;
  margin numeric;
  pass_rate numeric;
  max_reward numeric;
BEGIN
  IF NEW.submit_cost_tokens <= 6 THEN
    margin := 0.20;
    pass_rate := 0.45;
  ELSIF NEW.submit_cost_tokens <= 20 THEN
    margin := 0.30;
    pass_rate := 0.50;
  ELSE
    margin := 0.40;
    pass_rate := 0.50;
  END IF;

  max_reward := (NEW.submit_cost_tokens * kes_per_token * (1 - margin)) / pass_rate;
  IF NEW.reward_kes > max_reward THEN
    RAISE EXCEPTION 'Reward KES (%) exceeds the safe maximum (%) for % token(s). Reduce the reward or increase the submit cost.',
      NEW.reward_kes, ROUND(max_reward, 2), NEW.submit_cost_tokens;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Raise Starter/Core rewards up to the new tier max where currently below it.
-- Does not change Premium rewards.
UPDATE public.prompts
SET reward_kes = CASE
  WHEN submit_cost_tokens <= 6 THEN
    (submit_cost_tokens * 20 * 0.80) / 0.45
  ELSE
    (submit_cost_tokens * 20 * 0.70) / 0.50
END
WHERE submit_cost_tokens <= 20
  AND reward_kes < CASE
    WHEN submit_cost_tokens <= 6 THEN
      (submit_cost_tokens * 20 * 0.80) / 0.45
    ELSE
      (submit_cost_tokens * 20 * 0.70) / 0.50
  END;
