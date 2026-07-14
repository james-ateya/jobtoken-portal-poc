import { sendMail } from "./mail.js";

const SUPPORT_FROM = {
  address: process.env.SUPPORT_FROM_ADDRESS || "support@jobtoken.co.ke",
  name: process.env.SUPPORT_FROM_NAME || "JobToken Support",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTicketConfirmationHtml(params: {
  name: string;
  ticketNumber: string;
  subject: string;
  trackUrl: string;
}): string {
  const name = escapeHtml(params.name);
  const ticket = escapeHtml(params.ticketNumber);
  const subject = escapeHtml(params.subject);
  const trackUrl = escapeHtml(params.trackUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ticket received — JobToken Support</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#ecfdf5;font-weight:600;">JobToken Support</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">We've received your request</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">Hi ${name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
                Thank you for reaching out. Your support ticket has been created and our team has been notified.
              </p>

              <div style="padding:16px 18px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;margin:0 0 20px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#52525b;">Ticket number</p>
                <p style="margin:0;font-size:22px;line-height:1.4;color:#18181b;font-weight:700;letter-spacing:0.04em;">${ticket}</p>
                <p style="margin:10px 0 0;font-size:13px;color:#52525b;">
                  <strong>Subject:</strong> ${subject}
                </p>
              </div>

              <div style="padding:16px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;margin:0 0 20px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#92400e;">What happens next</p>
                <p style="margin:0;font-size:14px;line-height:1.65;color:#78350f;">
                  A member of our support team will review your ticket and respond within <strong>24 hours</strong>. You will receive an email notification when a response is posted.
                </p>
              </div>

              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#71717a;">
                You can check the status of your ticket or add more details at any time using the link below.
              </p>

              <p style="margin:0;text-align:center;">
                <a href="${trackUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Track Your Ticket</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Ticket ${ticket} &middot; <a href="${trackUrl}" style="color:#059669;text-decoration:none;">JobToken Support</a>
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

function buildTicketReplyHtml(params: {
  name: string;
  ticketNumber: string;
  subject: string;
  replyBody: string;
  newStatus: string | null;
  trackUrl: string;
}): string {
  const name = escapeHtml(params.name);
  const ticket = escapeHtml(params.ticketNumber);
  const subject = escapeHtml(params.subject);
  const reply = escapeHtml(params.replyBody).replace(/\n/g, "<br />");
  const trackUrl = escapeHtml(params.trackUrl);

  const statusLine = params.newStatus
    ? `<p style="margin:12px 0 0;font-size:13px;color:#059669;font-weight:600;">Status updated to: ${escapeHtml(params.newStatus.replace(/_/g, " "))}</p>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ticket update — JobToken Support</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#ecfdf5;font-weight:600;">JobToken Support</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">Update on your ticket</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">Hi ${name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
                Our support team has responded to your ticket <strong>${ticket}</strong>.
              </p>

              <div style="padding:16px 18px;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:12px;margin:0 0 20px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#52525b;">${subject}</p>
                <div style="margin:0;font-size:14px;line-height:1.65;color:#3f3f46;">${reply}</div>
                ${statusLine}
              </div>

              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#71717a;">
                You can view the full conversation and reply directly from the tracking page.
              </p>

              <p style="margin:0;text-align:center;">
                <a href="${trackUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">View Conversation</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Ticket ${ticket} &middot; <a href="${trackUrl}" style="color:#059669;text-decoration:none;">JobToken Support</a>
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

export async function sendTicketConfirmationEmail(params: {
  to: string;
  name: string | null;
  ticketNumber: string;
  subject: string;
}): Promise<void> {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const portalUrl = appUrl.includes("localhost") ? appUrl : "https://www.jobtoken.co.ke";
  const trackUrl = `${portalUrl}/support/track?ticket=${encodeURIComponent(params.ticketNumber)}&email=${encodeURIComponent(params.to)}`;

  await sendMail({
    to: params.to,
    subject: `Ticket ${params.ticketNumber}: ${params.subject} — JobToken Support`,
    html: buildTicketConfirmationHtml({
      name: params.name?.trim() || "there",
      ticketNumber: params.ticketNumber,
      subject: params.subject,
      trackUrl,
    }),
    from: SUPPORT_FROM,
  });
}

export async function sendTicketReplyEmail(params: {
  to: string;
  name: string | null;
  ticketNumber: string;
  subject: string;
  replyBody: string;
  newStatus: string | null;
}): Promise<void> {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const portalUrl = appUrl.includes("localhost") ? appUrl : "https://www.jobtoken.co.ke";
  const trackUrl = `${portalUrl}/support/track?ticket=${encodeURIComponent(params.ticketNumber)}&email=${encodeURIComponent(params.to)}`;

  await sendMail({
    to: params.to,
    subject: `Re: Ticket ${params.ticketNumber}: ${params.subject} — JobToken Support`,
    html: buildTicketReplyHtml({
      name: params.name?.trim() || "there",
      ticketNumber: params.ticketNumber,
      subject: params.subject,
      replyBody: params.replyBody,
      newStatus: params.newStatus,
      trackUrl,
    }),
    from: SUPPORT_FROM,
  });
}
