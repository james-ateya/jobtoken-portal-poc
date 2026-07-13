-- Pre-aggregated earnings balances (avoids full ledger scans in admin payout APIs).

CREATE OR REPLACE VIEW public.earnings_balances_by_user AS
SELECT
  user_id,
  ROUND(SUM(amount_kes)::numeric, 2) AS balance_kes
FROM public.earnings_ledger
GROUP BY user_id;

COMMENT ON VIEW public.earnings_balances_by_user IS
  'Per-user earnings balance = sum(earnings_ledger.amount_kes). Used by admin payout planning.';

-- Sum of prompt rewards for passed submissions (payout analysis summary).
CREATE OR REPLACE FUNCTION public.sum_passed_prompt_rewards(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(p.reward_kes), 0)::numeric
  FROM public.prompt_submissions ps
  INNER JOIN public.prompts p ON p.id = ps.prompt_id
  WHERE ps.user_id = p_user_id
    AND ps.grade_status = 'pass';
$$;

-- Sum of prompt-submission credits in the earnings ledger (payout analysis summary).
CREATE OR REPLACE FUNCTION public.sum_prompt_submission_credits(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_kes), 0)::numeric
  FROM public.earnings_ledger
  WHERE user_id = p_user_id
    AND reference_type = 'prompt_submission';
$$;

-- Wallet transaction totals for admin user detail (avoids loading all rows).
CREATE OR REPLACE FUNCTION public.wallet_transaction_summary(p_wallet_id uuid)
RETURNS TABLE (
  total_topup_kes numeric,
  application_tokens_spent numeric,
  employer_fees_tokens numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN type = 'topup' AND status = 'completed' THEN amount_kes ELSE 0 END), 0)::numeric,
    COALESCE(SUM(CASE WHEN type = 'application' AND status = 'completed' THEN ABS(tokens_added) ELSE 0 END), 0)::numeric,
    COALESCE(SUM(
      CASE
        WHEN type IN ('employer_fee', 'employer_feature_fee') AND status = 'completed'
        THEN ABS(tokens_added)
        ELSE 0
      END
    ), 0)::numeric
  FROM public.transactions
  WHERE wallet_id = p_wallet_id;
$$;
