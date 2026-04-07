import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  generateSixDigitOtp,
  hashPasswordResetOtp,
  normalizeEmail,
} from "./password-reset-otp.js";
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-env.js";
import { sendMail } from "./mail.js";
import {
  getKesPerToken,
  getTokenPacks,
  getTopupKesBounds,
  initiateStkPush,
  normalizeKenyaPhone,
  parseStkCallbackBody,
  resolveTokensForTopupKes,
  type StkCallbackParsed,
} from "./mpesa.js";
import { processStkCallback } from "./process-stk-callback.js";
import {
  requireAdmin,
  requireApprovedEmployer,
  requireAuth,
  requireEmployer,
  requireSeeker,
  type AuthedRequest,
} from "./auth.js";

const { loadedFiles } = loadProjectEnv();
if (process.env.NODE_ENV !== "production" && loadedFiles.length) {
  console.log("[jobtoken] Loaded env from:", loadedFiles.join(", "));
}

const app = express();

// Vercel often forwards /api/* to the function with url like /mpesa/callback (no /api prefix).
if (process.env.VERCEL) {
  app.use((req, _res, next) => {
    const raw = req.url ?? "/";
    const q = raw.indexOf("?");
    const pathOnly = q === -1 ? raw : raw.slice(0, q);
    const query = q === -1 ? "" : raw.slice(q);
    const needsApi =
      pathOnly &&
      pathOnly !== "/" &&
      !pathOnly.startsWith("/api/") &&
      pathOnly !== "/api" &&
      /^\/(auth|token-packs|topup|mpesa|applications|employer|admin|prompts|earnings|health|monitoring)\b/.test(
        pathOnly
      );
    if (needsApi) {
      req.url = "/api" + pathOnly + query;
    }
    next();
  });
}

app.use(express.json());
app.use(cors());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    uptime_s: Math.floor((Date.now() - serverStartedAt) / 1000),
  });
});

app.get("/api/monitoring", (_req, res) => {
  const m = process.memoryUsage();
  res.json({
    ok: true,
    uptime_s: Math.floor((Date.now() - serverStartedAt) / 1000),
    memory_mb: Math.round((m.heapUsed / 1024 / 1024) * 100) / 100,
    rss_mb: Math.round((m.rss / 1024 / 1024) * 100) / 100,
    node: process.version,
    env: process.env.NODE_ENV || "development",
  });
});

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const requireAuthMw = requireAuth(supabaseAdmin);
const requireAdminMw = requireAdmin(supabaseAdmin);
const requireSeekerMw = requireSeeker(supabaseAdmin);
const requireEmployerMw = requireEmployer(supabaseAdmin);
const requireApprovedEmployerMw = requireApprovedEmployer(supabaseAdmin);

const serverStartedAt = Date.now();

/** Job listing profession (DB column jobs.area_of_business). Accept either key from the client. */
function readJobProfessionField(body: Record<string, unknown>): string | null {
  const raw = body.area_of_business ?? body.profession_sought;
  if (raw === undefined || raw === null) return null;
  const s = typeof raw === "string" ? raw : String(raw);
  const t = s.trim();
  return t.length > 0 ? t : null;
}

/**
 * Vercel / some proxies may leave req.body as a string or Buffer; express.json() usually parses JSON.
 */
function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function parseJsonBody(req: { body?: unknown }): Record<string, unknown> {
  const b = req.body;
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString("utf8")) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (b != null && typeof b === "object" && !Array.isArray(b)) {
    return b as Record<string, unknown>;
  }
  return {};
}

function walletTokensNotExpired(expiresAt: string | null | undefined): boolean {
  if (expiresAt == null || expiresAt === "") return true;
  return new Date(expiresAt).getTime() >= Date.now();
}

async function getFeatureJobTokens(): Promise<number> {
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("value_int")
    .eq("key", "feature_job_tokens")
    .maybeSingle();
  const n = data?.value_int;
  if (typeof n === "number" && Number.isFinite(n) && n >= 0) return Math.floor(n);
  return Math.max(0, parseInt(process.env.FEATURE_JOB_TOKENS || "2", 10) || 0);
}

async function ensureWallet(userId: string) {
  let { data: wallet, error: walletError } = await supabaseAdmin
    .from("wallets")
    .select("id, token_balance, expires_at")
    .eq("user_id", userId)
    .single();

  if (walletError && walletError.code === "PGRST116") {
    const { data: newWallet, error: createError } = await supabaseAdmin
      .from("wallets")
      .insert({ user_id: userId, token_balance: 0 })
      .select()
      .single();
    if (createError) throw createError;
    wallet = newWallet;
  } else if (walletError) {
    throw walletError;
  }
  if (!wallet) throw new Error("Wallet could not be initialized");
  return wallet;
}

function countWordsAnswer(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

async function getEarningsBalanceKes(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("earnings_ledger")
    .select("amount_kes")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).reduce((acc, row) => acc + Number(row.amount_kes || 0), 0);
}

/** Withdrawal requests allowed from this calendar day of month onward (default 25). */
function isWithdrawalWindowNow(): boolean {
  const minDay = Math.max(
    1,
    Math.min(28, parseInt(process.env.EARNINGS_WITHDRAWAL_DAY_MIN || "25", 10) || 25)
  );
  return new Date().getDate() >= minDay;
}

// --- Auth / email ---
app.post("/api/auth/resend-verification", async (req, res) => {
  const { email, type, jobId } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    if (type === "application_confirmation") {
      const { data: job } = await supabaseAdmin
        .from("jobs")
        .select("title")
        .eq("id", jobId)
        .single();

      await sendMail({
        to: email,
        subject: `Application confirmed: ${job?.title || "Job"}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #10b981;">Application received</h2>
            <p>Your application for <strong>${job?.title || "the position"}</strong> was submitted successfully.</p>
            <p>If the employer has notifications enabled, they have been alerted to review your application.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">Thank you for using JobToken.</p>
          </div>
        `,
      });
      return res.json({ success: true });
    }

    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: `${process.env.APP_URL || "http://localhost:3000"}/`,
      },
    });

    if (linkError) throw linkError;

    const verificationLink = data.properties.action_link;

    await sendMail({
      to: email,
      subject: "Verify your JobToken account",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10b981;">Welcome to JobToken</h2>
          <p>Please verify your email to start applying for jobs.</p>
          <a href="${verificationLink}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0;">Verify email</a>
          <p style="color: #666; font-size: 14px;">If the button does not work, copy this link:</p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">${verificationLink}</p>
        </div>
      `,
    });

    res.json({ success: true, message: "Verification email sent" });
  } catch (error: any) {
    console.error("Mail error:", error);
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
});

// --- Token packs (public) ---
app.get("/api/token-packs", (_req, res) => {
  const bounds = getTopupKesBounds();
  res.json({
    packs: getTokenPacks(),
    kesPerToken: bounds.kesPerToken,
    minTopupKes: bounds.min,
    maxTopupKes: bounds.max,
  });
});

/** Public pricing hints for employer UI (featured listing cost from admin settings). */
app.get("/api/employer/pricing", async (_req, res) => {
  try {
    const featureJobTokens = await getFeatureJobTokens();
    const postingFeeTokens = Math.max(
      0,
      parseInt(process.env.EMPLOYER_POSTING_FEE_TOKENS || "0", 10) || 0
    );
    res.json({ featureJobTokens, postingFeeTokens });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Simulated top-up (dev / fallback) ---
app.post("/api/topup", requireAuthMw, async (req, res) => {
  const userId = (req as AuthedRequest).authUserId;

  if (process.env.MPESA_SIMULATE !== "true") {
    return res.status(400).json({
      error:
        "Simulated top-up disabled. Use M-Pesa STK from the wallet or set MPESA_SIMULATE=true for local testing.",
    });
  }

  try {
    const wallet = await ensureWallet(userId);
    const refId = `SIM-${Math.random().toString(36).toUpperCase().slice(2, 10)}`;
    const pack = getTokenPacks()[0] || { kes: 100, tokens: 5 };

    const { error: insertError } = await supabaseAdmin.from("transactions").insert({
      wallet_id: wallet.id,
      tokens_added: pack.tokens,
      type: "topup",
      reference_id: refId,
      amount_kes: pack.kes,
      status: "completed",
    });

    if (insertError) throw insertError;

    await new Promise((r) => setTimeout(r, 800));

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({
        token_balance: wallet.token_balance + pack.tokens,
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", wallet.id);

    if (updateError) throw updateError;

    res.json({ success: true, newBalance: wallet.token_balance + pack.tokens });
  } catch (error: any) {
    console.error("Topup error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// --- M-Pesa STK ---
app.post("/api/mpesa/stk-push", requireAuthMw, async (req, res) => {
  const userId = (req as AuthedRequest).authUserId;
  const { phoneNumber, packKes, amountKes } = req.body;
  const { min, max, kesPerToken } = getTopupKesBounds();

  const raw =
    amountKes != null && amountKes !== ""
      ? Number(amountKes)
      : packKes != null && packKes !== ""
        ? Number(packKes)
        : NaN;

  if (!phoneNumber || !Number.isFinite(raw)) {
    return res.status(400).json({
      error: "phoneNumber and amount (amountKes or packKes) are required",
    });
  }

  const kes = Math.round(raw);
  if (kes < min || kes > max) {
    return res.status(400).json({
      error: `Amount must be between Ksh ${min} and Ksh ${max}`,
    });
  }

  const tokensPreview = resolveTokensForTopupKes(kes);
  if (tokensPreview < 1) {
    return res.status(400).json({
      error: `At least Ksh ${Math.ceil(kesPerToken)} required for 1 token (Ksh ${kesPerToken} per token)`,
    });
  }

  try {
    const wallet = await ensureWallet(userId);
    const phone254 = normalizeKenyaPhone(String(phoneNumber));
    if (phone254.length < 12) {
      return res.status(400).json({ error: "Enter a valid Kenya phone number" });
    }

    const stk = await initiateStkPush({
      amountKes: kes,
      phone254,
      accountReference: `JT${wallet.id.slice(0, 8)}`,
      transactionDesc: "JobToken wallet",
    });

    const { error: insertError } = await supabaseAdmin.from("transactions").insert({
      wallet_id: wallet.id,
      tokens_added: 0,
      type: "topup",
      reference_id: `STK-PENDING-${stk.checkoutRequestId}`,
      amount_kes: kes,
      status: "pending",
      checkout_request_id: stk.checkoutRequestId,
    });

    if (insertError) {
      console.error(insertError);
      return res.status(500).json({ error: "Could not record pending payment" });
    }

    res.json({
      success: true,
      checkoutRequestId: stk.checkoutRequestId,
      customerMessage: stk.customerMessage,
      tokensOnSuccess: tokensPreview,
      kes,
    });
  } catch (error: any) {
    console.error("STK error:", error);
    res.status(500).json({ error: error.message || "STK Push failed" });
  }
});

app.post("/api/mpesa/callback", async (req, res) => {
  const parsed = parseStkCallbackBody(req.body);
  if (!parsed || !parsed.checkoutRequestId) {
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Ignored" });
  }

  try {
    const result = await processStkCallback(supabaseAdmin, parsed);
    if (result.outcome === "error") {
      console.error("STK callback:", result.message);
    }
    if (result.outcome === "unknown_checkout") {
      console.warn("STK callback: unknown checkout", parsed.checkoutRequestId);
    }
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (e) {
    console.error("Callback error:", e);
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

/** Local testing only: completes a pending STK row without Safaricom. Set MPESA_SIMULATE=true. */
app.post("/api/mpesa/simulate-callback", async (req, res) => {
  if (process.env.MPESA_SIMULATE !== "true") {
    return res.status(404).json({ error: "Not found" });
  }
  const { checkoutRequestId, amountKes, resultCode, mpesaReceiptNumber } = req.body || {};
  if (!checkoutRequestId || typeof checkoutRequestId !== "string") {
    return res.status(400).json({ error: "checkoutRequestId (string) required" });
  }
  const parsed: StkCallbackParsed = {
    checkoutRequestId,
    resultCode: resultCode != null ? Number(resultCode) : 0,
    resultDesc: "Simulated",
    merchantRequestId: "sim",
    amountKes: amountKes != null ? Number(amountKes) : null,
    mpesaReceiptNumber:
      typeof mpesaReceiptNumber === "string" && mpesaReceiptNumber.length > 0
        ? mpesaReceiptNumber
        : `SIM-${Date.now()}`,
    phone: null,
  };
  const result = await processStkCallback(supabaseAdmin, parsed);
  return res.json(result);
});

// --- Employer notify + in-app notification ---
app.post("/api/applications/notify-employer", async (req, res) => {
  const { jobId, seekerUserId } = req.body;

  if (!jobId || !seekerUserId) {
    return res.status(400).json({ error: "jobId and seekerUserId are required" });
  }

  try {
    const { data: appRow, error: appErr } = await supabaseAdmin
      .from("applications")
      .select("id, job_id, user_id, created_at")
      .eq("job_id", jobId)
      .eq("user_id", seekerUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (appErr || !appRow) {
      return res.status(404).json({ error: "Application not found" });
    }

    const { data: job, error: jobErr } = await supabaseAdmin
      .from("jobs")
      .select("id, title, posted_by")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const { data: seeker } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", seekerUserId)
      .single();

    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", job.posted_by)
      .single();

    let ownerEmail = ownerProfile?.email || null;
    if (!ownerEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        job.posted_by
      );
      ownerEmail = authUser.user?.email || null;
    }

    if (ownerEmail) {
      await sendMail({
        to: ownerEmail,
        subject: `New application: ${job.title}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #10b981;">New applicant</h2>
            <p><strong>${seeker?.full_name || "A candidate"}</strong> applied for <strong>${job.title}</strong>.</p>
            <p>Sign in to your JobToken employer portal to review applications.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">JobToken employer notification</p>
          </div>
        `,
      });
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: job.posted_by,
      type: "new_application",
      payload: {
        application_id: appRow.id,
        job_id: job.id,
        job_title: job.title,
        seeker_id: seekerUserId,
        seeker_name: seeker?.full_name,
        seeker_email: seeker?.email,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("notify-employer:", error);
    res.status(500).json({ error: error.message });
  }
});

const APPLICATION_STATUS_WHITELIST = new Set([
  "pending",
  "reviewing",
  "qualified",
  "interview",
  "shortlisted",
  "offer",
  "rejected",
]);

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PASSWORD_RESET_OTP_TTL_MS = 15 * 60 * 1000;
const PASSWORD_RESET_MAX_REQUESTS_PER_HOUR = 5;
const PASSWORD_RESET_MAX_OTP_ATTEMPTS = 5;

/** Case-insensitive profile lookup by email (avoids eq mismatch when casing differs). */
async function getProfileByEmailNormalized(emailNormalized: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .ilike("email", emailNormalized)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; email: string | null } | null;
}

app.post("/api/auth/password-reset/request", async (req, res) => {
  const emailRaw = asNonEmptyString(req.body?.email);
  if (!emailRaw) {
    return res.status(400).json({ error: "Email is required" });
  }
  const emailNormalized = normalizeEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const genericMessage =
    "If an account exists for that email, you will receive a verification code shortly.";

  try {
    const profile = await getProfileByEmailNormalized(emailNormalized);
    if (!profile) {
      return res.json({ success: true, message: genericMessage });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: cntErr } = await supabaseAdmin
      .from("password_reset_otps")
      .select("*", { count: "exact", head: true })
      .eq("email_normalized", emailNormalized)
      .gte("created_at", oneHourAgo);

    if (cntErr) throw cntErr;
    if ((count ?? 0) >= PASSWORD_RESET_MAX_REQUESTS_PER_HOUR) {
      return res.status(429).json({
        error: "Too many reset requests for this email. Try again in about an hour.",
      });
    }

    const otp = generateSixDigitOtp();
    const otpHash = hashPasswordResetOtp(otp, emailNormalized);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MS).toISOString();

    const { error: delErr } = await supabaseAdmin
      .from("password_reset_otps")
      .delete()
      .eq("email_normalized", emailNormalized);
    if (delErr) throw delErr;

    const { error: insErr } = await supabaseAdmin.from("password_reset_otps").insert({
      user_id: profile.id,
      email_normalized: emailNormalized,
      otp_hash: otpHash,
      expires_at: expiresAt,
      attempt_count: 0,
    });
    if (insErr) throw insErr;

    const mailTo = (profile.email && profile.email.trim()) || emailNormalized;
    const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const resetPageUrl = `${appUrl}/reset-password`;

    await sendMail({
      to: mailTo,
      subject: "Your JobToken password reset code",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
          <h1 style="font-size: 20px; color: #059669;">Password reset</h1>
          <p>Use this code to set a new password (expires in 15 minutes):</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 0.25em; font-family: ui-monospace, monospace;">${escapeHtml(otp)}</p>
          <p>Open the reset page, enter your email, this code, and your new password:</p>
          <p><a href="${escapeHtml(resetPageUrl)}" style="color: #059669;">${escapeHtml(resetPageUrl)}</a></p>
          <p style="font-size: 13px; color: #71717a;">If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    return res.json({ success: true, message: genericMessage });
  } catch (error: any) {
    console.error("password-reset request:", error);
    res.status(500).json({ error: error.message || "Failed to process request" });
  }
});

app.post("/api/auth/password-reset/confirm", async (req, res) => {
  const emailRaw = asNonEmptyString(req.body?.email);
  const otpRaw = asNonEmptyString(req.body?.otp);
  const newPassword = asNonEmptyString(req.body?.newPassword);

  if (!emailRaw || !otpRaw || !newPassword) {
    return res.status(400).json({ error: "Email, code, and new password are required" });
  }
  const emailNormalized = normalizeEmail(emailRaw);
  const otp = otpRaw.replace(/\s/g, "");

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "Enter the 6-digit code from your email" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const { data: row, error: selErr } = await supabaseAdmin
      .from("password_reset_otps")
      .select("id, user_id, otp_hash, expires_at, attempt_count")
      .eq("email_normalized", emailNormalized)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selErr) throw selErr;
    if (!row) {
      return res.status(400).json({
        error: "Invalid or expired code. Request a new code from Forgot password.",
      });
    }

    const rowTyped = row as { id: string; user_id: string; otp_hash: string; attempt_count: number };

    if (rowTyped.attempt_count >= PASSWORD_RESET_MAX_OTP_ATTEMPTS) {
      await supabaseAdmin.from("password_reset_otps").delete().eq("id", rowTyped.id);
      return res.status(400).json({ error: "Too many incorrect attempts. Request a new code." });
    }

    const expectedHash = rowTyped.otp_hash;
    const actualHash = hashPasswordResetOtp(otp, emailNormalized);

    const a = Buffer.from(expectedHash, "hex");
    const b = Buffer.from(actualHash, "hex");
    const matches = a.length === b.length && timingSafeEqual(a, b);

    if (!matches) {
      await supabaseAdmin
        .from("password_reset_otps")
        .update({ attempt_count: rowTyped.attempt_count + 1 })
        .eq("id", rowTyped.id);
      return res.status(400).json({ error: "Invalid code. Check the email and try again." });
    }

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(rowTyped.user_id, {
      password: newPassword,
    });
    if (authErr) throw authErr;

    await supabaseAdmin.from("password_reset_otps").delete().eq("email_normalized", emailNormalized);

    return res.json({
      success: true,
      message: "Password updated. You can sign in with your new password.",
    });
  } catch (error: any) {
    console.error("password-reset confirm:", error);
    res.status(500).json({ error: error.message || "Could not reset password" });
  }
});

function statusEmailCopy(status: string, jobTitle: string, applicantName: string, notes: string) {
  const jt = escapeHtml(jobTitle);
  const an = escapeHtml(applicantName);
  const safeNotes = notes
    ? `<p style="margin-top:16px;padding:12px;background:#f4f4f5;border-radius:8px;"><strong>Message from the employer:</strong><br/>${escapeHtml(notes).replace(/\n/g, "<br/>")}</p>`
    : "";
  const intro = (body: string) => `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <p>Hi ${an},</p>
          ${body}
          ${safeNotes}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Open JobToken to see your full application history and message thread.</p>
        </div>
      `;

  switch (status) {
    case "reviewing":
      return {
        subject: `Application update: ${jt}`,
        html: intro(
          `<p>Your application for <strong>${jt}</strong> is now <strong>under review</strong>.</p>`
        ),
      };
    case "qualified":
      return {
        subject: `You've been qualified — ${jt}`,
        html: intro(
          `<p>Good news: the employer has marked you as <strong>qualified</strong> for <strong>${jt}</strong>.</p>`
        ),
      };
    case "interview":
      return {
        subject: `Interview stage — ${jt}`,
        html: intro(
          `<p>Your application for <strong>${jt}</strong> has moved to the <strong>interview</strong> stage.</p>`
        ),
      };
    case "shortlisted":
      return {
        subject: `Shortlisted for ${jt}`,
        html: intro(
          `<p>You have been <strong>shortlisted</strong> for <strong>${jt}</strong>.</p>`
        ),
      };
    case "offer":
      return {
        subject: `Update on ${jt}`,
        html: intro(
          `<p>There is an update on your application for <strong>${jt}</strong> (status: <strong>offer / next steps</strong>).</p>`
        ),
      };
    case "rejected":
      return {
        subject: `Update on your application for ${jt}`,
        html: intro(
          `<p>Thank you for applying to <strong>${jt}</strong>. The employer will not be moving forward with this application at this time.</p>`
        ),
      };
    case "pending":
      return {
        subject: `Application reset — ${jt}`,
        html: intro(
          `<p>Your application for <strong>${jt}</strong> was set back to <strong>submitted</strong> for further review.</p>`
        ),
      };
    default:
      return {
        subject: `Application update: ${jt}`,
        html: intro(
          `<p>Your application for <strong>${jt}</strong> has a new status: <strong>${escapeHtml(status)}</strong>.</p>`
        ),
      };
  }
}

app.post("/api/applications/update-status", async (req, res) => {
  const { applicationId, status, notes, employerUserId } = req.body;

  if (!applicationId || !status || !employerUserId) {
    return res.status(400).json({
      error: "Missing applicationId, status, or employerUserId",
    });
  }

  if (!APPLICATION_STATUS_WHITELIST.has(String(status))) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const notesStr = typeof notes === "string" ? notes : "";

  try {
    const { data: before, error: fetchErr } = await supabaseAdmin
      .from("applications")
      .select(
        `
        id,
        user_id,
        job_id,
        status,
        notes,
        jobs!inner ( id, title, posted_by )
      `
      )
      .eq("id", applicationId)
      .single();

    if (fetchErr || !before) {
      return res.status(404).json({ error: "Application not found" });
    }

    let jobRow = (before as any).jobs;
    if (Array.isArray(jobRow)) jobRow = jobRow[0];
    if (!jobRow || jobRow.posted_by !== employerUserId) {
      return res.status(403).json({ error: "Not allowed to update this application" });
    }

    const prevStatus = String((before as any).status || "pending");
    const prevNotes = String((before as any).notes ?? "");
    if (prevStatus === String(status) && prevNotes === notesStr) {
      return res.json({ success: true, unchanged: true });
    }

    const { data: application, error: updateError } = await supabaseAdmin
      .from("applications")
      .update({ status, notes: notesStr || null })
      .eq("id", applicationId)
      .select(
        `
        *,
        jobs (id, title),
        profiles:user_id (full_name, email)
      `
      )
      .single();

    if (updateError) throw updateError;

    const applicant = (application as any).profiles;
    const job = (application as any).jobs;

    const { subject, html } = statusEmailCopy(
      status,
      job.title,
      applicant?.full_name || "there",
      notesStr
    );

    if (applicant?.email) {
      await sendMail({
        to: applicant.email,
        subject,
        html,
      });
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: (application as any).user_id,
      type: "application_status",
      payload: {
        application_id: applicationId,
        job_id: job.id,
        job_title: job.title,
        status,
        notes: notesStr || null,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Status update error:", error);
    res.status(500).json({ error: error.message });
  }
});

/** Matches seekers' profiles.profession_or_study to this job's profession/field (jobs.area_of_business). */
async function notifySeekersJobProfessionMatch(opts: {
  jobId: string;
  jobTitle: string;
  professionSought: string | null | undefined;
}) {
  const profession = String(opts.professionSought ?? "").trim();
  if (!profession) return;

  const target = profession.toLowerCase();
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const { data: seekers, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, profession_or_study")
    .eq("role", "seeker");

  if (error || !seekers?.length) return;

  const matched = seekers.filter(
    (s) =>
      s.profession_or_study &&
      String(s.profession_or_study).trim().toLowerCase() === target
  );

  for (const seeker of matched) {
    const { data: existing } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("user_id", seeker.id)
      .eq("type", "job_match")
      .contains("payload", { job_id: opts.jobId })
      .maybeSingle();

    if (existing) continue;

    await supabaseAdmin.from("notifications").insert({
      user_id: seeker.id,
      type: "job_match",
      payload: {
        job_id: opts.jobId,
        job_title: opts.jobTitle,
        profession_sought: profession,
        area_of_business: profession,
      },
    });

    let toEmail = seeker.email;
    if (!toEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(seeker.id);
      toEmail = authUser.user?.email || null;
    }

    if (toEmail) {
      await sendMail({
        to: toEmail,
        subject: `New job in your field: ${opts.jobTitle}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #10b981;">A job matches your profile</h2>
            <p>Hi ${escapeHtml(seeker.full_name || "there")},</p>
            <p>A new listing <strong>${escapeHtml(opts.jobTitle)}</strong> is seeking someone in <strong>${escapeHtml(profession)}</strong>, which matches the profession or area of study on your JobToken profile.</p>
            <p><a href="${appUrl}/" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 16px 0;">Browse jobs</a></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">You can update your profile focus anytime under My profile.</p>
          </div>
        `,
      });
    }
  }
}

// --- Employer job posting (fees + featured) ---
app.post("/api/employer/post-job", requireApprovedEmployerMw, async (req, res) => {
  const body = parseJsonBody(req);
  const userId = (req as AuthedRequest).authUserId;
  const title = asNonEmptyString(body.title);
  const description = asNonEmptyString(body.description);
  const job_type = asNonEmptyString(body.job_type);
  const token_cost = body.token_cost;
  const is_featured = body.is_featured;
  const closes_at = body.closes_at;

  if (!title || !description || !job_type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const postingFee = Math.max(
    0,
    parseInt(process.env.EMPLOYER_POSTING_FEE_TOKENS || "0", 10) || 0
  );
  const featured = Boolean(is_featured);

  try {
    const featureFee = await getFeatureJobTokens();
    let totalFee = postingFee;
    if (featured) totalFee += featureFee;

    const closesAt =
      closes_at && String(closes_at).trim()
        ? new Date(String(closes_at)).toISOString()
        : null;
    if (closesAt && Number.isNaN(Date.parse(closesAt))) {
      return res.status(400).json({ error: "Invalid closes_at date" });
    }

    const professionSought = readJobProfessionField(body);

    if (!professionSought) {
      return res.status(400).json({
        error:
          "Profession or field sought is required. Choose the field for this role (e.g. Finance)—it can differ from your company sector in Company profile.",
      });
    }

    const wallet = await ensureWallet(userId);

    if (totalFee > 0) {
      if (!walletTokensNotExpired(wallet.expires_at)) {
        return res.status(400).json({
          error:
            "Your employer tokens have expired. Top up your wallet (same rules as job seeker tokens) to post or feature listings.",
        });
      }
      if (wallet.token_balance < totalFee) {
        return res.status(400).json({
          error: `Insufficient employer tokens. Need ${totalFee} tokens (posting + featured). Top up your wallet as an employer.`,
        });
      }

      const { error: wu } = await supabaseAdmin
        .from("wallets")
        .update({ token_balance: wallet.token_balance - totalFee })
        .eq("id", wallet.id);

      if (wu) throw wu;

      const ref = `JOB-FEE-${Math.random().toString(36).slice(2, 10)}`;
      const { error: ti } = await supabaseAdmin.from("transactions").insert({
        wallet_id: wallet.id,
        tokens_added: -totalFee,
        type: "employer_fee",
        reference_id: ref,
        status: "completed",
      });
      if (ti) throw ti;
    }

    const { data: job, error: insErr } = await supabaseAdmin
      .from("jobs")
      .insert({
        title,
        description,
        job_type,
        token_cost: Number(token_cost) || 1,
        posted_by: userId,
        is_featured: featured,
        closes_at: closesAt,
      })
      .select("id")
      .single();

    if (insErr) throw insErr;

    const { error: profErr } = await supabaseAdmin
      .from("jobs")
      .update({ area_of_business: professionSought })
      .eq("id", job.id)
      .eq("posted_by", userId);

    if (profErr) {
      await supabaseAdmin.from("jobs").delete().eq("id", job.id);
      throw profErr;
    }

    const { data: jobFull, error: fetchErr } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", job.id)
      .single();

    if (fetchErr) throw fetchErr;

    await notifySeekersJobProfessionMatch({
      jobId: jobFull.id,
      jobTitle: title,
      professionSought,
    });

    res.json({ success: true, job: jobFull });
  } catch (error: any) {
    console.error("post-job:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/employer/update-job", requireApprovedEmployerMw, async (req, res) => {
  const body = parseJsonBody(req);
  const userId = (req as AuthedRequest).authUserId;
  const jobId = asNonEmptyString(body.jobId);
  const title = asNonEmptyString(body.title);
  const description = asNonEmptyString(body.description);
  const job_type = asNonEmptyString(body.job_type);
  const token_cost = body.token_cost;
  const is_featured = body.is_featured;
  const closes_at = body.closes_at;

  if (!userId || !jobId || !title || !description || !job_type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("jobs")
      .select("id, posted_by, is_featured")
      .eq("id", jobId)
      .single();

    if (exErr || !existing) {
      return res.status(404).json({ error: "Job not found" });
    }
    if (existing.posted_by !== userId) {
      return res.status(403).json({ error: "You can only edit your own jobs" });
    }

    const featured = Boolean(is_featured);
    const wasFeatured = Boolean((existing as { is_featured?: boolean }).is_featured);

    const professionSought = readJobProfessionField(body);
    if (!professionSought) {
      return res.status(400).json({
        error:
          "Profession or field sought is required (area_of_business / profession_sought). It must match the value you select when posting or editing.",
      });
    }

    let closesAtUpdate: string | null | undefined = undefined;
    if (closes_at !== undefined) {
      if (closes_at === null || closes_at === "") {
        closesAtUpdate = null;
      } else {
        const d = new Date(String(closes_at));
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: "Invalid closes_at date" });
        }
        closesAtUpdate = d.toISOString();
      }
    }

    const featureFee = await getFeatureJobTokens();

    if (featured && !wasFeatured && featureFee > 0) {
      const wallet = await ensureWallet(userId);
      if (!walletTokensNotExpired(wallet.expires_at)) {
        return res.status(400).json({
          error:
            "Your employer tokens have expired. Top up your wallet to enable a featured listing.",
        });
      }
      if (wallet.token_balance < featureFee) {
        return res.status(400).json({
          error: `Insufficient tokens to feature this job. You need ${featureFee} tokens. Top up your employer wallet.`,
        });
      }
      const { error: wu } = await supabaseAdmin
        .from("wallets")
        .update({ token_balance: wallet.token_balance - featureFee })
        .eq("id", wallet.id);
      if (wu) throw wu;
      const ref = `FEAT-${jobId.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}`;
      const { error: ti } = await supabaseAdmin.from("transactions").insert({
        wallet_id: wallet.id,
        tokens_added: -featureFee,
        type: "employer_feature_fee",
        reference_id: ref,
        status: "completed",
      });
      if (ti) throw ti;
    }

    const updatePayload: Record<string, unknown> = {
      title,
      description,
      job_type,
      token_cost: Number(token_cost) || 1,
      is_featured: featured,
      area_of_business: professionSought,
    };

    if (closesAtUpdate !== undefined) {
      updatePayload.closes_at = closesAtUpdate;
    }

    const { error: upErr } = await supabaseAdmin
      .from("jobs")
      .update(updatePayload)
      .eq("id", jobId)
      .eq("posted_by", userId);

    if (upErr) throw upErr;

    const { error: profErr } = await supabaseAdmin
      .from("jobs")
      .update({ area_of_business: professionSought })
      .eq("id", jobId)
      .eq("posted_by", userId);

    if (profErr) throw profErr;

    const { data: job, error: fetchErr } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (fetchErr) throw fetchErr;

    res.json({ success: true, job });
  } catch (error: any) {
    console.error("update-job:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- Admin (JWT + admin role; see server/auth.ts) ---
app.post("/api/admin/jobs/delete", requireAdminMw, async (req, res) => {
  const { jobId } = req.body;
  try {
    const { error } = await supabaseAdmin.from("jobs").delete().eq("id", jobId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/tokens/grant", requireAdminMw, async (req, res) => {
  const { email, amount } = req.body;
  try {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (profileError || !profile) throw new Error("User not found");

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("id, token_balance")
      .eq("user_id", profile.id)
      .single();

    if (walletError || !wallet) throw new Error("Wallet not found");

    const { error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({ token_balance: wallet.token_balance + amount })
      .eq("id", wallet.id);

    if (updateError) throw updateError;

    const { error: txInsertError } = await supabaseAdmin.from("transactions").insert({
      wallet_id: wallet.id,
      tokens_added: amount,
      type: "admin_grant",
      reference_id: `ADMIN-${Math.random().toString(36).toUpperCase().slice(2, 8)}`,
      status: "completed",
    });

    if (txInsertError) throw txInsertError;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/platform-settings", requireAdminMw, async (_req, res) => {
  try {
    const feature_job_tokens = await getFeatureJobTokens();
    res.json({ feature_job_tokens });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function handleAdminPlatformSettingsWrite(req: express.Request, res: express.Response) {
  const body = parseJsonBody(req);
  const raw = body.feature_job_tokens;
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
    return res.status(400).json({
      error: "feature_job_tokens must be an integer from 0 to 1000000",
    });
  }
  const value = Math.floor(n);
  const now = new Date().toISOString();
  try {
    const { data: updated, error: upErr } = await supabaseAdmin
      .from("platform_settings")
      .update({ value_int: value, updated_at: now })
      .eq("key", "feature_job_tokens")
      .select("key");

    if (upErr) throw upErr;

    if (updated && updated.length > 0) {
      return res.status(200).json({ success: true, feature_job_tokens: value });
    }

    const { error: insErr } = await supabaseAdmin.from("platform_settings").insert({
      key: "feature_job_tokens",
      value_int: value,
      updated_at: now,
    });
    if (insErr) throw insErr;
    return res.status(200).json({ success: true, feature_job_tokens: value });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Save failed" });
  }
}

app.put("/api/admin/platform-settings", requireAdminMw, handleAdminPlatformSettingsWrite);
app.post("/api/admin/platform-settings", requireAdminMw, handleAdminPlatformSettingsWrite);

/** Top-ups received, token float, application token “income” (KES estimates use MPESA_KES_PER_TOKEN). */
app.get("/api/admin/financial-overview", requireAdminMw, async (_req, res) => {
  try {
    const kesPerToken = getKesPerToken();

    const { data: topupRows } = await supabaseAdmin
      .from("transactions")
      .select("amount_kes")
      .eq("type", "topup")
      .eq("status", "completed");

    const total_customer_topup_kes =
      topupRows?.reduce((acc, t) => acc + Number(t.amount_kes ?? 0), 0) || 0;

    const { data: walletRows } = await supabaseAdmin.from("wallets").select("token_balance");
    const total_tokens_outstanding =
      walletRows?.reduce((acc, w) => acc + (Number(w.token_balance) || 0), 0) || 0;

    const outstanding_tokens_kes_estimate = Math.round(total_tokens_outstanding * kesPerToken);

    const { data: appTx } = await supabaseAdmin
      .from("transactions")
      .select("tokens_added")
      .eq("type", "application")
      .eq("status", "completed");

    const application_tokens_consumed =
      appTx?.reduce((acc, t) => acc + Math.abs(Number(t.tokens_added) || 0), 0) || 0;

    const application_income_kes_estimate = Math.round(application_tokens_consumed * kesPerToken);

    res.json({
      total_customer_topup_kes,
      total_tokens_outstanding,
      outstanding_tokens_kes_estimate,
      application_tokens_consumed,
      application_income_kes_estimate,
      kes_per_token_estimate: kesPerToken,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/users", requireAdminMw, async (req, res) => {
  const role = String(req.query.role || "").toLowerCase();
  try {
    let q = supabaseAdmin
      .from("profiles")
      .select(
        "id, email, full_name, role, is_active, created_at, employer_approval_status, employer_approved_at"
      )
      .in("role", ["seeker", "employer"])
      .order("email", { ascending: true });

    if (role === "seeker" || role === "employer") {
      q = q.eq("role", role);
    }

    const { data, error } = await q;
    if (error) throw error;
    res.json({ users: data ?? [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/employers/:userId/approve", requireAdminMw, async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: profile, error: pe } = await supabaseAdmin
      .from("profiles")
      .select("id, role, email, full_name, employer_approval_status")
      .eq("id", userId)
      .single();

    if (pe || !profile) {
      return res.status(404).json({ error: "User not found" });
    }
    if (profile.role !== "employer") {
      return res.status(400).json({ error: "Not an employer account" });
    }
    if (profile.employer_approval_status === "approved") {
      return res.status(400).json({ error: "Employer is already approved" });
    }

    const raw = randomBytes(12).toString("base64url").replace(/[^a-zA-Z0-9]/g, "");
    const tempPassword = `${(raw.slice(0, 10) || "JobToken01")}aA1`;

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (authErr) throw authErr;

    const now = new Date().toISOString();
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        employer_approval_status: "approved",
        employer_approved_at: now,
        is_active: true,
      })
      .eq("id", userId);
    if (upErr) throw upErr;

    const emailTo = (profile as { email?: string | null }).email;
    if (!emailTo) {
      return res.status(400).json({ error: "Profile has no email" });
    }

    const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const loginUrl = `${appUrl}/login`;
    const name = escapeHtml((profile as { full_name?: string | null }).full_name || "there");

    await sendMail({
      to: emailTo,
      subject: "Your JobToken employer account is approved",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
          <h1 style="font-size: 20px; color: #059669;">You're approved</h1>
          <p>Hi ${name},</p>
          <p>Your employer account has been approved. You can sign in and post jobs on JobToken.</p>
          <p style="margin: 16px 0;"><strong>Sign-in link:</strong><br/>
            <a href="${escapeHtml(loginUrl)}" style="color: #059669;">${escapeHtml(loginUrl)}</a>
          </p>
          <p><strong>Username (email):</strong> ${escapeHtml(emailTo)}</p>
          <p><strong>Temporary password:</strong> <code style="background:#f4f4f5;padding:4px 8px;border-radius:6px;">${escapeHtml(tempPassword)}</code></p>
          <p style="font-size: 13px; color: #71717a;">Change this password after signing in when your account settings allow it.</p>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
          <p style="font-size: 12px; color: #a1a1aa;">JobToken employer onboarding</p>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/employers/:userId/reject", requireAdminMw, async (req, res) => {
  const { userId } = req.params;
  try {
    const { data: profile, error: pe } = await supabaseAdmin
      .from("profiles")
      .select("id, role, employer_approval_status")
      .eq("id", userId)
      .single();

    if (pe || !profile) {
      return res.status(404).json({ error: "User not found" });
    }
    if (profile.role !== "employer") {
      return res.status(400).json({ error: "Not an employer account" });
    }
    if (profile.employer_approval_status === "approved") {
      return res.status(400).json({
        error: "Employer is already approved; use deactivate if you need to block access.",
      });
    }

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        employer_approval_status: "rejected",
        is_active: false,
      })
      .eq("id", userId);
    if (upErr) throw upErr;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/user/:userId", requireAdminMw, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (pErr || !profile) {
      return res.status(404).json({ error: "User not found" });
    }
    if (profile.role === "admin") {
      return res.status(403).json({ error: "Admin profile summary is not exposed here" });
    }

    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    let transactions: any[] = [];
    let total_topup_kes = 0;
    let application_tokens_spent = 0;
    let employer_fees_tokens = 0;

    if (wallet?.id) {
      const { data: aggTx } = await supabaseAdmin
        .from("transactions")
        .select("tokens_added, type, amount_kes, status")
        .eq("wallet_id", wallet.id);

      for (const t of aggTx ?? []) {
        if (t.type === "topup" && t.status === "completed") {
          total_topup_kes += Number(t.amount_kes ?? 0);
        }
        if (t.type === "application" && t.status === "completed") {
          application_tokens_spent += Math.abs(Number(t.tokens_added) || 0);
        }
        if (
          (t.type === "employer_fee" || t.type === "employer_feature_fee") &&
          t.status === "completed"
        ) {
          employer_fees_tokens += Math.abs(Number(t.tokens_added) || 0);
        }
      }

      const { data: txs } = await supabaseAdmin
        .from("transactions")
        .select("id, tokens_added, type, amount_kes, status, reference_id, created_at")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(80);
      transactions = txs ?? [];
    }

    const kesPerToken = getKesPerToken();

    let applications_count: number | null = null;
    let jobs_posted_count: number | null = null;

    if (profile.role === "seeker") {
      const { count } = await supabaseAdmin
        .from("applications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      applications_count = count ?? 0;
    }
    if (profile.role === "employer") {
      const { count } = await supabaseAdmin
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("posted_by", userId);
      jobs_posted_count = count ?? 0;
    }

    const token_balance = Number(wallet?.token_balance) || 0;
    const active_tokens_kes_estimate = Math.round(token_balance * kesPerToken);

    res.json({
      profile,
      wallet: wallet ?? null,
      transactions,
      summary: {
        total_topup_kes,
        application_tokens_spent,
        employer_fees_tokens,
        active_token_balance: token_balance,
        active_tokens_kes_estimate,
        applications_count,
        jobs_posted_count,
        kes_per_token_estimate: kesPerToken,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/users/set-active", requireAdminMw, async (req, res) => {
  const body = parseJsonBody(req);
  const userId = asNonEmptyString(body.userId);
  const isActive = body.isActive === true || body.isActive === false ? body.isActive : null;

  if (!userId || typeof isActive !== "boolean") {
    return res.status(400).json({ error: "userId and boolean isActive required" });
  }

  try {
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (pErr || !profile) {
      return res.status(404).json({ error: "User not found" });
    }
    if (profile.role === "admin") {
      return res.status(403).json({ error: "Cannot change admin account status here" });
    }

    const { error: uErr } = await supabaseAdmin
      .from("profiles")
      .update({ is_active: isActive })
      .eq("id", userId);

    if (uErr) throw uErr;
    res.json({ success: true, is_active: isActive });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/users/delete", requireAdminMw, async (req, res) => {
  const body = parseJsonBody(req);
  const userId = asNonEmptyString(body.userId);

  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  try {
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (pErr || !profile) {
      return res.status(404).json({ error: "User not found" });
    }
    if (profile.role === "admin") {
      return res.status(403).json({ error: "Cannot delete admin accounts via this API" });
    }

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Delete failed" });
  }
});

app.get("/api/admin/stats", requireAdminMw, async (req, res) => {
  try {
    const { data: topups } = await supabaseAdmin
      .from("transactions")
      .select("amount_kes")
      .eq("type", "topup")
      .eq("status", "completed");

    const totalRevenue =
      topups?.reduce((acc, t) => {
        const v = t.amount_kes != null ? Number(t.amount_kes) : 100;
        return acc + v;
      }, 0) || 0;

    const { count: activeSeekers } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "seeker");

    const { count: registeredEmployers } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "employer");

    const { count: pendingEmployers } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "employer")
      .eq("employer_approval_status", "pending");

    const { count: totalApplications } = await supabaseAdmin
      .from("applications")
      .select("*", { count: "exact", head: true });

    res.json({
      total_revenue: totalRevenue,
      active_seekers: activeSeekers || 0,
      registered_employers: registeredEmployers || 0,
      pending_employers: pendingEmployers || 0,
      total_applications: totalApplications || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/advanced-stats", requireAdminMw, async (req, res) => {
  try {
    const { data: wallets } = await supabaseAdmin.from("wallets").select("token_balance");
    const totalLiability = wallets?.reduce((acc, w) => acc + w.token_balance, 0) || 0;

    const { data: catStats } = await supabaseAdmin.from("jobs").select("job_type, applications(count)");

    const revenuePerCategory: Record<string, number> = {};
    catStats?.forEach((job) => {
      const count = (job.applications as any)?.[0]?.count || 0;
      revenuePerCategory[job.job_type] =
        (revenuePerCategory[job.job_type] || 0) + count * 20;
    });

    const { data: hiredApps } = await supabaseAdmin
      .from("applications")
      .select("created_at, updated_at")
      .eq("status", "shortlisted");

    let avgTimeToHire = 0;
    if (hiredApps && hiredApps.length > 0) {
      const totalDiff = hiredApps.reduce((acc, app) => {
        const start = new Date(app.created_at).getTime();
        const end = new Date(app.updated_at).getTime();
        return acc + (end - start);
      }, 0);
      avgTimeToHire = totalDiff / hiredApps.length / (1000 * 60 * 60 * 24);
    }

    res.json({
      token_liability: totalLiability,
      revenue_per_category: revenuePerCategory,
      avg_time_to_hire: avgTimeToHire.toFixed(1),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/analytics-report", requireAdminMw, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("admin_analytics_report").select("*");

    if (error) {
      console.warn("admin_analytics_report view not found, falling back");
      const { data: jobs, error: jobsError } = await supabaseAdmin.from("jobs").select(`
          id,
          title,
          job_type,
          created_at,
          profiles:posted_by(full_name),
          applications(count)
        `);

      if (jobsError) throw jobsError;

      const report = jobs.map((job) => ({
        id: job.id,
        title: job.title,
        category: job.job_type,
        employer: (job.profiles as any)?.full_name,
        applicant_count: (job.applications as any)?.[0]?.count || 0,
        posted_at: job.created_at,
      }));
      return res.json(report);
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/chart-data", requireAdminMw, async (req, res) => {
  try {
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const { data: apps } = await supabaseAdmin
      .from("applications")
      .select("created_at")
      .gte("created_at", last7Days.toISOString());

    const { data: topups } = await supabaseAdmin
      .from("transactions")
      .select("created_at, amount_kes")
      .eq("type", "topup")
      .eq("status", "completed")
      .gte("created_at", last7Days.toISOString());

    const chartData: Record<string, { date: string; applications: number; revenue: number }> =
      {};

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      chartData[dateStr] = { date: dateStr, applications: 0, revenue: 0 };
    }

    apps?.forEach((app) => {
      const dateStr = app.created_at.split("T")[0];
      if (chartData[dateStr]) chartData[dateStr].applications++;
    });

    topups?.forEach((t) => {
      const dateStr = t.created_at.split("T")[0];
      const rev = t.amount_kes != null ? Number(t.amount_kes) : 100;
      if (chartData[dateStr]) chartData[dateStr].revenue += rev;
    });

    res.json(Object.values(chartData).sort((a, b) => a.date.localeCompare(b.date)));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/export-csv", requireAdminMw, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: txs, error } = await supabaseAdmin
      .from("transactions")
      .select(
        `
        created_at,
        tokens_added,
        type,
        reference_id,
        amount_kes,
        status,
        wallet:wallet_id(profiles:user_id(email))
      `
      )
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    const csvRows = [["Date", "User Email", "Tokens", "KES", "Type", "Status", "Reference ID"].join(",")];

    txs?.forEach((tx) => {
      const row = [
        new Date(tx.created_at).toLocaleString(),
        (tx.wallet as any)?.profiles?.email || "N/A",
        tx.tokens_added,
        tx.amount_kes ?? "",
        tx.type,
        (tx as any).status || "completed",
        tx.reference_id,
      ].join(",");
      csvRows.push(row);
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=financial_log.csv");
    res.send(csvRows.join("\n"));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/global-search", requireAdminMw, async (req, res) => {
  const { query } = req.query;
  if (!query) return res.json({ results: [] });

  try {
    const { data: txResults } = await supabaseAdmin
      .from("transactions")
      .select(
        `
        id,
        reference_id,
        type,
        created_at,
        wallet:wallet_id(profiles:user_id(email))
      `
      )
      .ilike("reference_id", `%${query}%`)
      .limit(5);

    const { data: profileResults } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role")
      .ilike("email", `%${query}%`)
      .limit(5);

    res.json({
      transactions: txResults || [],
      profiles: profileResults || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Prompt series & earnings ledger (see EARNINGS_PLAN.md) ---

app.get("/api/prompts/series", async (_req, res) => {
  try {
    const { data: series, error } = await supabaseAdmin
      .from("prompt_series")
      .select("id, title, description, status, created_at, created_by")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const list = series ?? [];
    const ids = list.map((s) => s.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: prompts } = await supabaseAdmin
        .from("prompts")
        .select("series_id")
        .in("series_id", ids)
        .eq("is_published", true);
      for (const p of prompts ?? []) {
        const sid = (p as { series_id: string }).series_id;
        counts[sid] = (counts[sid] || 0) + 1;
      }
    }

    res.json({
      series: list.map((s) => ({
        ...s,
        prompt_count: counts[s.id] ?? 0,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Public teaser list for the landing page: prompts under published series (headline, instructions, economics). */
app.get("/api/prompts/home-preview", async (_req, res) => {
  const limit = 10;
  try {
    const { data: publishedSeries, error: se } = await supabaseAdmin
      .from("prompt_series")
      .select("id, title")
      .eq("status", "published");

    if (se) throw se;
    const seriesRows = publishedSeries ?? [];
    if (seriesRows.length === 0) {
      return res.json({ prompts: [] });
    }

    const titleBySeriesId: Record<string, string> = {};
    for (const row of seriesRows) {
      titleBySeriesId[(row as { id: string }).id] = (row as { title: string }).title;
    }
    const seriesIds = seriesRows.map((r) => (r as { id: string }).id);

    const { data: prompts, error: pe } = await supabaseAdmin
      .from("prompts")
      .select("id, headline, instructions, reward_kes, submit_cost_tokens, series_id, sort_order")
      .in("series_id", seriesIds)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (pe) throw pe;

    const list = (prompts ?? []).map((p: any) => ({
      id: p.id,
      headline: p.headline,
      instructions: p.instructions,
      reward_kes: p.reward_kes,
      submit_cost_tokens: p.submit_cost_tokens,
      series_id: p.series_id,
      series_title: titleBySeriesId[p.series_id] ?? null,
    }));

    res.json({ prompts: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/prompts/series/:seriesId", async (req, res) => {
  const { seriesId } = req.params;
  try {
    const { data: s, error } = await supabaseAdmin
      .from("prompt_series")
      .select("*")
      .eq("id", seriesId)
      .single();

    if (error || !s) {
      return res.status(404).json({ error: "Series not found" });
    }
    if (s.status !== "published") {
      return res.status(404).json({ error: "Series not found" });
    }

    const { data: prompts, error: qErr } = await supabaseAdmin
      .from("prompts")
      .select(
        "id, sort_order, headline, instructions, word_limit, reward_kes, submit_cost_tokens, is_published, created_at"
      )
      .eq("series_id", seriesId)
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (qErr) throw qErr;

    res.json({ series: s, prompts: prompts ?? [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/prompts/submit", requireSeekerMw, async (req, res) => {
  const body = parseJsonBody(req);
  const userId = (req as AuthedRequest).authUserId;
  const promptId = asNonEmptyString(body.promptId);
  const answerRaw = body.answerText;
  const answerText = typeof answerRaw === "string" ? answerRaw.trim() : "";

  if (!promptId || !answerText) {
    return res.status(400).json({ error: "promptId and answerText are required" });
  }

  try {
    const { data: prompt, error: pErr } = await supabaseAdmin
      .from("prompts")
      .select("id, submit_cost_tokens, word_limit, series_id, is_published")
      .eq("id", promptId)
      .single();

    if (pErr || !prompt) {
      return res.status(404).json({ error: "Prompt not found" });
    }
    if (!prompt.is_published) {
      return res.status(400).json({ error: "Prompt is not available" });
    }

    const { data: ser } = await supabaseAdmin
      .from("prompt_series")
      .select("status")
      .eq("id", prompt.series_id)
      .single();

    if (!ser || ser.status !== "published") {
      return res.status(400).json({ error: "Series is not published" });
    }

    const wc = countWordsAnswer(answerText);
    if (prompt.word_limit != null && wc > Number(prompt.word_limit)) {
      return res.status(400).json({
        error: `Answer must be at most ${prompt.word_limit} words (currently ${wc})`,
      });
    }

    const cost = Number(prompt.submit_cost_tokens) || 0;
    if (cost < 1) {
      return res.status(500).json({ error: "Invalid prompt token cost" });
    }

    const wallet = await ensureWallet(userId);
    if (!walletTokensNotExpired(wallet.expires_at)) {
      return res.status(400).json({ error: "Your tokens have expired. Top up to continue." });
    }
    if (wallet.token_balance < cost) {
      return res.status(400).json({
        error: `Insufficient tokens. Need ${cost} to submit this answer.`,
      });
    }

    const { error: wu } = await supabaseAdmin
      .from("wallets")
      .update({ token_balance: wallet.token_balance - cost })
      .eq("id", wallet.id);

    if (wu) throw wu;

    const refBase = `PROMPT-${Math.random().toString(36).slice(2, 10)}`;

    const { data: submission, error: insErr } = await supabaseAdmin
      .from("prompt_submissions")
      .insert({
        prompt_id: promptId,
        user_id: userId,
        answer_text: answerText,
        word_count: wc,
        tokens_charged: cost,
        grade_status: "pending",
      })
      .select("id")
      .single();

    if (insErr) {
      await supabaseAdmin
        .from("wallets")
        .update({ token_balance: wallet.token_balance })
        .eq("id", wallet.id);
      if (insErr.code === "23505") {
        return res.status(409).json({ error: "You have already submitted an answer for this prompt" });
      }
      throw insErr;
    }

    const { error: txErr } = await supabaseAdmin.from("transactions").insert({
      wallet_id: wallet.id,
      tokens_added: -cost,
      type: "prompt_submission",
      reference_id: `${refBase}-${submission?.id?.slice(0, 8) ?? "sub"}`,
      status: "completed",
    });

    if (txErr) {
      await supabaseAdmin.from("prompt_submissions").delete().eq("id", submission!.id);
      await supabaseAdmin
        .from("wallets")
        .update({ token_balance: wallet.token_balance })
        .eq("id", wallet.id);
      throw txErr;
    }

    res.json({ success: true, submissionId: submission?.id });
  } catch (error: any) {
    console.error("prompt submit:", error);
    res.status(500).json({ error: error.message || "Submit failed" });
  }
});

app.get("/api/earnings/summary", requireSeekerMw, async (req, res) => {
  const userId = (req as AuthedRequest).authUserId;

  try {
    const balance = await getEarningsBalanceKes(userId);
    res.json({ balance_kes: balance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/earnings/ledger", requireSeekerMw, async (req, res) => {
  const userId = (req as AuthedRequest).authUserId;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10) || 0);

  try {
    const { data, error } = await supabaseAdmin
      .from("earnings_ledger")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ entries: data ?? [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/earnings/withdrawal-request", requireSeekerMw, async (req, res) => {
  const body = parseJsonBody(req);
  const userId = (req as AuthedRequest).authUserId;
  const amountRaw = body.amountKesRequested ?? body.amount_kes_requested;
  const amount = typeof amountRaw === "number" ? amountRaw : parseFloat(String(amountRaw ?? ""));

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Positive amountKesRequested required" });
  }

  if (!isWithdrawalWindowNow()) {
    return res.status(400).json({
      error:
        "Withdrawal requests are only open from the configured day of the month until month end (see EARNINGS_WITHDRAWAL_DAY_MIN).",
    });
  }

  try {
    const balance = await getEarningsBalanceKes(userId);
    if (amount > balance) {
      return res.status(400).json({
        error: `Requested amount exceeds available balance (${balance.toFixed(2)} KES)`,
      });
    }

    const now = new Date();
    const periodMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);

    const { data: row, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .insert({
        user_id: userId,
        amount_kes_requested: Math.round(amount * 100) / 100,
        period_month: periodMonth,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error: "You already have a pending withdrawal request for this month",
        });
      }
      throw error;
    }

    res.json({ success: true, requestId: row?.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/prompt-submissions/:submissionId/grade", requireAdminMw, async (req, res) => {
  const { submissionId } = req.params;
  const body = parseJsonBody(req);
  const adminUserId = (req as AuthedRequest).authUserId;
  const grade = asNonEmptyString(body.grade);

  if (grade !== "pass" && grade !== "fail") {
    return res.status(400).json({ error: "grade (pass|fail) required" });
  }

  try {
    const { data: raw, error: rpcErr } = await supabaseAdmin.rpc("grade_prompt_submission", {
      p_submission_id: submissionId,
      p_grade: grade,
      p_graded_by: adminUserId,
    });

    if (rpcErr) throw rpcErr;

    const row = raw as {
      ok?: boolean;
      error?: string;
      duplicate_reward?: boolean;
    };

    if (!row?.ok) {
      if (row?.error === "not_found") {
        return res.status(404).json({ error: "Submission not found" });
      }
      if (row?.error === "already_graded") {
        return res.status(400).json({ error: "Submission already graded" });
      }
      return res.status(400).json({ error: row?.error || "Cannot grade submission" });
    }

    if (row.duplicate_reward) {
      return res.json({ success: true, duplicateReward: true });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function csvEscapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

app.get("/api/admin/prompt-submissions", requireAdminMw, async (req, res) => {
  const statusFilter = ((req.query.status as string) || "pending").toLowerCase();
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const effectiveStatus =
      statusFilter === "all"
        ? null
        : statusFilter === "pending" || statusFilter === "pass" || statusFilter === "fail"
          ? statusFilter
          : "pending";

    let countQ = supabaseAdmin
      .from("prompt_submissions")
      .select("*", { count: "exact", head: true });
    if (effectiveStatus) countQ = countQ.eq("grade_status", effectiveStatus);
    const { count: total, error: cErr } = await countQ;
    if (cErr) throw cErr;

    let subq = supabaseAdmin
      .from("prompt_submissions")
      .select(
        "id, user_id, prompt_id, answer_text, word_count, tokens_charged, grade_status, submitted_at, graded_at"
      );
    if (effectiveStatus) subq = subq.eq("grade_status", effectiveStatus);

    const { data: subs, error: sErr } = await subq
      .order("submitted_at", { ascending: true })
      .range(from, to);
    if (sErr) throw sErr;
    const list = subs ?? [];
    if (list.length === 0) {
      return res.json({
        submissions: [],
        total: total ?? 0,
        page,
        pageSize,
        totalPages: Math.ceil((total ?? 0) / pageSize) || 0,
      });
    }

    const promptIds = [...new Set(list.map((s: { prompt_id: string }) => s.prompt_id))];
    const userIds = [...new Set(list.map((s: { user_id: string }) => s.user_id))];

    const { data: prompts, error: pErr } = await supabaseAdmin
      .from("prompts")
      .select("id, headline, reward_kes, series_id")
      .in("id", promptIds);
    if (pErr) throw pErr;

    const seriesIds = [...new Set((prompts ?? []).map((p: { series_id: string }) => p.series_id))];
    const { data: seriesRows, error: seErr } = await supabaseAdmin
      .from("prompt_series")
      .select("id, title")
      .in("id", seriesIds);
    if (seErr) throw seErr;

    const { data: profs, error: prErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);
    if (prErr) throw prErr;

    const promptMap = Object.fromEntries((prompts ?? []).map((p: any) => [p.id, p]));
    const seriesMap = Object.fromEntries((seriesRows ?? []).map((s: any) => [s.id, s]));
    const profileMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));

    const submissions = list.map((sub: any) => {
      const pr = promptMap[sub.prompt_id];
      const ser = pr ? seriesMap[pr.series_id] : null;
      const prof = profileMap[sub.user_id];
      return {
        ...sub,
        prompt_headline: pr?.headline ?? null,
        reward_kes: pr?.reward_kes ?? null,
        series_title: ser?.title ?? null,
        seeker_email: prof?.email ?? null,
        seeker_name: prof?.full_name ?? null,
      };
    });

    const totalN = total ?? 0;
    res.json({
      submissions,
      total: totalN,
      page,
      pageSize,
      totalPages: Math.ceil(totalN / pageSize) || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/withdrawal-requests", requireAdminMw, async (req, res) => {
  const statusParam = (req.query.status as string | undefined)?.trim();
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? "25"), 10) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let countQ = supabaseAdmin
      .from("withdrawal_requests")
      .select("*", { count: "exact", head: true });
    let dataQ = supabaseAdmin.from("withdrawal_requests").select(
      `
        *,
        profiles:user_id (email, full_name)
      `
    );

    if (statusParam) {
      const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        countQ = countQ.eq("status", statuses[0]);
        dataQ = dataQ.eq("status", statuses[0]);
      } else if (statuses.length > 1) {
        countQ = countQ.in("status", statuses);
        dataQ = dataQ.in("status", statuses);
      }
    }

    const { count: total, error: cErr } = await countQ;
    if (cErr) throw cErr;

    const { data, error } = await dataQ
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    const totalN = total ?? 0;
    res.json({
      requests: data ?? [],
      total: totalN,
      page,
      pageSize,
      totalPages: Math.ceil(totalN / pageSize) || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/export-earnings-ledger", requireAdminMw, async (_req, res) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from("earnings_ledger")
      .select(
        `
        id,
        user_id,
        amount_kes,
        entry_type,
        reference_type,
        reference_id,
        created_at,
        metadata,
        profiles:user_id (email, full_name)
      `
      )
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) throw error;

    const header = [
      "created_at",
      "user_email",
      "user_name",
      "amount_kes",
      "entry_type",
      "reference_type",
      "reference_id",
      "metadata_json",
      "ledger_id",
    ];

    const lines = [header.join(",")];
    for (const row of rows ?? []) {
      const prof = (row as any).profiles as { email?: string; full_name?: string } | null;
      const meta =
        row.metadata && typeof row.metadata === "object"
          ? JSON.stringify(row.metadata)
          : String(row.metadata ?? "");
      lines.push(
        [
          csvEscapeCell(new Date((row as any).created_at).toISOString()),
          csvEscapeCell(prof?.email ?? ""),
          csvEscapeCell(prof?.full_name ?? ""),
          csvEscapeCell(String((row as any).amount_kes)),
          csvEscapeCell(String((row as any).entry_type)),
          csvEscapeCell(String((row as any).reference_type ?? "")),
          csvEscapeCell(String((row as any).reference_id ?? "")),
          csvEscapeCell(meta),
          csvEscapeCell(String((row as any).id)),
        ].join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=earnings_ledger_${new Date().toISOString().slice(0, 10)}.csv`
    );
    res.send(lines.join("\n"));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/withdrawal-requests/:requestId/settle", requireAdminMw, async (req, res) => {
  const { requestId } = req.params;
  const body = parseJsonBody(req);
  const adminUserId = (req as AuthedRequest).authUserId;
  const amountPaidRaw = body.amountPaidKes ?? body.amount_paid_kes;
  const amountPaid =
    typeof amountPaidRaw === "number" ? amountPaidRaw : parseFloat(String(amountPaidRaw ?? ""));
  const payoutReference = asNonEmptyString(body.payoutReference ?? body.payout_reference) ?? "";
  const adminNote = typeof body.adminNote === "string" ? body.adminNote : null;
  const idempotencyKeyRaw = body.idempotencyKey ?? body.idempotency_key;
  const idempotencyKey =
    typeof idempotencyKeyRaw === "string" && idempotencyKeyRaw.trim().length > 0
      ? idempotencyKeyRaw.trim().slice(0, 200)
      : null;

  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return res.status(400).json({ error: "positive amountPaidKes required" });
  }

  try {
    if (idempotencyKey) {
      const { data: cached } = await supabaseAdmin
        .from("admin_idempotency")
        .select("result_json")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (cached?.result_json && typeof cached.result_json === "object") {
        return res.json(cached.result_json as Record<string, unknown>);
      }
    }

    const { data: wr, error: wErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (wErr || !wr) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (wr.status !== "pending" && wr.status !== "paid_partial") {
      return res.status(400).json({ error: "Request is not open for settlement" });
    }

    const userId = wr.user_id as string;
    const requested = Number(wr.amount_kes_requested);
    const alreadyPaid = Number(wr.amount_paid_kes || 0);
    const remaining = Math.max(0, requested - alreadyPaid);

    if (amountPaid > remaining + 1e-9) {
      return res.status(400).json({
        error: `Amount exceeds remaining owed (${remaining.toFixed(2)} KES)`,
      });
    }

    const balance = await getEarningsBalanceKes(userId);
    if (amountPaid > balance + 1e-9) {
      return res.status(400).json({
        error: `Amount exceeds user earnings balance (${balance.toFixed(2)} KES)`,
      });
    }

    const newTotalPaid = alreadyPaid + amountPaid;
    let newStatus: string = wr.status;
    if (newTotalPaid >= requested - 1e-9) {
      newStatus = "paid_full";
    } else {
      newStatus = "paid_partial";
    }

    const { error: ledErr } = await supabaseAdmin.from("earnings_ledger").insert({
      user_id: userId,
      amount_kes: -Math.round(amountPaid * 100) / 100,
      entry_type: "withdrawal_payout",
      reference_type: "withdrawal_request",
      reference_id: requestId,
      metadata: {
        admin_user_id: adminUserId,
        payout_reference: payoutReference || null,
        admin_note: adminNote,
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      },
    });

    if (ledErr) throw ledErr;

    const { error: upErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        amount_paid_kes: Math.round(newTotalPaid * 100) / 100,
        status: newStatus,
        payout_reference: payoutReference || null,
        admin_note: adminNote,
        resolved_at: new Date().toISOString(),
        resolved_by: adminUserId,
      })
      .eq("id", requestId);

    if (upErr) throw upErr;

    const payload = {
      success: true,
      status: newStatus,
      requestId,
      amountPaidKes: Math.round(amountPaid * 100) / 100,
      amountPaidTotalKes: Math.round(newTotalPaid * 100) / 100,
    };

    if (idempotencyKey) {
      const { error: idemErr } = await supabaseAdmin.from("admin_idempotency").insert({
        idempotency_key: idempotencyKey,
        operation: "withdrawal_settle",
        result_json: payload,
      });
      if (idemErr?.code === "23505") {
        const { data: row } = await supabaseAdmin
          .from("admin_idempotency")
          .select("result_json")
          .eq("idempotency_key", idempotencyKey)
          .single();
        if (row?.result_json && typeof row.result_json === "object") {
          return res.json(row.result_json as Record<string, unknown>);
        }
      } else if (idemErr) {
        throw idemErr;
      }
    }

    res.json(payload);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
