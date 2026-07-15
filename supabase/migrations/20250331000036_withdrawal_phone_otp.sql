-- Withdrawal OTP table for M-Pesa phone capture during withdrawal requests.

-- Add payout_phone column to withdrawal_requests
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_phone text;

-- OTP table for withdrawal phone verification (follows seeker_auth_otps pattern)
CREATE TABLE IF NOT EXISTS public.withdrawal_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  phone text NOT NULL,
  amount_kes numeric(14,2) NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempt_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_otps_user
  ON public.withdrawal_otps (user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_otps_expires
  ON public.withdrawal_otps (expires_at);

ALTER TABLE public.withdrawal_otps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.withdrawal_otps IS
  'Hashed email OTPs for withdrawal phone verification; backend service role only.';
