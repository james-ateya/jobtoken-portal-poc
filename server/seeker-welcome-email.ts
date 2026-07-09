import { sendMail } from "./mail.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSeekerWelcomeEmailHtml(params: {
  fullName: string;
  dashboardUrl: string;
  portalUrl: string;
}): string {
  const name = escapeHtml(params.fullName.trim() || "there");
  const dashboardUrl = escapeHtml(params.dashboardUrl);
  const portalUrl = escapeHtml(params.portalUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to JobToken Solutions</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:32px 28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#d1fae5;font-weight:600;">JobToken Solutions</p>
              <h1 style="margin:0;font-size:26px;line-height:1.3;color:#ffffff;font-weight:700;">Welcome home, ${name}!</h1>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.5;color:#ecfdf5;">Your job seeker account is verified. You&apos;re officially part of the JobToken community.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
                Thank you for joining <strong>JobToken Portal</strong> at
                <a href="${portalUrl}" style="color:#059669;text-decoration:none;">${portalUrl}</a>.
                We built JobToken Solutions to make your job search clearer, faster, and more rewarding —
                whether you are starting out, changing careers, or looking for your next opportunity in Kenya and beyond.
              </p>

              <h2 style="margin:24px 0 12px;font-size:17px;color:#18181b;">What JobToken offers you</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;margin-bottom:10px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#065f46;">Curated job opportunities</p>
                    <p style="margin:0;font-size:14px;line-height:1.55;color:#3f3f46;">Browse real openings from employers on our platform. Filter by profession, job type, and area of focus to find roles that fit you.</p>
                  </td>
                </tr>
                <tr><td style="height:10px;"></td></tr>
                <tr>
                  <td style="padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#065f46;">Simple applications with JobTokens</p>
                    <p style="margin:0;font-size:14px;line-height:1.55;color:#3f3f46;">Top up your wallet securely via M-Pesa, then apply to jobs in a few clicks. Track every application and follow employer updates in one place.</p>
                  </td>
                </tr>
                <tr><td style="height:10px;"></td></tr>
                <tr>
                  <td style="padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#065f46;">A profile that works for you</p>
                    <p style="margin:0;font-size:14px;line-height:1.55;color:#3f3f46;">Add your education, experience, skills, and profession so we can alert you when new listings match your field.</p>
                  </td>
                </tr>
                <tr><td style="height:10px;"></td></tr>
                <tr>
                  <td style="padding:12px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
                    <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#065f46;">Earn while you engage</p>
                    <p style="margin:0;font-size:14px;line-height:1.55;color:#3f3f46;">Take part in skill-based prompt tasks, build your track record, and earn KES rewards when your responses are approved.</p>
                  </td>
                </tr>
              </table>

              <h2 style="margin:24px 0 12px;font-size:17px;color:#18181b;">Your first steps</h2>
              <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#3f3f46;">
                <li>Complete your seeker profile — especially your profession or field of study.</li>
                <li>Explore open jobs and save the ones that interest you.</li>
                <li>Top up JobTokens via M-Pesa when you are ready to apply.</li>
                <li>Submit applications and watch for status updates from employers.</li>
              </ol>

              <p style="margin:24px 0;text-align:center;">
                <a href="${dashboardUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Go to your dashboard</a>
              </p>

              <p style="margin:0;font-size:14px;line-height:1.6;color:#71717a;text-align:center;">
                We are glad you are here. JobToken is more than a job board — it is a place to grow, connect, and move forward with confidence.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#a1a1aa;">JobToken Solutions · Digital recruitment &amp; professional engagement</p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                <a href="${portalUrl}" style="color:#059669;text-decoration:none;">${portalUrl}</a>
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

export async function sendSeekerWelcomeEmail(params: {
  to: string;
  fullName: string;
}): Promise<void> {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const dashboardUrl = `${appUrl}/dashboard`;
  const portalUrl = appUrl.includes("localhost") ? appUrl : "https://www.jobtoken.co.ke";

  await sendMail({
    to: params.to,
    subject: "Welcome to JobToken Solutions — your account is ready",
    html: buildSeekerWelcomeEmailHtml({
      fullName: params.fullName,
      dashboardUrl,
      portalUrl,
    }),
  });
}
