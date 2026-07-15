import type { SupabaseClient } from "@supabase/supabase-js";
import { generateSixDigitOtp, hashAuthOtp, normalizeEmail } from "./auth-otp.js";
import { sendWithdrawalOtpEmail } from "./withdrawal-otp-email.js";

type AdminClient = SupabaseClient;

export const WITHDRAWAL_OTP_TTL_MS = 15 * 60 * 1000;
export const WITHDRAWAL_OTP_MAX_REQUESTS_PER_HOUR = 5;
export const WITHDRAWAL_OTP_MAX_ATTEMPTS = 5;

const SAFARICOM_REGEX = /^(?:\+?254|0)(7\d{8}|1\d{8})$/;

export function isValidSafaricomPhone(phone: string): boolean {
  return SAFARICOM_REGEX.test(phone.replace(/[\s-]/g, ""));
}

export function normalizeSafaricomPhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");
  const match = cleaned.match(SAFARICOM_REGEX);
  if (!match) {
    throw new Error("Invalid Safaricom phone number");
  }
  return `254${match[1]}`;
}

export async function issueWithdrawalOtp(
  supabaseAdmin: AdminClient,
  params: {
    userId: string;
    email: string;
    phone: string;
    amount: number;
  }
): Promise<void> {
  const emailNormalized = normalizeEmail(params.email);
  const normalizedPhone = normalizeSafaricomPhone(params.phone);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: cntErr } = await supabaseAdmin
    .from("withdrawal_otps")
    .select("*", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .gte("created_at", oneHourAgo);
  if (cntErr) throw cntErr;
  if ((count ?? 0) >= WITHDRAWAL_OTP_MAX_REQUESTS_PER_HOUR) {
    throw new Error("Too many code requests. Try again in about an hour.");
  }

  const otp = generateSixDigitOtp();
  const otpHash = hashAuthOtp(otp, emailNormalized, "withdrawal");
  const expiresAt = new Date(Date.now() + WITHDRAWAL_OTP_TTL_MS).toISOString();

  const { error: delErr } = await supabaseAdmin
    .from("withdrawal_otps")
    .delete()
    .eq("user_id", params.userId);
  if (delErr) throw delErr;

  const { error: insErr } = await supabaseAdmin.from("withdrawal_otps").insert({
    user_id: params.userId,
    email_normalized: emailNormalized,
    phone: normalizedPhone,
    amount_kes: Math.round(params.amount * 100) / 100,
    otp_hash: otpHash,
    expires_at: expiresAt,
    attempt_count: 0,
  });
  if (insErr) throw insErr;

  await sendWithdrawalOtpEmail({
    to: params.email,
    otp,
    amountKes: params.amount,
    phone: normalizedPhone,
  });
}

export async function verifyWithdrawalOtp(
  supabaseAdmin: AdminClient,
  userId: string,
  otp: string,
  timingSafeEqual: (a: Buffer, b: Buffer) => boolean
): Promise<{ phone: string; amount: number }> {
  const otpDigits = otp.replace(/\s/g, "");
  if (!/^\d{6}$/.test(otpDigits)) {
    throw new Error("Enter the 6-digit code from your email");
  }

  const { data: row, error: selErr } = await supabaseAdmin
    .from("withdrawal_otps")
    .select("id, user_id, email_normalized, phone, amount_kes, otp_hash, attempt_count")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) {
    throw new Error("Invalid or expired code. Request a new one.");
  }

  const rowTyped = row as {
    id: string;
    user_id: string;
    email_normalized: string;
    phone: string;
    amount_kes: number;
    otp_hash: string;
    attempt_count: number;
  };

  if (rowTyped.attempt_count >= WITHDRAWAL_OTP_MAX_ATTEMPTS) {
    await supabaseAdmin.from("withdrawal_otps").delete().eq("id", rowTyped.id);
    throw new Error("Too many incorrect attempts. Request a new code.");
  }

  const expectedHash = rowTyped.otp_hash;
  const actualHash = hashAuthOtp(otpDigits, rowTyped.email_normalized, "withdrawal");
  const a = Buffer.from(expectedHash, "hex");
  const b = Buffer.from(actualHash, "hex");
  const matches = a.length === b.length && timingSafeEqual(a, b);

  if (!matches) {
    await supabaseAdmin
      .from("withdrawal_otps")
      .update({ attempt_count: rowTyped.attempt_count + 1 })
      .eq("id", rowTyped.id);
    throw new Error("Invalid code. Check your email and try again.");
  }

  await supabaseAdmin
    .from("withdrawal_otps")
    .delete()
    .eq("user_id", userId);

  return {
    phone: rowTyped.phone,
    amount: Number(rowTyped.amount_kes),
  };
}
