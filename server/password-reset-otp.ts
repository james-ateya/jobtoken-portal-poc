import { createHash, randomInt } from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashPasswordResetOtp(otp: string, emailNormalized: string): string {
  const secret =
    process.env.PASSWORD_RESET_OTP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!secret) {
    throw new Error(
      "Set PASSWORD_RESET_OTP_SECRET or SUPABASE_SERVICE_ROLE_KEY for password reset OTP hashing."
    );
  }
  return createHash("sha256")
    .update(`${secret}:${emailNormalized}:${otp}`)
    .digest("hex");
}

export function generateSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
