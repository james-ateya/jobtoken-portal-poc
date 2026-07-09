import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeEmail } from "./auth-otp.js";
import {
  generateSixDigitOtp,
  hashPasswordResetOtp,
} from "./password-reset-otp.js";
import { sendMail } from "./mail.js";
import { findAuthUserForSignupResume, getProfileRole } from "./seeker-auth.js";

export const PASSWORD_RESET_OTP_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_MAX_REQUESTS_PER_HOUR = 5;
export const PASSWORD_RESET_MAX_OTP_ATTEMPTS = 5;

export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists for that email, you will receive a verification code shortly.";

type AdminClient = SupabaseClient;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function accountTypeLabel(role: string | null | undefined): string {
  if (role === "admin") return "administrator";
  if (role === "employer") return "employer";
  if (role === "seeker") return "job seeker";
  return "account";
}

export type PasswordResetAccount = {
  userId: string;
  email: string;
  role: string | null;
  isActive: boolean;
};

/** Resolve any portal account (seeker, employer, admin) eligible for password reset. */
export async function resolvePasswordResetAccount(
  supabaseAdmin: AdminClient,
  emailNormalized: string
): Promise<PasswordResetAccount | null> {
  const { data: profileRow, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, is_active")
    .ilike("email", emailNormalized)
    .maybeSingle();
  if (profileErr) throw profileErr;

  if (profileRow?.id) {
    const role = (profileRow as { role?: string | null }).role ?? null;
    if (role === "seeker" || role === "employer" || role === "admin") {
      return {
        userId: profileRow.id,
        email: (profileRow as { email?: string | null }).email?.trim() || emailNormalized,
        role,
        isActive: (profileRow as { is_active?: boolean | null }).is_active !== false,
      };
    }
  }

  const found = await findAuthUserForSignupResume(supabaseAdmin, emailNormalized);
  if (!found) return null;

  const metaRole =
    typeof found.user.user_metadata?.role === "string" ? found.user.user_metadata.role : null;
  const fullProfile = await getProfileRole(supabaseAdmin, found.user.id);
  const role = fullProfile?.role || metaRole;

  if (role !== "seeker" && role !== "employer" && role !== "admin") {
    return null;
  }

  return {
    userId: found.user.id,
    email: found.user.email?.trim() || emailNormalized,
    role,
    isActive: fullProfile?.is_active !== false,
  };
}

export async function issuePasswordResetOtp(
  supabaseAdmin: AdminClient,
  account: PasswordResetAccount,
  emailNormalized: string
): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: cntErr } = await supabaseAdmin
    .from("password_reset_otps")
    .select("*", { count: "exact", head: true })
    .eq("email_normalized", emailNormalized)
    .gte("created_at", oneHourAgo);
  if (cntErr) throw cntErr;
  if ((count ?? 0) >= PASSWORD_RESET_MAX_REQUESTS_PER_HOUR) {
    throw new Error("Too many reset requests for this email. Try again in about an hour.");
  }

  const otp = generateSixDigitOtp();
  const otpHash = hashPasswordResetOtp(otp, emailNormalized);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS).toISOString();

  const { error: delErr } = await supabaseAdmin
    .from("password_reset_otps")
    .delete()
    .eq("email_normalized", emailNormalized);
  if (delErr) throw delErr;

  const { error: insErr } = await supabaseAdmin.from("password_reset_otps").insert({
    user_id: account.userId,
    email_normalized: emailNormalized,
    otp_hash: otpHash,
    expires_at: expiresAt,
    attempt_count: 0,
  });
  if (insErr) throw insErr;

  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const resetPageUrl = `${appUrl}/reset-password`;
  const accountLabel = accountTypeLabel(account.role);

  await sendMail({
    to: account.email,
    subject: "Your JobToken password reset code",
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
        <h1 style="font-size: 20px; color: #059669;">Password reset</h1>
        <p>We received a request to reset the password for your JobToken ${accountLabel} account.</p>
        <p>Enter this verification code on the reset page (expires in 15 minutes):</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 0.25em; font-family: ui-monospace, monospace;">${escapeHtml(otp)}</p>
        <p>Open the reset page, enter your email, this code, and your new password:</p>
        <p><a href="${escapeHtml(resetPageUrl)}" style="color: #059669;">${escapeHtml(resetPageUrl)}</a></p>
        <p style="font-size: 13px; color: #71717a;">If you did not request this, you can ignore this email. Your password will not change until you enter this code.</p>
      </div>
    `,
  });
}

export async function verifyPasswordResetOtp(
  supabaseAdmin: AdminClient,
  emailNormalized: string,
  otp: string,
  timingSafeEqual: (a: Buffer, b: Buffer) => boolean
): Promise<{ userId: string }> {
  const otpDigits = otp.replace(/\s/g, "");
  if (!/^\d{6}$/.test(otpDigits)) {
    throw new Error("Enter the 6-digit code from your email");
  }

  const { data: row, error: selErr } = await supabaseAdmin
    .from("password_reset_otps")
    .select("id, user_id, otp_hash, attempt_count")
    .eq("email_normalized", emailNormalized)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) {
    throw new Error("Invalid or expired code. Request a new code from Forgot password.");
  }

  const rowTyped = row as { id: string; user_id: string; otp_hash: string; attempt_count: number };
  if (rowTyped.attempt_count >= PASSWORD_RESET_MAX_OTP_ATTEMPTS) {
    await supabaseAdmin.from("password_reset_otps").delete().eq("id", rowTyped.id);
    throw new Error("Too many incorrect attempts. Request a new code.");
  }

  const expectedHash = rowTyped.otp_hash;
  const actualHash = hashPasswordResetOtp(otpDigits, emailNormalized);
  const a = Buffer.from(expectedHash, "hex");
  const b = Buffer.from(actualHash, "hex");
  const matches = a.length === b.length && timingSafeEqual(a, b);

  if (!matches) {
    await supabaseAdmin
      .from("password_reset_otps")
      .update({ attempt_count: rowTyped.attempt_count + 1 })
      .eq("id", rowTyped.id);
    throw new Error("Invalid code. Check the email and try again.");
  }

  const account = await resolvePasswordResetAccount(supabaseAdmin, emailNormalized);
  if (!account || account.userId !== rowTyped.user_id) {
    throw new Error("This reset code is no longer valid. Request a new code.");
  }
  if (!account.isActive) {
    throw new Error("This account has been deactivated. Contact support for help.");
  }

  await supabaseAdmin.from("password_reset_otps").delete().eq("email_normalized", emailNormalized);

  return { userId: rowTyped.user_id };
}

export async function completePasswordReset(
  supabaseAdmin: AdminClient,
  userId: string,
  newPassword: string
): Promise<void> {
  const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (authErr) throw authErr;
}
