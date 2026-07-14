-- Enforce reward cap: reward_kes <= (submit_cost_tokens * 20 * 0.60) / 0.50
-- Uses fixed constants so the DB constraint is always the safety net regardless of env config.

CREATE OR REPLACE FUNCTION public.check_reward_cap()
RETURNS trigger AS $$
DECLARE
  kes_per_token numeric := 20;
  margin numeric := 0.40;
  pass_rate numeric := 0.50;
  max_reward numeric;
BEGIN
  max_reward := (NEW.submit_cost_tokens * kes_per_token * (1 - margin)) / pass_rate;
  IF NEW.reward_kes > max_reward THEN
    RAISE EXCEPTION 'Reward KES (%) exceeds the safe maximum (%) for % token(s). Reduce the reward or increase the submit cost.',
      NEW.reward_kes, ROUND(max_reward, 2), NEW.submit_cost_tokens;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prompts_reward_cap ON public.prompts;
CREATE TRIGGER trg_prompts_reward_cap
  BEFORE INSERT OR UPDATE ON public.prompts
  FOR EACH ROW EXECUTE FUNCTION public.check_reward_cap();
