-- Core schema may define applications without created_at; API and UI order/filter by it.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applications'
      AND column_name = 'updated_at'
  ) THEN
    UPDATE public.applications
    SET created_at = COALESCE(updated_at, now())
    WHERE created_at IS NULL;
  ELSE
    UPDATE public.applications
    SET created_at = now()
    WHERE created_at IS NULL;
  END IF;
END $$;

ALTER TABLE public.applications
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.applications
  ALTER COLUMN created_at SET NOT NULL;
