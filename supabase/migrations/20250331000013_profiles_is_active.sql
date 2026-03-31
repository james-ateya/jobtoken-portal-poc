-- Soft-disable accounts (admin); login flow must reject is_active = false.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.is_active IS 'When false, user cannot use the app until reactivated by admin.';
