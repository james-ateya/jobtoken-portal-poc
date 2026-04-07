-- Canonical KES ledger + withdrawal requests. Balance = SUM(amount_kes) per user.
-- See EARNINGS_PLAN.md

CREATE TABLE IF NOT EXISTS public.earnings_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount_kes numeric(14, 2) NOT NULL,
  entry_type text NOT NULL CHECK (
    entry_type IN ('reward_credit', 'adjustment', 'withdrawal_payout', 'reversal')
  ),
  reference_type text,
  reference_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_earnings_ledger_user_created ON public.earnings_ledger (user_id, created_at DESC);

-- One reward credit per referenced submission (idempotency).
CREATE UNIQUE INDEX IF NOT EXISTS idx_earnings_ledger_reward_unique
  ON public.earnings_ledger (reference_type, reference_id)
  WHERE entry_type = 'reward_credit' AND reference_type = 'prompt_submission';

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  amount_kes_requested numeric(14, 2) NOT NULL CHECK (amount_kes_requested > 0),
  period_month date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'paid_full', 'paid_partial', 'rejected')
  ),
  amount_paid_kes numeric(14, 2) NOT NULL DEFAULT 0 CHECK (amount_paid_kes >= 0),
  admin_note text,
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON public.withdrawal_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_one_pending_per_month
  ON public.withdrawal_requests (user_id, period_month)
  WHERE status = 'pending';

ALTER TABLE public.earnings_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "earnings_ledger_select_own" ON public.earnings_ledger;
CREATE POLICY "earnings_ledger_select_own"
  ON public.earnings_ledger FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "withdrawal_requests_select_own" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_select_own"
  ON public.withdrawal_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "withdrawal_requests_insert_own" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_insert_own"
  ON public.withdrawal_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'seeker')
  );

COMMENT ON TABLE public.earnings_ledger IS 'Signed KES lines; balance = sum(amount_kes) per user.';
COMMENT ON TABLE public.withdrawal_requests IS 'Monthly withdrawal applications; admin settles via ledger debits.';
