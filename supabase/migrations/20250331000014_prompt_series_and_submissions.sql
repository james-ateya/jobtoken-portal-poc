-- Prompt series (employer) and prompts; submissions with grading columns.
-- Earnings plan: see EARNINGS_PLAN.md

CREATE TABLE IF NOT EXISTS public.prompt_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_series_created_by ON public.prompt_series (created_by);
CREATE INDEX IF NOT EXISTS idx_prompt_series_status ON public.prompt_series (status);

CREATE TABLE IF NOT EXISTS public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.prompt_series (id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  headline text NOT NULL,
  instructions text NOT NULL,
  word_limit int CHECK (word_limit IS NULL OR word_limit > 0),
  reward_kes numeric(14, 2) NOT NULL CHECK (reward_kes >= 0),
  submit_cost_tokens int NOT NULL CHECK (submit_cost_tokens > 0),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompts_series_sort ON public.prompts (series_id, sort_order);

CREATE TABLE IF NOT EXISTS public.prompt_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid NOT NULL REFERENCES public.prompts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  answer_text text NOT NULL,
  word_count int NOT NULL DEFAULT 0,
  tokens_charged int NOT NULL CHECK (tokens_charged > 0),
  grade_status text NOT NULL DEFAULT 'pending' CHECK (grade_status IN ('pending', 'pass', 'fail')),
  graded_at timestamptz,
  graded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_submissions_user ON public.prompt_submissions (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_submissions_prompt ON public.prompt_submissions (prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_submissions_grade ON public.prompt_submissions (grade_status) WHERE grade_status = 'pending';

ALTER TABLE public.prompt_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_submissions ENABLE ROW LEVEL SECURITY;

-- Published series visible to everyone (including anon) for discovery cards.
DROP POLICY IF EXISTS "prompt_series_select_published" ON public.prompt_series;
CREATE POLICY "prompt_series_select_published"
  ON public.prompt_series FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "prompt_series_select_own" ON public.prompt_series;
CREATE POLICY "prompt_series_select_own"
  ON public.prompt_series FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "prompt_series_insert_employer" ON public.prompt_series;
CREATE POLICY "prompt_series_insert_employer"
  ON public.prompt_series FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'employer')
  );

DROP POLICY IF EXISTS "prompt_series_update_own_employer" ON public.prompt_series;
CREATE POLICY "prompt_series_update_own_employer"
  ON public.prompt_series FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Prompts: visible if published under a published series, or owner preview.
DROP POLICY IF EXISTS "prompts_select_visible" ON public.prompts;
CREATE POLICY "prompts_select_visible"
  ON public.prompts FOR SELECT
  TO anon, authenticated
  USING (
    (
      is_published
      AND EXISTS (
        SELECT 1 FROM public.prompt_series s
        WHERE s.id = prompts.series_id AND s.status = 'published'
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.prompt_series s2
      WHERE s2.id = prompts.series_id AND s2.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prompts_insert_series_owner" ON public.prompts;
CREATE POLICY "prompts_insert_series_owner"
  ON public.prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prompt_series s
      WHERE s.id = series_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prompts_update_series_owner" ON public.prompts;
CREATE POLICY "prompts_update_series_owner"
  ON public.prompts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prompt_series s
      WHERE s.id = prompts.series_id AND s.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prompt_series s
      WHERE s.id = prompts.series_id AND s.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "prompts_delete_series_owner" ON public.prompts;
CREATE POLICY "prompts_delete_series_owner"
  ON public.prompts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prompt_series s
      WHERE s.id = prompts.series_id AND s.created_by = auth.uid()
    )
  );

-- Submissions: own rows; employer sees submissions for their series (read-only via policy).
DROP POLICY IF EXISTS "prompt_submissions_select_own" ON public.prompt_submissions;
CREATE POLICY "prompt_submissions_select_own"
  ON public.prompt_submissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "prompt_submissions_select_employer" ON public.prompt_submissions;
CREATE POLICY "prompt_submissions_select_employer"
  ON public.prompt_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prompts p
      JOIN public.prompt_series ps ON ps.id = p.series_id
      WHERE p.id = prompt_submissions.prompt_id AND ps.created_by = auth.uid()
    )
  );

-- Inserts/updates for submissions and grading go through service-role API by default.
-- Optional: allow seeker insert own (API still authoritative for token checks).
DROP POLICY IF EXISTS "prompt_submissions_insert_seeker" ON public.prompt_submissions;
CREATE POLICY "prompt_submissions_insert_seeker"
  ON public.prompt_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'seeker')
  );

COMMENT ON TABLE public.prompt_series IS 'Employer-owned container for screening/earning prompts.';
COMMENT ON TABLE public.prompts IS 'Individual prompts with reward_kes and submit_cost_tokens.';
COMMENT ON TABLE public.prompt_submissions IS 'Seeker answers; grade_status drives earnings_ledger credit on pass.';
