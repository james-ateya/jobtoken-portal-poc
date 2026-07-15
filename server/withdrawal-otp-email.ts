import { sendMail } from "./mail.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPhone(phone: string): string {
  if (phone.startsWith("254") && phone.length === 12) {
    return `0${phone.slice(3)}`;
  }
  return phone;
}

function buildWithdrawalOtpHtml(params: {
  otp: string;
  amountKes: string;
  phone: string;
}): string {
  const otp = escapeHtml(params.otp);
  const amount = escapeHtml(params.amountKes);
  const phone = escapeHtml(formatPhone(params.phone));

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirm Your Withdrawal — JobToken</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#ecfdf5;font-weight:600;">JobToken</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">Confirm Your Withdrawal</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#3f3f46;">
                Use the code below to confirm your withdrawal request of <strong>KES ${amount}</strong> to M-Pesa number <strong>${phone}</strong>.
              </p>

              <div style="padding:20px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;margin:0 0 20px;text-align:center;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#52525b;">Verification code</p>
                <p style="margin:0;font-size:32px;font-weight:bold;letter-spacing:0.3em;font-family:ui-monospace,monospace;color:#18181b;">${otp}</p>
              </div>

              <div style="padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;margin:0 0 20px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#78350f;">
                  This code expires in <strong>15 minutes</strong>. If you did not request this withdrawal, please ignore this email.
                </p>
              </div>

              <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">
                After verification, your withdrawal request will be submitted for processing by the platform team.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#fafafa;border-top:1px solid #e4e4e7;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                JobToken &middot; Withdrawal Confirmation
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

export async function sendWithdrawalOtpEmail(params: {
  to: string;
  otp: string;
  amountKes: number;
  phone: string;
}): Promise<void> {
  const amountFormatted = params.amountKes.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  await sendMail({
    to: params.to,
    subject: `Withdrawal Confirmation Code — KES ${amountFormatted} to ${formatPhone(params.phone)}`,
    html: buildWithdrawalOtpHtml({
      otp: params.otp,
      amountKes: amountFormatted,
      phone: params.phone,
    }),
  });
}
