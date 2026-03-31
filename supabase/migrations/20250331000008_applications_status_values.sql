-- Original schema often limits applications.status to a small set (e.g. pending/shortlisted/rejected).
-- Employer funnel + API allow more stages; replace any existing CHECK on status.

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'applications'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.applications DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_status_check CHECK (
    status IS NULL
    OR status IN (
      'pending',
      'reviewing',
      'qualified',
      'interview',
      'shortlisted',
      'offer',
      'rejected'
    )
  );
