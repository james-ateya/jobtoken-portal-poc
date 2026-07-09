-- Coupon marketing system: marketers, coupons, redemptions.
-- Bonus tokens are conversion-based (awarded on first qualifying M-Pesa top-up within coupon TTL).

-- ============================================================
-- Marketers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketers_active
  ON public.marketers (is_active)
  WHERE is_active = true;

ALTER TABLE public.marketers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.marketers IS 'People who distribute coupon codes on behalf of the platform.';

-- ============================================================
-- Coupons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  marketer_id uuid NOT NULL REFERENCES public.marketers (id) ON DELETE CASCADE,
  bonus_tokens int NOT NULL DEFAULT 3,
  expires_at timestamptz NOT NULL,
  max_redemptions int,
  is_revoked boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons (code);
CREATE INDEX IF NOT EXISTS idx_coupons_marketer ON public.coupons (marketer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupons_active
  ON public.coupons (expires_at)
  WHERE is_revoked = false;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.coupons IS 'Auto-generated referral codes tied to a marketer with a TTL.';

-- ============================================================
-- Coupon Redemptions (fulfilled conversions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tokens_awarded int NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON public.coupon_redemptions (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON public.coupon_redemptions (user_id);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.coupon_redemptions IS 'One row per fulfilled conversion: user signed up with coupon AND topped up within TTL.';

-- ============================================================
-- Pending coupon link on profiles
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.coupon_id IS 'Coupon the user signed up with; cleared after bonus fulfilled or expired.';

-- ============================================================
-- Platform settings for coupon defaults
-- ============================================================
INSERT INTO public.platform_settings (key, value_int) VALUES
  ('coupon_bonus_tokens', 3),
  ('coupon_ttl_hours', 48),
  ('coupon_min_topup_kes', 100)
ON CONFLICT (key) DO NOTHING;
