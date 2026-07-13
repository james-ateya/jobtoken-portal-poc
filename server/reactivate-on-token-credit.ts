import type { SupabaseClient } from "@supabase/supabase-js";
import { isEmailBlacklisted } from "./email-blacklist.js";

const TOKEN_CREDIT_TYPES = new Set([
  "topup",
  "token_gift",
  "earnings_token_redemption",
  "coupon_bonus",
]);

export async function tryReactivateAccountOnTokenCredit(
  supabaseAdmin: SupabaseClient,
  userId: string,
  tokensAdded: number
): Promise<boolean> {
  if (!userId || tokensAdded < 1) return false;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("is_active, role, email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile || profile.role === "admin" || profile.is_active !== false) {
    return false;
  }

  if (profile.email) {
    const blocked = await isEmailBlacklisted(supabaseAdmin, profile.email);
    if (blocked.blacklisted) return false;
  }

  const { error: upErr } = await supabaseAdmin
    .from("profiles")
    .update({ is_active: true })
    .eq("id", userId);

  if (upErr) throw upErr;
  return true;
}

export function isTokenCreditTransaction(type: string | null | undefined): boolean {
  return typeof type === "string" && TOKEN_CREDIT_TYPES.has(type);
}
