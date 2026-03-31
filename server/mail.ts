import nodemailer from "nodemailer";
import { Resend } from "resend";

export type SendMailParams = {
  to: string | string[];
  subject: string;
  html: string;
};

/**
 * JobToken uses Resend by default when RESEND_API_KEY is set.
 * Set EMAIL_PROVIDER=smtp to use Nodemailer instead (full SMTP_* config required).
 */
function resolveProvider(): "smtp" | "resend" {
  const explicit = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (explicit === "smtp") return "smtp";
  if (explicit === "resend") return "resend";

  if (process.env.RESEND_API_KEY) return "resend";

  const hasSmtp =
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS;
  if (hasSmtp) return "smtp";

  return "resend";
}

let resendSingleton: Resend | null = null;

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is required for email. Add it to .env or set EMAIL_PROVIDER=smtp with SMTP_* variables."
    );
  }
  if (!resendSingleton) {
    resendSingleton = new Resend(process.env.RESEND_API_KEY);
  }
  return resendSingleton;
}

function createSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS are required when using SMTP (EMAIL_PROVIDER=smtp or no Resend key)."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Sends transactional email via Resend (default when RESEND_API_KEY is set) or SMTP.
 */
export async function sendMail({ to, subject, html }: SendMailParams): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to];
  const provider = resolveProvider();

  if (provider === "resend") {
    const from =
      process.env.RESEND_FROM ||
      process.env.EMAIL_FROM ||
      process.env.SMTP_FROM ||
      "JobToken <onboarding@resend.dev>";

    const resend = getResend();
    const { error } = await resend.emails.send({
      from,
      to: recipients,
      subject,
      html,
    });
    if (error) throw error;
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
