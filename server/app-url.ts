/** Canonical public site — used when APP_URL is missing or still set to localhost in production. */
export const PRODUCTION_SITE_URL = "https://www.jobtoken.co.ke";

function isLocalhostUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function isProductionRuntime(): boolean {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}

/**
 * Base app URL for links in emails and redirects.
 * Never falls back to localhost when running on Vercel / production.
 */
export function getAppUrl(): string {
  const fromEnv = (process.env.APP_URL || "").trim().replace(/\/$/, "");

  if (fromEnv && !isLocalhostUrl(fromEnv)) {
    return fromEnv;
  }

  if (isProductionRuntime()) {
    return PRODUCTION_SITE_URL;
  }

  return fromEnv || "http://localhost:3000";
}

/** Site URL shown in email copy (same rules as getAppUrl). */
export function getPortalUrl(): string {
  return getAppUrl();
}
