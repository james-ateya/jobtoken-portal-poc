/** Earnings → wallet token exchange (redeem + gift). Temporarily off due to abuse. */
export function isEarningsTokenExchangeEnabled(): boolean {
  const raw = process.env.EARNINGS_TOKEN_EXCHANGE_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function earningsTokenExchangeDisabledMessage(): string {
  return "Earnings token redemption and gifting are temporarily unavailable.";
}
