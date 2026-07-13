import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "./mail.js";
import {
  formatTokenExpiryDate,
  getWalletTokenExpiryDays,
  getWalletTokenExpiryReminderDays,
} from "./wallet-token-expiry.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appUrls() {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const portalUrl = appUrl.includes("localhost") ? appUrl : "https://www.jobtoken.co.ke";
  return {
    dashboardUrl: `${appUrl}/dashboard`,
    walletUrl: `${appUrl}/dashboard`,
    portalUrl,
  };
}

export function buildTokenPurchaseEmailHtml(params: {
  fullName: string;
  tokensAdded: number;
  newBalance: number;
  amountKes?: number | null;
  expiresAt: string;
  expiryDays: number;
  isGiftReceived: boolean;
  giftedByLabel?: string | null;
  purchaseSource?: "mpesa" | "earnings" | "simulate";
  accountReactivated?: boolean;
  dashboardUrl: string;
  portalUrl: string;
}): string {
  const name = escapeHtml(params.fullName.trim() || "there");
  const expiryLabel = escapeHtml(formatTokenExpiryDate(params.expiresAt));
  const dashboardUrl = escapeHtml(params.dashboardUrl);
  const portalUrl = escapeHtml(params.portalUrl);
  const source = params.purchaseSource ?? "mpesa";
  const title = params.isGiftReceived ? "You received JobTokens" : "Thank you for your purchase";
  const lead = params.isGiftReceived
    ? params.giftedByLabel
      ? `<strong>${escapeHtml(params.giftedByLabel)}</strong> sent you JobTokens.`
      : "JobTokens have been credited to your wallet."
    : source === "earnings"
      ? "Your earnings were converted into wallet tokens successfully."
      : source === "simulate"
        ? "Your wallet has been topped up (simulated purchase)."
        : "Your M-Pesa payment was successful and your wallet has been topped up.";

  const amountLine =
    params.amountKes != null && params.amountKes > 0
      ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
          Amount paid: <strong>${params.amountKes.toLocaleString("en-KE")} KES</strong>
        </p>`
      : "";

  const reactivationBlock = params.accountReactivated
    ? `<div style="margin:20px 0 0;padding:16px 18px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;">
        <p style="margin:0;font-size:15px;line-height:1.6;color:#065f46;">
          <strong>Your account has been reactivated.</strong> You now have full access to JobToken again.
        </p>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — JobToken</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#d1fae5;font-weight:600;">JobToken wallet</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#3f3f46;">Hi ${name},</p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#3f3f46;">${lead}</p>
              <div style="margin:20px 0 0;padding:16px 18px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
                <p style="margin:0 0 8px;font-size:14px;color:#065f46;">
                  <strong>${params.tokensAdded.toLocaleString("en-KE")}</strong> tokens added
                </p>
                <p style="margin:0;font-size:14px;color:#065f46;">
                  New balance: <strong>${params.newBalance.toLocaleString("en-KE")}</strong> tokens
                </p>
                ${amountLine}
              </div>
              ${reactivationBlock}
              <div style="margin:20px 0 0;padding:16px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#92400e;">Use before expiry</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46;">
                  Your tokens are valid for <strong>${params.expiryDays} days</strong> from this purchase.
                  They expire on <strong>${expiryLabel}</strong>.
                </p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#71717a;">
                  Apply to jobs, take prompt tasks, or top up again before that date to stay active on JobToken.
                </p>
              </div>
              <p style="margin:24px 0;text-align:center;">
                <a href="${dashboardUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Open your wallet</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                <a href="${portalUrl}" style="color:#059669;text-decoration:none;">JobToken Portal</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function buildTokenExpiryReminderEmailHtml(params: {
  fullName: string;
  tokenBalance: number;
  expiresAt: string;
  reminderDays: number;
  dashboardUrl: string;
  portalUrl: string;
}): string {
  const name = escapeHtml(params.fullName.trim() || "there");
  const expiryLabel = escapeHtml(formatTokenExpiryDate(params.expiresAt));
  const dashboardUrl = escapeHtml(params.dashboardUrl);
  const portalUrl = escapeHtml(params.portalUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Your JobTokens expire soon</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#d97706 0%,#b45309 100%);padding:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#fef3c7;font-weight:600;">JobToken reminder</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">Your tokens expire in ${params.reminderDays} days</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#3f3f46;">Hi ${name},</p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#3f3f46;">
                You still have <strong>${params.tokenBalance.toLocaleString("en-KE")}</strong> JobTokens in your wallet.
                Please use them or top up before they expire.
              </p>
              <div style="margin:20px 0 0;padding:16px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46;">
                  Expiry date: <strong>${expiryLabel}</strong>
                </p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#71717a;">
                  After expiry you will need a new top-up to apply for jobs or submit prompt answers.
                </p>
              </div>
              <p style="margin:24px 0;text-align:center;">
                <a href="${dashboardUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Use my tokens now</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                <a href="${portalUrl}" style="color:#059669;text-decoration:none;">JobToken Portal</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendTokenPurchaseEmail(params: {
  to: string;
  fullName: string | null;
  tokensAdded: number;
  newBalance: number;
  amountKes?: number | null;
  expiresAt: string;
  isGiftReceived?: boolean;
  giftedByLabel?: string | null;
  purchaseSource?: "mpesa" | "earnings" | "simulate";
  accountReactivated?: boolean;
}): Promise<void> {
  const urls = appUrls();
  const expiryDays = getWalletTokenExpiryDays();
  const isGiftReceived = Boolean(params.isGiftReceived);

  await sendMail({
    to: params.to,
    subject: isGiftReceived
      ? `You received ${params.tokensAdded} JobTokens — use by ${formatTokenExpiryDate(params.expiresAt)}`
      : `Thank you — ${params.tokensAdded} JobTokens added (expire ${formatTokenExpiryDate(params.expiresAt)})`,
    html: buildTokenPurchaseEmailHtml({
      fullName: params.fullName || "there",
      tokensAdded: params.tokensAdded,
      newBalance: params.newBalance,
      amountKes: params.amountKes,
      expiresAt: params.expiresAt,
      expiryDays,
      isGiftReceived,
      giftedByLabel: params.giftedByLabel,
      purchaseSource: params.purchaseSource,
      accountReactivated: params.accountReactivated,
      dashboardUrl: urls.dashboardUrl,
      portalUrl: urls.portalUrl,
    }),
  });
}

export async function sendTokenExpiryReminderEmail(params: {
  to: string;
  fullName: string | null;
  tokenBalance: number;
  expiresAt: string;
}): Promise<void> {
  const urls = appUrls();
  const reminderDays = getWalletTokenExpiryReminderDays();

  await sendMail({
    to: params.to,
    subject: `Reminder: your JobTokens expire in ${reminderDays} days`,
    html: buildTokenExpiryReminderEmailHtml({
      fullName: params.fullName || "there",
      tokenBalance: params.tokenBalance,
      expiresAt: params.expiresAt,
      reminderDays,
      dashboardUrl: urls.dashboardUrl,
      portalUrl: urls.portalUrl,
    }),
  });
}

export async function notifyTokenWalletCredited(
  supabaseAdmin: SupabaseClient,
  params: {
    recipientUserId: string;
    tokensAdded: number;
    newBalance: number;
    expiresAt: string;
    amountKes?: number | null;
    isGiftReceived?: boolean;
    giftedByUserId?: string | null;
    purchaseSource?: "mpesa" | "earnings" | "simulate";
    accountReactivated?: boolean;
  }
): Promise<void> {
  const { data: recipient } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name")
    .eq("id", params.recipientUserId)
    .maybeSingle();

  if (!recipient?.email) return;

  let giftedByLabel: string | null = null;
  if (params.isGiftReceived && params.giftedByUserId) {
    const { data: giver } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", params.giftedByUserId)
      .maybeSingle();
    giftedByLabel = giver?.full_name || giver?.email || null;
  }

  await sendTokenPurchaseEmail({
    to: recipient.email,
    fullName: recipient.full_name,
    tokensAdded: params.tokensAdded,
    newBalance: params.newBalance,
    amountKes: params.amountKes,
    expiresAt: params.expiresAt,
    isGiftReceived: params.isGiftReceived,
    giftedByLabel,
    purchaseSource: params.purchaseSource,
    accountReactivated: params.accountReactivated,
  });
}
