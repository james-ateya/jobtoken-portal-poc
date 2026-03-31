-- Clarify semantics: job row stores the profession/field for THIS role, not the employer's company sector.
COMMENT ON COLUMN public.jobs.area_of_business IS
  'Profession or field sought for this listing (e.g. Finance while the company is in IT). Used for seeker matching and filters. Distinct from profiles.area_of_business (employer company sector).';
