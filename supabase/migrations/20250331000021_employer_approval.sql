-- Employer accounts require admin approval before posting jobs / managing prompt series (RLS).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employer_approval_status text
  CHECK (
    employer_approval_status IS NULL
    OR employer_approval_status IN ('pending', 'approved', 'rejected')
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employer_approved_at timestamptz;

COMMENT ON COLUMN public.profiles.employer_approval_status IS
  'For role=employer: pending until admin approves; seeker/admin NULL.';
COMMENT ON COLUMN public.profiles.employer_approved_at IS
  'When employer was approved (NULL if not applicable).';

-- Existing employers: treat as already approved (no service disruption).
UPDATE public.profiles
SET
  employer_approval_status = 'approved',
  employer_approved_at = COALESCE(employer_approved_at, created_at, now())
WHERE role = 'employer';

UPDATE public.profiles
SET employer_approval_status = NULL, employer_approved_at = NULL
WHERE role IS DISTINCT FROM 'employer';

CREATE OR REPLACE FUNCTION public.set_employer_approval_default()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'employer' THEN
    IF TG_OP = 'INSERT' AND NEW.employer_approval_status IS NULL THEN
      NEW.employer_approval_status := 'pending';
    END IF;
    IF TG_OP = 'UPDATE' AND (OLD.role IS DISTINCT FROM 'employer') AND NEW.role = 'employer' THEN
      IF NEW.employer_approval_status IS NULL THEN
        NEW.employer_approval_status := 'pending';
      END IF;
    END IF;
  ELSE
    NEW.employer_approval_status := NULL;
    NEW.employer_approved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_employer_approval_default ON public.profiles;
CREATE TRIGGER trg_profiles_employer_approval_default
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_employer_approval_default();

-- Prompt series / prompts: only approved employers may insert or update.
DROP POLICY IF EXISTS "prompt_series_insert_employer" ON public.prompt_series;
CREATE POLICY "prompt_series_insert_employer"
  ON public.prompt_series FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'employer'
        AND p.employer_approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "prompt_series_update_own_employer" ON public.prompt_series;
CREATE POLICY "prompt_series_update_own_employer"
  ON public.prompt_series FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'employer'
        AND p.employer_approval_status = 'approved'
    )
  )
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "prompts_insert_series_owner" ON public.prompts;
CREATE POLICY "prompts_insert_series_owner"
  ON public.prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.prompt_series s
      INNER JOIN public.profiles p ON p.id = s.created_by
      WHERE s.id = series_id
        AND s.created_by = auth.uid()
        AND p.employer_approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "prompts_update_series_owner" ON public.prompts;
CREATE POLICY "prompts_update_series_owner"
  ON public.prompts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.prompt_series s
      INNER JOIN public.profiles p ON p.id = s.created_by
      WHERE s.id = prompts.series_id
        AND s.created_by = auth.uid()
        AND p.employer_approval_status = 'approved'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.prompt_series s
      INNER JOIN public.profiles p ON p.id = s.created_by
      WHERE s.id = prompts.series_id
        AND s.created_by = auth.uid()
        AND p.employer_approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "prompts_delete_series_owner" ON public.prompts;
CREATE POLICY "prompts_delete_series_owner"
  ON public.prompts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.prompt_series s
      INNER JOIN public.profiles p ON p.id = s.created_by
      WHERE s.id = prompts.series_id
        AND s.created_by = auth.uid()
        AND p.employer_approval_status = 'approved'
    )
  );
