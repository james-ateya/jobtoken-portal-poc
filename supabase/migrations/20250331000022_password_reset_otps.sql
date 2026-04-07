-- OTP-based password reset (server-only via service role; RLS enabled, no policies for anon/auth).

CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempt_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_norm
  ON public.password_reset_otps (email_normalized);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires
  ON public.password_reset_otps (expires_at);

ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.password_reset_otps IS
  'Stores hashed OTPs for email password reset; accessed only by backend with service role.';
