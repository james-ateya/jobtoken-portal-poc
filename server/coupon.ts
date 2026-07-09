import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const COUPON_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCouponCode(): string {
  const bytes = randomBytes(6);
  let code = "JT-";
  for (let i = 0; i < 6; i++) {
    code += COUPON_ALPHABET[bytes[i] % COUPON_ALPHABET.length];
  }
  return code;
}

export interface CouponSettings {
  bonusTokens: number;
  ttlHours: number;
  minTopupKes: number;
}

export async function getCouponSettings(
  supabaseAdmin: SupabaseClient
): Promise<CouponSettings> {
  const keys = ["coupon_bonus_tokens", "coupon_ttl_hours", "coupon_min_topup_kes"];
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value_int")
    .in("key", keys);

  const map = new Map<string, number>();
  if (data) {
    for (const row of data) {
      if (typeof row.value_int === "number") map.set(row.key, row.value_int);
    }
  }

  return {
    bonusTokens: map.get("coupon_bonus_tokens") ?? 3,
    ttlHours: map.get("coupon_ttl_hours") ?? 48,
    minTopupKes: map.get("coupon_min_topup_kes") ?? 100,
  };
}

export interface CouponLinkResult {
  couponId: string;
  expiresAt: string;
  bonusTokens: number;
}

/**
 * Called after OTP verification. Validates the coupon and links it to the user
 * profile as a pending bonus. Does NOT credit tokens yet.
 */
export async function linkCouponToUser(
  supabaseAdmin: SupabaseClient,
  userId: string,
  code: string
): Promise<CouponLinkResult | null> {
  const normalized = code.toUpperCase().replace(/\s/g, "");
  if (!normalized) return null;

  const { data: coupon } = await supabaseAdmin
    .from("coupons")
    .select("id, bonus_tokens, max_redemptions, is_revoked, expires_at, marketer_id")
    .eq("code", normalized)
    .maybeSingle();

  if (!coupon) return null;
  if (coupon.is_revoked) return null;
  if (new Date(coupon.expires_at) < new Date()) return null;

  const { data: marketer } = await supabaseAdmin
    .from("marketers")
    .select("is_active")
    .eq("id", coupon.marketer_id)
    .maybeSingle();
  if (!marketer?.is_active) return null;

  if (coupon.max_redemptions != null) {
    const { count } = await supabaseAdmin
      .from("coupon_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("coupon_id", coupon.id);
    if ((count ?? 0) >= coupon.max_redemptions) return null;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ coupon_id: coupon.id })
    .eq("id", userId);
  if (error) {
    console.error("linkCouponToUser: profile update failed", error);
    return null;
  }

  return {
    couponId: coupon.id,
    expiresAt: coupon.expires_at,
    bonusTokens: coupon.bonus_tokens,
  };
}

export interface FulfillResult {
  tokensAwarded: number;
}

/**
 * Called from the M-Pesa callback after a qualifying top-up.
 * Credits bonus tokens if the user has a pending coupon that's still within TTL.
 */
export async function fulfillCouponBonus(
  supabaseAdmin: SupabaseClient,
  userId: string,
  walletId: string
): Promise<FulfillResult | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("coupon_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.coupon_id) return null;

  const { data: coupon } = await supabaseAdmin
    .from("coupons")
    .select("id, bonus_tokens, is_revoked, expires_at, max_redemptions")
    .eq("id", profile.coupon_id)
    .maybeSingle();

  if (!coupon) {
    await clearPendingCoupon(supabaseAdmin, userId);
    return null;
  }

  if (coupon.is_revoked || new Date(coupon.expires_at) < new Date()) {
    await clearPendingCoupon(supabaseAdmin, userId);
    return null;
  }

  if (coupon.max_redemptions != null) {
    const { count } = await supabaseAdmin
      .from("coupon_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("coupon_id", coupon.id);
    if ((count ?? 0) >= coupon.max_redemptions) {
      await clearPendingCoupon(supabaseAdmin, userId);
      return null;
    }
  }

  const { error: redeemErr } = await supabaseAdmin
    .from("coupon_redemptions")
    .insert({
      coupon_id: coupon.id,
      user_id: userId,
      tokens_awarded: coupon.bonus_tokens,
    });

  if (redeemErr) {
    if (redeemErr.code === "23505") {
      await clearPendingCoupon(supabaseAdmin, userId);
      return null;
    }
    console.error("fulfillCouponBonus: insert redemption failed", redeemErr);
    return null;
  }

  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("token_balance")
    .eq("id", walletId)
    .single();

  if (wallet) {
    await supabaseAdmin
      .from("wallets")
      .update({ token_balance: wallet.token_balance + coupon.bonus_tokens })
      .eq("id", walletId);
  }

  await supabaseAdmin.from("transactions").insert({
    wallet_id: walletId,
    tokens_added: coupon.bonus_tokens,
    type: "coupon_bonus",
    reference_id: coupon.id,
    status: "completed",
  });

  await clearPendingCoupon(supabaseAdmin, userId);

  return { tokensAwarded: coupon.bonus_tokens };
}

async function clearPendingCoupon(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<void> {
  await supabaseAdmin
    .from("profiles")
    .update({ coupon_id: null })
    .eq("id", userId);
}
