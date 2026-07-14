-- Add AI quality report columns to prompt_submissions.

ALTER TABLE public.prompt_submissions
  ADD COLUMN IF NOT EXISTS quality_report jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quality_checked_at timestamptz DEFAULT NULL;
