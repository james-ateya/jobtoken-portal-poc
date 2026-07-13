import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getWalletTokenExpiryReminderDays,
  formatTokenExpiryDate,
} from "./wallet-token-expiry.js";
import { sendTokenExpiryReminderEmail } from "./token-wallet-email.js";

export type TokenExpiryReminderResult = {
  checked: number;
  sent: number;
  skipped: number;
  errors: string[];
};

function nairobiDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

export async function processTokenExpiryReminders(
  supabaseAdmin: SupabaseClient
): Promise<TokenExpiryReminderResult> {
  const reminderDays = getWalletTokenExpiryReminderDays();
  const todayKey = nairobiDateKey(new Date());
  const targetExpiryKey = addDaysToDateKey(todayKey, reminderDays);

  const { data: wallets, error } = await supabaseAdmin
    .from("wallets")
    .select("id, user_id, token_balance, expires_at, token_expiry_reminder_sent_at")
    .gt("token_balance", 0)
    .not("expires_at", "is", null);

  if (error) throw error;

  const result: TokenExpiryReminderResult = {
    checked: wallets?.length ?? 0,
    sent: 0,
    skipped: 0,
    errors: [],
  };

  for (const wallet of wallets ?? []) {
    const expiresAt = wallet.expires_at as string;
    if (!expiresAt) {
      result.skipped += 1;
      continue;
    }

    if (new Date(expiresAt).getTime() <= Date.now()) {
      result.skipped += 1;
      continue;
    }

    const expiryKey = nairobiDateKey(new Date(expiresAt));
    if (expiryKey !== targetExpiryKey) {
      result.skipped += 1;
      continue;
    }

    if (wallet.token_expiry_reminder_sent_at) {
      result.skipped += 1;
      continue;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", wallet.user_id)
      .maybeSingle();

    if (!profile?.email) {
      result.skipped += 1;
      continue;
    }

    try {
      await sendTokenExpiryReminderEmail({
        to: profile.email,
        fullName: profile.full_name,
        tokenBalance: Number(wallet.token_balance) || 0,
        expiresAt,
      });

      const { error: markErr } = await supabaseAdmin
        .from("wallets")
        .update({ token_expiry_reminder_sent_at: new Date().toISOString() })
        .eq("id", wallet.id);

      if (markErr) throw markErr;
      result.sent += 1;
    } catch (err: any) {
      result.errors.push(
        `${profile.email} (${formatTokenExpiryDate(expiresAt)}): ${err?.message || String(err)}`
      );
    }
  }

  return result;
}
