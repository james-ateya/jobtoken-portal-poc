function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatKes(value: number): string {
  return value.toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  });
}

export type DigestPrompt = {
  headline: string;
  submit_cost_tokens: number;
  reward_kes: number;
  series_title?: string | null;
};

function layout(params: {
  title: string;
  eyebrow: string;
  name: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  unsubscribeUrl: string;
  portalUrl: string;
}): string {
  const name = escapeHtml(params.name.trim() || "there");
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.title)} — JobToken</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#d1fae5;font-weight:600;">${escapeHtml(params.eyebrow)}</p>
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;">${escapeHtml(params.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#3f3f46;">Hi ${name},</p>
              ${params.bodyHtml}
              <p style="margin:28px 0 0;text-align:center;">
                <a href="${escapeHtml(params.ctaUrl)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">${escapeHtml(params.ctaLabel)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:#a1a1aa;">
                <a href="${escapeHtml(params.portalUrl)}" style="color:#059669;text-decoration:none;">JobToken Portal</a>
              </p>
              <p style="margin:0;font-size:11px;line-height:1.5;color:#a1a1aa;">
                You’re receiving this because you have a JobToken seeker account.
                <a href="${escapeHtml(params.unsubscribeUrl)}" style="color:#71717a;">Unsubscribe from these emails</a>
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

function promptCardsHtml(prompts: DigestPrompt[]): string {
  if (!prompts.length) return "";
  const rows = prompts
    .map((p) => {
      const series = p.series_title
        ? `<p style="margin:0 0 4px;font-size:11px;color:#71717a;text-transform:uppercase;letter-spacing:0.06em;">${escapeHtml(p.series_title)}</p>`
        : "";
      return `<div style="margin:0 0 10px;padding:14px 16px;background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;">
        ${series}
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#18181b;line-height:1.4;">${escapeHtml(p.headline)}</p>
        <p style="margin:0;font-size:13px;color:#3f3f46;">
          <strong>${Number(p.submit_cost_tokens) || 0} tokens</strong>
          · earn up to <strong>${formatKes(Number(p.reward_kes) || 0)} KES</strong>
        </p>
      </div>`;
    })
    .join("");
  return `<div style="margin:18px 0 0;">${rows}</div>`;
}

export function buildWeeklyDigestHtml(params: {
  fullName: string;
  segment: "A" | "B";
  prompts: DigestPrompt[];
  earningsKes?: number;
  minWithdrawKes?: number;
  ctaUrl: string;
  unsubscribeUrl: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const isA = params.segment === "A";
  const subject = isA
    ? "This week’s Starter prompts — earn KES on JobToken"
    : `You’re at ${formatKes(params.earningsKes ?? 0)} KES — keep going on JobToken`;

  const progress =
    !isA && params.minWithdrawKes
      ? `<div style="margin:16px 0 0;padding:14px 16px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;">
          <p style="margin:0;font-size:14px;color:#065f46;line-height:1.55;">
            Earnings balance: <strong>${formatKes(params.earningsKes ?? 0)} KES</strong>
            · Withdraw from <strong>${formatKes(params.minWithdrawKes)} KES</strong>
          </p>
        </div>`
      : "";

  const lead = isA
    ? `<p style="margin:0;font-size:15px;line-height:1.65;color:#3f3f46;">
        Fresh prompt tasks are live. Start with a low-token <strong>Starter</strong> task — top up a small pack and try one this week.
      </p>`
    : `<p style="margin:0;font-size:15px;line-height:1.65;color:#3f3f46;">
        You’re already earning on JobToken. Here are live prompts that can help you move closer to withdrawal.
      </p>`;

  const html = layout({
    title: isA ? "Prompts waiting for you" : "Keep building your earnings",
    eyebrow: "Weekly digest",
    name: params.fullName,
    bodyHtml: `${lead}${progress}${promptCardsHtml(params.prompts)}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.55;color:#71717a;">
        Tip: Starter tasks cost fewer tokens and are a great way to stay active.
      </p>`,
    ctaLabel: isA ? "Top up & browse prompts" : "Open prompt tasks",
    ctaUrl: params.ctaUrl,
    unsubscribeUrl: params.unsubscribeUrl,
    portalUrl: params.portalUrl,
  });

  return { subject, html };
}

export function buildNoTopupHtml(params: {
  fullName: string;
  prompts: DigestPrompt[];
  daysSinceSignup: number;
  ctaUrl: string;
  unsubscribeUrl: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const subject =
    params.daysSinceSignup >= 9
      ? "Still curious about JobToken? Try one Starter prompt"
      : "Your JobToken account is ready — try a Starter prompt";

  const html = layout({
    title: "Start with one small task",
    eyebrow: "Quick nudge",
    name: params.fullName,
    bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.65;color:#3f3f46;">
        You created a JobToken account but haven’t topped up yet. Top up a small amount, pick a Starter prompt, and see how earning works.
      </p>
      ${promptCardsHtml(params.prompts)}`,
    ctaLabel: "Top up & try a prompt",
    ctaUrl: params.ctaUrl,
    unsubscribeUrl: params.unsubscribeUrl,
    portalUrl: params.portalUrl,
  });

  return { subject, html };
}

export function buildNearWithdrawHtml(params: {
  fullName: string;
  earningsKes: number;
  minWithdrawKes: number;
  prompts: DigestPrompt[];
  ctaUrl: string;
  unsubscribeUrl: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const remaining = Math.max(0, params.minWithdrawKes - params.earningsKes);
  const subject = `${formatKes(remaining)} KES to go — you’re close to withdrawing`;

  const html = layout({
    title: "You’re close to withdrawal",
    eyebrow: "Earnings update",
    name: params.fullName,
    bodyHtml: `<div style="margin:0 0 16px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
        <p style="margin:0;font-size:14px;color:#92400e;line-height:1.55;">
          Balance: <strong>${formatKes(params.earningsKes)} KES</strong>
          · Need <strong>${formatKes(params.minWithdrawKes)} KES</strong> to withdraw
          · About <strong>${formatKes(remaining)} KES</strong> to go
        </p>
      </div>
      <p style="margin:0;font-size:15px;line-height:1.65;color:#3f3f46;">
        A few more passed prompts can get you there. Here are tasks live right now:
      </p>
      ${promptCardsHtml(params.prompts)}`,
    ctaLabel: "Continue earning",
    ctaUrl: params.ctaUrl,
    unsubscribeUrl: params.unsubscribeUrl,
    portalUrl: params.portalUrl,
  });

  return { subject, html };
}

export function buildAfterFailHtml(params: {
  fullName: string;
  promptHeadline: string;
  prompts: DigestPrompt[];
  ctaUrl: string;
  unsubscribeUrl: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const subject = "Try another prompt — you’ve got this";
  const html = layout({
    title: "Ready for another try?",
    eyebrow: "After review",
    name: params.fullName,
    bodyHtml: `<p style="margin:0;font-size:15px;line-height:1.65;color:#3f3f46;">
        Your answer for <strong>${escapeHtml(params.promptHeadline)}</strong> didn’t pass this time.
        That’s normal — many seekers improve quickly on the next Starter task. Pick a fresh one below.
      </p>
      ${promptCardsHtml(params.prompts)}`,
    ctaLabel: "Browse Starter prompts",
    ctaUrl: params.ctaUrl,
    unsubscribeUrl: params.unsubscribeUrl,
    portalUrl: params.portalUrl,
  });

  return { subject, html };
}
