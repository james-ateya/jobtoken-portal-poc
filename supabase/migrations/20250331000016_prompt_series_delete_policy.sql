-- Allow series owners to delete their prompt_series (CASCADE removes prompts/submissions).
DROP POLICY IF EXISTS "prompt_series_delete_own" ON public.prompt_series;
CREATE POLICY "prompt_series_delete_own"
  ON public.prompt_series FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
