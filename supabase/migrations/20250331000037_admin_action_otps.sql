-- OTP table for sensitive admin actions (earnings reset, etc.).

CREATE TABLE IF NOT EXISTS public.admin_action_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  action text NOT NULL,
  email_normalized text NOT NULL,
  otp_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  attempt_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_otps_admin
  ON public.admin_action_otps (admin_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_action_otps_expires
  ON public.admin_action_otps (expires_at);

ALTER TABLE public.admin_action_otps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_action_otps IS
  'Hashed email OTPs for sensitive admin actions (earnings reset, etc.); backend service role only.';
