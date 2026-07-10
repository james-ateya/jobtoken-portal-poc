import nodemailer from "nodemailer";

export type SendMailParams = {
  to: string | string[];
  subject: string;
  html: string;
};

function resolveProvider(): "smtp" | "zeptomail" {
  const explicit = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (explicit === "smtp") return "smtp";
  if (explicit === "zeptomail") return "zeptomail";

  if (process.env.ZEPTOMAIL_TOKEN) return "zeptomail";

  const hasSmtp =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;
  if (hasSmtp) return "smtp";

  return "zeptomail";
}

async function sendViaZeptomail(
  recipients: string[],
  subject: string,
  html: string
): Promise<void> {
  const token = process.env.ZEPTOMAIL_TOKEN;
  if (!token) {
    throw new Error(
      "ZEPTOMAIL_TOKEN is required for email. Add it to .env or set EMAIL_PROVIDER=smtp with SMTP_* variables."
    );
  }

  const fromAddress = process.env.ZEPTOMAIL_FROM_ADDRESS || "admin@jobtoken.co.ke";
  const fromName = process.env.ZEPTOMAIL_FROM_NAME || "JobToken";

  const body = {
    from: { address: fromAddress, name: fromName },
    to: recipients.map((email) => ({
      email_address: { address: email },
    })),
    subject,
    htmlbody: html,
  };

  const res = await fetch("https://api.zeptomail.com/v1.1/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": token,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Zeptomail API error (${res.status}): ${errorBody}`);
  }
}

function createSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS are required when using SMTP (EMAIL_PROVIDER=smtp or no Zeptomail key)."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendMail({ to, subject, html }: SendMailParams): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to];
  const provider = resolveProvider();

  if (provider === "zeptomail") {
    await sendViaZeptomail(recipients, subject, html);
    return;
  }

  const from =
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    "JobToken <noreply@localhost>";

  const transport = createSmtpTransport();
  await transport.sendMail({
    from,
    to: recipients.join(", "),
    subject,
    html,
  });
}
