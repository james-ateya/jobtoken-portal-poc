-- Admin-configurable integer settings (read by API with service role).
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value_int integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (key, value_int) VALUES
  ('feature_job_tokens', 2)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.platform_settings IS 'Platform knobs; accessed only via service role / server.';
