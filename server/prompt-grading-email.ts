import { sendMail } from "./mail.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatKes(value: number): string {
  return value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildPromptGradingEmailHtml(params: {
  fullName: string;
  grade: "pass" | "fail";
  promptHeadline: string;
  seriesTitle: string | null;
  rewardKes: number;
  earningsAdjustmentKes: number;
  gradingNote: string | null;
  earningsUrl: string;
  portalUrl: string;
}): string {
  const name = escapeHtml(params.fullName.trim() || "there");
  const headline = escapeHtml(params.promptHeadline || "Prompt task");
  const series = escapeHtml(params.seriesTitle || "Prompt series");
  const portalUrl = escapeHtml(params.portalUrl);
  const earningsUrl = escapeHtml(params.earningsUrl);
  const passed = params.grade === "pass";
  const note = params.gradingNote?.trim() ?? "";

  const headerGradient = passed
    ? "linear-gradient(135deg,#059669 0%,#047857 100%)"
    : "linear-gradient(135deg,#b91c1c 0%,#991b1b 100%)";
  const outcomeBg = passed ? "#ecfdf5" : "#fef2f2";
  const outcomeBorder = passed ? "#bbf7d0" : "#fecaca";
  const outcomeTitle = passed ? "Your answer was approved" : "Your answer needs improvement";
  const outcomeLead = passed
    ? `Congratulations — your response to <strong>${headline}</strong> met our quality bar.`
    : `Thank you for submitting a response to <strong>${headline}</strong>. This attempt did not meet the pass criteria.`;

  const rewardBlock =
    passed && params.rewardKes > 0
      ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
          ${
            params.earningsAdjustmentKes > 0
              ? `<strong>${formatKes(params.earningsAdjustmentKes)} KES</strong> has been added to your earnings balance.`
              : `Your earnings for this prompt remain credited at <strong>${formatKes(params.rewardKes)} KES</strong>.`
          }
        </p>`
      : "";

  const reversalBlock =
    !passed && params.earningsAdjustmentKes < 0
      ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">
          A previous reward of <strong>${formatKes(Math.abs(params.earningsAdjustmentKes))} KES</strong> has been reversed from your earnings balance.
        </p>`
      : "";

  const noteBlock = note
    ? `<div style="margin:20px 0 0;padding:16px 18px;background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">Reviewer feedback</p>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#3f3f46;white-space:pre-wrap;">${escapeHtml(note)}</p>
      </div>`
    : `<p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#71717a;">
        Keep engaging with prompt tasks — every submission helps you build skill and confidence on JobToken.
      </p>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Prompt review — JobToken</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:${headerGradient};padding:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#ecfdf5;font-weight:600;">JobToken prompt review</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">${outcomeTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#3f3f46;">Hi ${name},</p>
              <div style="padding:16px 18px;background:${outcomeBg};border:1px solid ${outcomeBorder};border-radius:12px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#52525b;">${series}</p>
                <p style="margin:0;font-size:15px;line-height:1.6;color:#18181b;">${outcomeLead}</p>
                ${rewardBlock}
                ${reversalBlock}
              </div>
              ${noteBlock}
              <p style="margin:24px 0;text-align:center;">
                <a href="${earningsUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">View your earnings</a>
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

export async function sendPromptGradingEmail(params: {
  to: string;
  fullName: string | null;
  grade: "pass" | "fail";
  promptHeadline: string;
  seriesTitle: string | null;
  rewardKes: number;
  earningsAdjustmentKes: number;
  gradingNote: string | null;
}): Promise<void> {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const portalUrl = appUrl.includes("localhost") ? appUrl : "https://www.jobtoken.co.ke";
  const earningsUrl = `${appUrl}/earnings`;

  await sendMail({
    to: params.to,
    subject:
      params.grade === "pass"
        ? `Approved: ${params.promptHeadline || "Prompt task"} — JobToken`
        : `Review feedback: ${params.promptHeadline || "Prompt task"} — JobToken`,
    html: buildPromptGradingEmailHtml({
      fullName: params.fullName || "there",
      grade: params.grade,
      promptHeadline: params.promptHeadline,
      seriesTitle: params.seriesTitle,
      rewardKes: params.rewardKes,
      earningsAdjustmentKes: params.earningsAdjustmentKes,
      gradingNote: params.gradingNote,
      earningsUrl,
      portalUrl,
    }),
  });
}
