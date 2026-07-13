-- Earnings → token redemption/gifts and M-Pesa token gifts to other users.

ALTER TABLE public.earnings_ledger DROP CONSTRAINT IF EXISTS earnings_ledger_entry_type_check;

ALTER TABLE public.earnings_ledger ADD CONSTRAINT earnings_ledger_entry_type_check CHECK (
  entry_type IN ('reward_credit', 'adjustment', 'withdrawal_payout', 'reversal', 'token_redemption')
);

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS gift_recipient_user_id uuid
  REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

DO $$
DECLARE
  allowed text[];
  extras text[] := ARRAY['earnings_token_redemption', 'token_gift'];
  extra text;
  in_list text;
BEGIN
  SELECT coalesce(
    (
      SELECT array_agg(sub.t ORDER BY sub.t)
      FROM (
        SELECT DISTINCT type AS t
        FROM public.transactions
        WHERE type IS NOT NULL
      ) sub
    ),
    ARRAY[]::text[]
  )
  INTO allowed;

  FOREACH extra IN ARRAY extras LOOP
    IF NOT (extra = ANY (allowed)) THEN
      allowed := array_append(allowed, extra);
    END IF;
  END LOOP;

  SELECT string_agg(quote_literal(t), ', ' ORDER BY t)
  INTO in_list
  FROM unnest(allowed) AS u(t);

  IF in_list IS NULL OR btrim(in_list) = '' THEN
    in_list := quote_literal('earnings_token_redemption');
  END IF;

  EXECUTE format(
    'ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type IN (%s))',
    in_list
  );
END;
$$;

COMMENT ON COLUMN public.transactions.gift_recipient_user_id IS
  'When set, completed top-up tokens credit this user instead of the payer wallet owner.';
