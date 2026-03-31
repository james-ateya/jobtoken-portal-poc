-- When set, job is hidden from the public board after this time (employers still see it).
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS closes_at timestamptz;

COMMENT ON COLUMN public.jobs.closes_at IS 'Optional listing end; applications blocked after this instant.';
