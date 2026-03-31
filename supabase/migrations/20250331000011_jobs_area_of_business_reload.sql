-- Ensure column exists on the real table (idempotent).
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS area_of_business text;

-- Hint PostgREST to reload schema so API accepts reads/writes for new columns (Supabase/PostgREST).
NOTIFY pgrst, 'reload schema';
