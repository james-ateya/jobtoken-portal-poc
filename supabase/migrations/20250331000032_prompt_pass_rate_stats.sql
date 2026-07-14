-- Per-prompt submission statistics view for platform health monitoring.

CREATE OR REPLACE VIEW public.prompt_submission_stats AS
SELECT
  p.id AS prompt_id,
  p.headline,
  p.reward_kes,
  p.submit_cost_tokens,
  ps2.id AS series_id,
  ps2.title AS series_title,
  COUNT(sub.id) AS total_submissions,
  COUNT(sub.id) FILTER (WHERE sub.grade_status = 'pass') AS passed,
  COUNT(sub.id) FILTER (WHERE sub.grade_status = 'fail') AS failed,
  COUNT(sub.id) FILTER (WHERE sub.grade_status = 'pending') AS pending,
  CASE WHEN COUNT(sub.id) FILTER (WHERE sub.grade_status IN ('pass','fail')) > 0
    THEN ROUND(
      COUNT(sub.id) FILTER (WHERE sub.grade_status = 'pass')::numeric
      / COUNT(sub.id) FILTER (WHERE sub.grade_status IN ('pass','fail')),
      4
    )
    ELSE 0
  END AS pass_rate
FROM public.prompts p
JOIN public.prompt_series ps2 ON ps2.id = p.series_id
LEFT JOIN public.prompt_submissions sub ON sub.prompt_id = p.id
GROUP BY p.id, p.headline, p.reward_kes, p.submit_cost_tokens, ps2.id, ps2.title;
