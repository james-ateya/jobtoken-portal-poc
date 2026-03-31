-- Employer company fields, seeker profession (same taxonomy as job focus), job area for matching.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS office_location text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area_of_business text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profession_or_study text;

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS area_of_business text;

COMMENT ON COLUMN profiles.area_of_business IS 'Employer company sector; same vocabulary as jobs.area_of_business and profiles.profession_or_study.';
COMMENT ON COLUMN profiles.profession_or_study IS 'Seeker profession or field of study; matched to jobs.area_of_business for alerts.';
COMMENT ON COLUMN jobs.area_of_business IS 'Role sector/focus; used to notify seekers whose profession_or_study matches.';
