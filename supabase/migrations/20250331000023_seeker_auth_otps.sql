-- Email OTP for job seeker signup and login (server-only via service role).

CREATE TABLE IF NOT EXISTS public.seeker_auth_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('signup', 'login')),
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempt_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seeker_auth_otps_email_purpose
  ON public.seeker_auth_otps (email_normalized, purpose);

CREATE INDEX IF NOT EXISTS idx_seeker_auth_otps_expires
  ON public.seeker_auth_otps (expires_at);

ALTER TABLE public.seeker_auth_otps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.seeker_auth_otps IS
  'Hashed email OTPs for signup and login (all roles); backend service role only.';
