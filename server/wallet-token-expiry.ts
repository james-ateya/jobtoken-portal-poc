const DEFAULT_WALLET_TOKEN_EXPIRY_DAYS = 10;
const DEFAULT_WALLET_TOKEN_EXPIRY_REMINDER_DAYS = 2;
const LEGACY_WALLET_TOKEN_EXPIRY_DAYS = 30;

export function getWalletTokenExpiryDays(): number {
  const parsed = parseInt(process.env.WALLET_TOKEN_EXPIRY_DAYS || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WALLET_TOKEN_EXPIRY_DAYS;
}

export function getWalletTokenExpiryReminderDays(): number {
  const parsed = parseInt(process.env.WALLET_TOKEN_EXPIRY_REMINDER_DAYS || "", 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_WALLET_TOKEN_EXPIRY_REMINDER_DAYS;
}

export function getWalletTokenExpiresAt(from: Date = new Date()): Date {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + getWalletTokenExpiryDays());
  return expiresAt;
}

/** Shrink a legacy 30-day expiry window to the 10-day policy (purchase date unchanged). */
export function shrinkLegacyWalletExpiry(expiresAt: Date | string): Date {
  const current = new Date(expiresAt);
  const deltaDays = LEGACY_WALLET_TOKEN_EXPIRY_DAYS - getWalletTokenExpiryDays();
  current.setDate(current.getDate() - deltaDays);
  return current;
}

export function formatTokenExpiryDate(expiresAt: Date | string): string {
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return d.toLocaleString("en-KE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Nairobi",
  });
}

export function walletExpiryFields(expiresAt: Date): {
  expires_at: string;
  token_expiry_reminder_sent_at: null;
} {
  return {
    expires_at: expiresAt.toISOString(),
    token_expiry_reminder_sent_at: null,
  };
}
