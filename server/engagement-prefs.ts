import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail } from "./auth-otp.js";
import { loadBlacklistForEmails } from "./email-blacklist.js";
import { getAppUrl, getPortalUrl } from "./app-url.js";

export type EngagementProfile = {
  id: string;
  email: string;
  full_name: string | null;
  marketing_emails_opted_out_at: string | null;
  marketing_unsub_token: string | null;
  is_active: boolean | null;
  role: string | null;
  created_at: string;
};

export function appBaseUrl(): string {
  return getAppUrl();
}

export function portalUrl(): string {
  return getPortalUrl();
}

export function unsubscribeUrl(token: string): string {
  return `${appBaseUrl()}/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function promptsUrl(): string {
  return `${appBaseUrl()}/dashboard/prompts`;
}

export function walletUrl(): string {
  return `${appBaseUrl()}/dashboard`;
}

export function earningsUrl(): string {
  return `${appBaseUrl()}/dashboard/earnings`;
}

/** ISO week key e.g. 2026-W29 (Nairobi calendar week). */
export function nairobiIsoWeekKey(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const utc = new Date(Date.UTC(y, m - 1, day));
  // ISO week: Thursday-based
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function stableShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  let h = createHash("sha256").update(seed).digest();
  for (let i = arr.length - 1; i > 0; i--) {
    const n = h.readUInt32BE(0) % (i + 1);
    h = createHash("sha256").update(h).digest();
    [arr[i], arr[n]] = [arr[n], arr[i]];
  }
  return arr;
}

export async function ensureUnsubToken(
  supabaseAdmin: SupabaseClient,
  profile: { id: string; marketing_unsub_token?: string | null }
): Promise<string> {
  if (profile.marketing_unsub_token) return profile.marketing_unsub_token;
  const token = randomUUID();
  await supabaseAdmin
    .from("profiles")
    .update({ marketing_unsub_token: token })
    .eq("id", profile.id);
  return token;
}

export async function isMarketingAllowed(
  supabaseAdmin: SupabaseClient,
  profile: {
    email?: string | null;
    marketing_emails_opted_out_at?: string | null;
    is_active?: boolean | null;
    role?: string | null;
  }
): Promise<boolean> {
  if (!profile.email) return false;
  if (profile.role && profile.role !== "seeker") return false;
  if (profile.is_active === false) return false;
  if (profile.marketing_emails_opted_out_at) return false;

  const bl = await loadBlacklistForEmails(supabaseAdmin, [profile.email]);
  return !bl.has(normalizeEmail(profile.email));
}

export async function markEngagementSent(
  supabaseAdmin: SupabaseClient,
  userId: string,
  campaign: string,
  dedupeKey: string,
  meta: Record<string, unknown> = {}
): Promise<boolean> {
  const { error } = await supabaseAdmin.from("seeker_engagement_sends").insert({
    user_id: userId,
    campaign,
    dedupe_key: dedupeKey,
    meta,
  });
  if (error) {
    // Unique violation = already sent
    if (String(error.code) === "23505") return false;
    throw error;
  }
  return true;
}

export async function hasEngagementSend(
  supabaseAdmin: SupabaseClient,
  userId: string,
  campaign: string,
  dedupeKey: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("seeker_engagement_sends")
    .select("id")
    .eq("user_id", userId)
    .eq("campaign", campaign)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  return Boolean(data);
}

export async function optOutByToken(
  supabaseAdmin: SupabaseClient,
  token: string
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const trimmed = String(token || "").trim();
  if (!trimmed) return { ok: false, error: "Missing token" };

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, marketing_emails_opted_out_at")
    .eq("marketing_unsub_token", trimmed)
    .maybeSingle();

  if (error) throw error;
  if (!profile) return { ok: false, error: "Invalid or expired unsubscribe link" };

  if (!profile.marketing_emails_opted_out_at) {
    await supabaseAdmin
      .from("profiles")
      .update({ marketing_emails_opted_out_at: new Date().toISOString() })
      .eq("id", profile.id);
  }

  return { ok: true, email: profile.email as string };
}
