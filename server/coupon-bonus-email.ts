import { sendMail } from "./mail.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDeadline(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleString("en-KE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });
}

export function buildCouponBonusEmailHtml(params: {
  fullName: string;
  bonusTokens: number;
  expiresAt: string;
  minTopupKes: number;
  dashboardUrl: string;
  portalUrl: string;
}): string {
  const name = escapeHtml(params.fullName.trim() || "there");
  const dashboardUrl = escapeHtml(params.dashboardUrl);
  const portalUrl = escapeHtml(params.portalUrl);
  const deadline = escapeHtml(formatDeadline(params.expiresAt));

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Claim your free JobTokens</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#d97706 0%,#b45309 100%);padding:32px 28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#fef3c7;font-weight:600;">JobToken Solutions</p>
              <h1 style="margin:0;font-size:26px;line-height:1.3;color:#ffffff;font-weight:700;">You have ${params.bonusTokens} free tokens waiting!</h1>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#fef9c3;">Top up your wallet to claim your referral bonus.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
                Hi ${name}, congratulations on joining <strong>JobToken Portal</strong> through a referral!
                As a welcome gift, you have <strong>${params.bonusTokens} bonus tokens</strong> reserved for you.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
                    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#92400e;">How to claim your bonus</p>
                    <p style="margin:0;font-size:14px;line-height:1.6;color:#78350f;">
                      Top up your wallet with at least <strong>Ksh ${params.minTopupKes}</strong> via M-Pesa
                      before <strong>${deadline}</strong> and your
                      <strong>${params.bonusTokens} bonus tokens</strong> will be automatically added
                      to your balance on top of the tokens you purchased.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0;text-align:center;">
                <a href="${dashboardUrl}" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Go to your dashboard</a>
              </p>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#a1a1aa;text-align:center;">
                Bonus tokens are awarded once on your first qualifying top-up within the referral window.
                If the window expires, you can still top up normally via M-Pesa.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#a1a1aa;">JobToken Solutions &middot; Digital recruitment &amp; professional engagement</p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                <a href="${portalUrl}" style="color:#d97706;text-decoration:none;">${portalUrl}</a>
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

export async function sendCouponBonusEmail(params: {
  to: string;
  fullName: string;
  bonusTokens: number;
  expiresAt: string;
  minTopupKes: number;
}): Promise<void> {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const dashboardUrl = `${appUrl}/dashboard`;
  const portalUrl = appUrl.includes("localhost") ? appUrl : "https://www.jobtoken.co.ke";

  await sendMail({
    to: params.to,
    subject: `You have ${params.bonusTokens} free JobTokens waiting — top up to claim them`,
    html: buildCouponBonusEmailHtml({
      fullName: params.fullName,
      bonusTokens: params.bonusTokens,
      expiresAt: params.expiresAt,
      minTopupKes: params.minTopupKes,
      dashboardUrl,
      portalUrl,
    }),
  });
}
