import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail } from "./auth-otp.js";
import { fetchRowsInIdBatches } from "./query-batches.js";

export type BlacklistRow = {
  email: string;
  reason: string;
  created_at: string;
  blacklisted_by: string | null;
  source_user_id: string | null;
};

export function isSchemaMissingError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find") ||
    msg.includes("schema cache") ||
    msg.includes("blacklisted_emails") ||
    msg.includes("deactivation_reason")
  );
}

/** Look up blacklist rows for a set of emails (batched). */
export async function loadBlacklistForEmails(
  supabaseAdmin: SupabaseClient,
  emails: string[]
): Promise<Map<string, { reason: string; created_at: string }>> {
  const map = new Map<string, { reason: string; created_at: string }>();
  const normalized = [...new Set(emails.map((e) => normalizeEmail(e)).filter(Boolean))];
  if (normalized.length === 0) return map;

  try {
    const rows = await fetchRowsInIdBatches<{ email: string; reason: string; created_at: string }>(
      normalized,
      (chunk) =>
        supabaseAdmin.from("blacklisted_emails").select("email, reason, created_at").in("email", chunk)
    );
    for (const row of rows) {
      map.set(normalizeEmail(String(row.email)), {
        reason: String(row.reason || ""),
        created_at: String(row.created_at || ""),
      });
    }
  } catch (error: any) {
    if (isSchemaMissingError(error)) {
      console.warn(
        "blacklisted_emails not available — apply migration 20250331000028_blacklisted_emails.sql"
      );
      return map;
    }
    throw error;
  }
  return map;
}

export async function loadBlacklistByEmailMap(
  supabaseAdmin: SupabaseClient
): Promise<Map<string, { reason: string; created_at: string }>> {
  const map = new Map<string, { reason: string; created_at: string }>();
  const { data, error } = await supabaseAdmin
    .from("blacklisted_emails")
    .select("email, reason, created_at");

  if (error) {
    if (isSchemaMissingError(error)) {
      console.warn(
        "blacklisted_emails not available — apply migration 20250331000028_blacklisted_emails.sql"
      );
      return map;
    }
    throw error;
  }

  for (const row of data ?? []) {
    map.set(normalizeEmail(String(row.email)), {
      reason: String(row.reason || ""),
      created_at: String(row.created_at || ""),
    });
  }
  return map;
}

export async function isEmailBlacklisted(
  supabaseAdmin: SupabaseClient,
  email: string
): Promise<{ blacklisted: boolean; reason?: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { blacklisted: false };

  const { data, error } = await supabaseAdmin
    .from("blacklisted_emails")
    .select("reason")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    if (isSchemaMissingError(error)) return { blacklisted: false };
    throw error;
  }
  if (!data) return { blacklisted: false };
  return { blacklisted: true, reason: String(data.reason || "") };
}

export async function getBlacklistForEmail(
  supabaseAdmin: SupabaseClient,
  email: string | null | undefined
): Promise<BlacklistRow | null> {
  if (!email?.trim()) return null;
  const normalized = normalizeEmail(email);
  const { data, error } = await supabaseAdmin
    .from("blacklisted_emails")
    .select("email, reason, created_at, blacklisted_by, source_user_id")
    .eq("email", normalized)
    .maybeSingle();
  if (error) {
    if (isSchemaMissingError(error)) return null;
    throw error;
  }
  return (data as BlacklistRow | null) ?? null;
}

export async function blacklistEmail(params: {
  supabaseAdmin: SupabaseClient;
  email: string;
  reason: string;
  blacklistedByUserId: string;
  sourceUserId?: string | null;
}): Promise<void> {
  const normalized = normalizeEmail(params.email);
  const reason = params.reason.trim();
  if (!normalized || !reason) {
    throw new Error("Email and reason are required");
  }

  const { error } = await params.supabaseAdmin.from("blacklisted_emails").upsert(
    {
      email: normalized,
      reason,
      blacklisted_by: params.blacklistedByUserId,
      source_user_id: params.sourceUserId ?? null,
    },
    { onConflict: "email" }
  );

  if (error) {
    if (isSchemaMissingError(error)) {
      throw new Error(
        "Blacklist table is not set up yet. Apply migration 20250331000028_blacklisted_emails.sql on Supabase."
      );
    }
    throw error;
  }
}
