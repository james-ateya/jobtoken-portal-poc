-- Apply 10-day token expiry to existing wallets; track expiry reminder emails.

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS token_expiry_reminder_sent_at timestamptz;

COMMENT ON COLUMN public.wallets.token_expiry_reminder_sent_at IS
  'When the two-day-before-expiry reminder email was last sent for the current expires_at window.';

WITH last_credit AS (
  SELECT wallet_id, MAX(created_at) AS credited_at
  FROM public.transactions
  WHERE status = 'completed'
    AND COALESCE(tokens_added, 0) > 0
    AND type IN ('topup', 'token_gift', 'earnings_token_redemption', 'coupon_bonus')
  GROUP BY wallet_id
),
from_last_credit AS (
  SELECT
    w.id AS wallet_id,
    (lc.credited_at + INTERVAL '10 days') AS new_expires_at
  FROM public.wallets w
  INNER JOIN last_credit lc ON lc.wallet_id = w.id
  WHERE COALESCE(w.token_balance, 0) > 0
),
legacy_shrink AS (
  SELECT
    w.id AS wallet_id,
    (w.expires_at - INTERVAL '20 days') AS new_expires_at
  FROM public.wallets w
  WHERE COALESCE(w.token_balance, 0) > 0
    AND w.expires_at IS NOT NULL
    AND w.id NOT IN (SELECT wallet_id FROM last_credit)
),
fallback_now AS (
  SELECT
    w.id AS wallet_id,
    (now() + INTERVAL '10 days') AS new_expires_at
  FROM public.wallets w
  WHERE COALESCE(w.token_balance, 0) > 0
    AND w.expires_at IS NULL
    AND w.id NOT IN (SELECT wallet_id FROM last_credit)
),
combined AS (
  SELECT wallet_id, new_expires_at FROM from_last_credit
  UNION ALL
  SELECT wallet_id, new_expires_at FROM legacy_shrink
  UNION ALL
  SELECT wallet_id, new_expires_at FROM fallback_now
)
UPDATE public.wallets w
SET
  expires_at = c.new_expires_at,
  token_expiry_reminder_sent_at = NULL
FROM combined c
WHERE w.id = c.wallet_id;
