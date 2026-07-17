-- Seeker re-engagement: marketing opt-out + send dedupe log.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_emails_opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_unsub_token uuid;

UPDATE public.profiles
SET marketing_unsub_token = gen_random_uuid()
WHERE marketing_unsub_token IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN marketing_unsub_token SET DEFAULT gen_random_uuid();

ALTER TABLE public.profiles
  ALTER COLUMN marketing_unsub_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_marketing_unsub_token
  ON public.profiles (marketing_unsub_token);

CREATE TABLE IF NOT EXISTS public.seeker_engagement_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  campaign text NOT NULL,
  dedupe_key text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_seeker_engagement_sends_campaign_sent
  ON public.seeker_engagement_sends (campaign, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_seeker_engagement_sends_user
  ON public.seeker_engagement_sends (user_id, sent_at DESC);

ALTER TABLE public.seeker_engagement_sends ENABLE ROW LEVEL SECURITY;

-- Service role / backend only; no direct client policies.

COMMENT ON COLUMN public.profiles.marketing_emails_opted_out_at IS
  'When set, user opted out of JobToken marketing / re-engagement emails.';
COMMENT ON COLUMN public.profiles.marketing_unsub_token IS
  'Opaque token for one-click unsubscribe links (no login required).';
COMMENT ON TABLE public.seeker_engagement_sends IS
  'Dedupe log for weekly digest and trigger re-engagement emails.';
