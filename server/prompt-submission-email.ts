import { sendMail } from "./mail.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSubmissionConfirmationHtml(params: {
  fullName: string;
  promptHeadline: string;
  seriesTitle: string | null;
  wordCount: number;
  tokensCharged: number;
  portalUrl: string;
}): string {
  const name = escapeHtml(params.fullName.trim() || "there");
  const headline = escapeHtml(params.promptHeadline || "Prompt task");
  const series = escapeHtml(params.seriesTitle || "Prompt series");
  const portalUrl = escapeHtml(params.portalUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Submission received — JobToken</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#ecfdf5;font-weight:600;">JobToken</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">Submission received</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">Hi ${name},</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
                Thank you for submitting your response. We have received your answer and it is now in our review queue.
              </p>

              <div style="padding:16px 18px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;margin:0 0 20px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#52525b;">${series}</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#18181b;font-weight:600;">${headline}</p>
                <p style="margin:8px 0 0;font-size:13px;color:#52525b;">
                  ${params.wordCount} word${params.wordCount === 1 ? "" : "s"} &middot; ${params.tokensCharged} token${params.tokensCharged === 1 ? "" : "s"} charged
                </p>
              </div>

              <div style="padding:16px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;margin:0 0 20px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#92400e;">What happens next</p>
                <p style="margin:0;font-size:14px;line-height:1.65;color:#78350f;">
                  Our review team will evaluate your submission within <strong>24 hours</strong>, depending on current volume. You will receive a separate email once the review is complete with the outcome and any feedback.
                </p>
              </div>

              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#71717a;">
                In the meantime, feel free to explore and attempt other prompt tasks on the portal. Each quality submission strengthens your profile.
              </p>

              <p style="margin:0;text-align:center;">
                <a href="${portalUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">Go to JobToken Portal</a>
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

export async function sendPromptSubmissionEmail(params: {
  to: string;
  fullName: string | null;
  promptHeadline: string;
  seriesTitle: string | null;
  wordCount: number;
  tokensCharged: number;
}): Promise<void> {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const portalUrl = appUrl.includes("localhost") ? appUrl : "https://www.jobtoken.co.ke";

  await sendMail({
    to: params.to,
    subject: `Submission received: ${params.promptHeadline || "Prompt task"} — JobToken`,
    html: buildSubmissionConfirmationHtml({
      fullName: params.fullName || "there",
      promptHeadline: params.promptHeadline,
      seriesTitle: params.seriesTitle,
      wordCount: params.wordCount,
      tokensCharged: params.tokensCharged,
      portalUrl,
    }),
  });
}
