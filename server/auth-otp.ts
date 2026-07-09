import { createHash, randomInt } from "node:crypto";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function otpSecret(): string {
  const secret =
    process.env.AUTH_OTP_SECRET ||
    process.env.PASSWORD_RESET_OTP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  if (!secret) {
    throw new Error(
      "Set AUTH_OTP_SECRET, PASSWORD_RESET_OTP_SECRET, or SUPABASE_SERVICE_ROLE_KEY for OTP hashing."
    );
  }
  return secret;
}

export function hashAuthOtp(otp: string, emailNormalized: string, purpose: string): string {
  return createHash("sha256")
    .update(`${otpSecret()}:${purpose}:${emailNormalized}:${otp}`)
    .digest("hex");
}
