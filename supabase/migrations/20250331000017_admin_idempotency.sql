-- Idempotent replay for admin settlement (and similar) — keyed results; service role only in practice.
CREATE TABLE IF NOT EXISTS public.admin_idempotency (
  idempotency_key text PRIMARY KEY,
  operation text NOT NULL,
  result_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_idempotency_created ON public.admin_idempotency (created_at DESC);

ALTER TABLE public.admin_idempotency ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_idempotency IS 'Stores idempotent API results (e.g. withdrawal settle replay). Inserted by service role only.';
