-- =============================================================================
-- Adjust prompt rewards to tiered token:reward ratios
-- Run in Supabase SQL Editor (or psql).
--
-- KES per token = 20
--   Starter (≤6 tokens):  margin 20%, pass 45% → max_reward = C * 20 * 0.80 / 0.45 ≈ C × 35.56
--   Core    (7–20):       margin 30%, pass 50% → max_reward = C * 20 * 0.70 / 0.50 = C × 28
--   Premium (>20):        margin 40%, pass 50% → max_reward = C * 20 * 0.60 / 0.50 = C × 24
--
-- Strategy:
--   • Starter & Core: raise reward_kes UP to the tier max (student attractiveness)
--   • Premium: cap reward_kes DOWN if above the tier max (protect margin)
--   • submit_cost_tokens are left unchanged (ratio is fixed via reward)
-- =============================================================================

-- 1) Ensure DB trigger uses tiered formula (safe to re-run)
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

-- 2) PREVIEW — review before applying (run this first)
SELECT
  p.id,
  p.headline,
  p.submit_cost_tokens AS tokens,
  CASE
    WHEN p.submit_cost_tokens <= 6 THEN 'starter'
    WHEN p.submit_cost_tokens <= 20 THEN 'core'
    ELSE 'premium'
  END AS tier,
  ROUND(p.reward_kes::numeric, 2) AS reward_now,
  ROUND(
    CASE
      WHEN p.submit_cost_tokens <= 6 THEN (p.submit_cost_tokens * 20 * 0.80) / 0.45
      WHEN p.submit_cost_tokens <= 20 THEN (p.submit_cost_tokens * 20 * 0.70) / 0.50
      ELSE (p.submit_cost_tokens * 20 * 0.60) / 0.50
    END
  , 2) AS reward_target,
  ROUND(
    CASE
      WHEN p.submit_cost_tokens <= 6 THEN (p.submit_cost_tokens * 20 * 0.80) / 0.45
      WHEN p.submit_cost_tokens <= 20 THEN (p.submit_cost_tokens * 20 * 0.70) / 0.50
      ELSE (p.submit_cost_tokens * 20 * 0.60) / 0.50
    END - p.reward_kes
  , 2) AS delta_kes,
  p.submit_cost_tokens * 20 AS attempt_cost_kes,
  ps.title AS series_title,
  p.is_published
FROM public.prompts p
LEFT JOIN public.prompt_series ps ON ps.id = p.series_id
WHERE ROUND(p.reward_kes::numeric, 2) <> ROUND(
  CASE
    WHEN p.submit_cost_tokens <= 6 THEN (p.submit_cost_tokens * 20 * 0.80) / 0.45
    WHEN p.submit_cost_tokens <= 20 THEN (p.submit_cost_tokens * 20 * 0.70) / 0.50
    ELSE (p.submit_cost_tokens * 20 * 0.60) / 0.50
  END
, 2)
ORDER BY
  CASE
    WHEN p.submit_cost_tokens <= 6 THEN 0
    WHEN p.submit_cost_tokens <= 20 THEN 1
    ELSE 2
  END,
  p.submit_cost_tokens,
  p.headline;

-- Summary by tier
SELECT
  CASE
    WHEN submit_cost_tokens <= 6 THEN 'starter'
    WHEN submit_cost_tokens <= 20 THEN 'core'
    ELSE 'premium'
  END AS tier,
  COUNT(*) AS prompts,
  COUNT(*) FILTER (
    WHERE ROUND(reward_kes::numeric, 2) <> ROUND(
      CASE
        WHEN submit_cost_tokens <= 6 THEN (submit_cost_tokens * 20 * 0.80) / 0.45
        WHEN submit_cost_tokens <= 20 THEN (submit_cost_tokens * 20 * 0.70) / 0.50
        ELSE (submit_cost_tokens * 20 * 0.60) / 0.50
      END
    , 2)
  ) AS needing_change,
  ROUND(AVG(reward_kes)::numeric, 1) AS avg_reward_now,
  ROUND(AVG(
    CASE
      WHEN submit_cost_tokens <= 6 THEN (submit_cost_tokens * 20 * 0.80) / 0.45
      WHEN submit_cost_tokens <= 20 THEN (submit_cost_tokens * 20 * 0.70) / 0.50
      ELSE (submit_cost_tokens * 20 * 0.60) / 0.50
    END
  )::numeric, 1) AS avg_reward_target
FROM public.prompts
GROUP BY 1
ORDER BY 1;

-- =============================================================================
-- 3) APPLY — set every prompt reward to its tier target (rounded to 2 decimals)
-- Uncomment the block below after you are happy with the preview.
-- =============================================================================

/*
BEGIN;

UPDATE public.prompts
SET
  reward_kes = ROUND(
    CASE
      WHEN submit_cost_tokens <= 6 THEN (submit_cost_tokens * 20 * 0.80) / 0.45
      WHEN submit_cost_tokens <= 20 THEN (submit_cost_tokens * 20 * 0.70) / 0.50
      ELSE (submit_cost_tokens * 20 * 0.60) / 0.50
    END
  , 2),
  updated_at = NOW()
WHERE ROUND(reward_kes::numeric, 2) <> ROUND(
  CASE
    WHEN submit_cost_tokens <= 6 THEN (submit_cost_tokens * 20 * 0.80) / 0.45
    WHEN submit_cost_tokens <= 20 THEN (submit_cost_tokens * 20 * 0.70) / 0.50
    ELSE (submit_cost_tokens * 20 * 0.60) / 0.50
  END
, 2);

-- Sanity check: nothing should violate the cap after update
SELECT COUNT(*) AS still_over_cap
FROM public.prompts
WHERE reward_kes > (
  CASE
    WHEN submit_cost_tokens <= 6 THEN (submit_cost_tokens * 20 * 0.80) / 0.45
    WHEN submit_cost_tokens <= 20 THEN (submit_cost_tokens * 20 * 0.70) / 0.50
    ELSE (submit_cost_tokens * 20 * 0.60) / 0.50
  END
);

COMMIT;
*/
