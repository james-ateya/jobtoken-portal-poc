import { sendMail } from "./mail.js";

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
    loginUrl: `${appUrl}/login`,
    dashboardUrl: `${appUrl}/dashboard`,
    portalUrl,
  };
}

function buildRegretEmailHtml(params: {
  fullName: string;
  reason: "deactivated" | "deleted" | "blacklisted";
  loginUrl: string;
  dashboardUrl: string;
  portalUrl: string;
  adminNote?: string | null;
}): string {
  const name = escapeHtml(params.fullName.trim() || "there");
  const loginUrl = escapeHtml(params.loginUrl);
  const dashboardUrl = escapeHtml(params.dashboardUrl);
  const portalUrl = escapeHtml(params.portalUrl);
  const adminNote = params.adminNote?.trim()
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#52525b;background:#f4f4f5;border-radius:8px;padding:12px 14px;">
        <strong>Note from our team:</strong> ${escapeHtml(params.adminNote.trim())}
      </p>`
    : "";

  const title =
    params.reason === "deleted"
      ? "Your JobToken account was removed"
      : params.reason === "blacklisted"
        ? "Your JobToken access has been permanently revoked"
        : "Your JobToken account is paused";
  const lead =
    params.reason === "deleted"
      ? "Your JobToken account has been permanently removed from our platform at an administrator's request."
      : params.reason === "blacklisted"
        ? "Your email address has been permanently blocked from JobToken. You will not be able to sign in, register again with this email, or use the platform in the future."
        : "Your JobToken account has been deactivated and you will not have full access until it is restored.";

  const bodyExtra =
    params.reason === "blacklisted"
      ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
          If you believe this decision was made in error, you may contact our support team to appeal.
          Access cannot be restored through wallet top-up or token gifts.
        </p>`
      : params.reason === "deleted"
        ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
          If you wish to return, please register again with a different email address,
          then complete a token top-up to activate your membership.
        </p>`
        : `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
          We would be glad to welcome you back. You can restore access by purchasing JobTokens
          via M-Pesa on your wallet — or by receiving a token gift from another member.
          Once tokens are credited, your account will be reactivated automatically.
        </p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
          Sign in with your existing email and password, then top up your wallet to reactivate.
        </p>`;

  const ctaHref =
    params.reason === "deleted" ? loginUrl : params.reason === "blacklisted" ? portalUrl : dashboardUrl;
  const ctaLabel =
    params.reason === "deleted"
      ? "Return to JobToken"
      : params.reason === "blacklisted"
        ? "Visit JobToken"
        : "Open my wallet";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#52525b 0%,#3f3f46 100%);padding:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#e4e4e7;font-weight:600;">JobToken</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#3f3f46;">Dear ${name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">${lead}</p>
              ${adminNote}
              ${bodyExtra}
              <p style="margin:24px 0;text-align:center;">
                <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">
                  ${ctaLabel}
                </a>
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#71717a;text-align:center;">
                If you believe this was a mistake, reply to this email or contact our support team.
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

export async function sendAccountRegretEmail(params: {
  to: string;
  fullName: string | null;
  reason: "deactivated" | "deleted" | "blacklisted";
  adminNote?: string | null;
}): Promise<void> {
  const urls = appUrls();
  const subject =
    params.reason === "deleted"
      ? "We're sorry to see you go — JobToken"
      : params.reason === "blacklisted"
        ? "Your JobToken access has been permanently revoked"
        : "Your JobToken account has been paused";

  await sendMail({
    to: params.to,
    subject,
    html: buildRegretEmailHtml({
      fullName: params.fullName || "there",
      reason: params.reason,
      loginUrl: urls.loginUrl,
      dashboardUrl: urls.dashboardUrl,
      portalUrl: urls.portalUrl,
      adminNote: params.adminNote,
    }),
  });
}
