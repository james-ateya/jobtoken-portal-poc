-- Permanent email bans (survives account deletion).
CREATE TABLE IF NOT EXISTS public.blacklisted_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  reason text NOT NULL,
  blacklisted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blacklisted_emails_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_blacklisted_emails_email ON public.blacklisted_emails (email);

COMMENT ON TABLE public.blacklisted_emails IS 'Emails permanently banned from signup, login, and token reactivation.';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivation_reason text;

COMMENT ON COLUMN public.profiles.deactivation_reason IS 'Admin note when the account was deactivated (temporary pause).';

ALTER TABLE public.blacklisted_emails ENABLE ROW LEVEL SECURITY;
