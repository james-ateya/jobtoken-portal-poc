import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateSixDigitOtp, hashAuthOtp, normalizeEmail } from "./auth-otp.js";
import { sendMail } from "./mail.js";

export const SEEKER_OTP_TTL_MS = 15 * 60 * 1000;
export const SEEKER_OTP_MAX_REQUESTS_PER_HOUR = 8;
export const SEEKER_OTP_MAX_ATTEMPTS = 5;

export type SeekerOtpPurpose = "signup" | "login";

type AdminClient = SupabaseClient;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getAnonAuthClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || "";
  const anon = process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !anon) {
    throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for seeker login.");
  }
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function verifyPasswordAndGetUserId(
  email: string,
  password: string
): Promise<{ userId: string } | { error: string }> {
  const client = getAnonAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: error?.message || "Invalid email or password" };
  }
  await client.auth.signOut();
  return { userId: data.user.id };
}

export async function getProfileRole(
  supabaseAdmin: AdminClient,
  userId: string
): Promise<{ role: string; is_active: boolean | null; email: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role, is_active, email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { role: string; is_active: boolean | null; email: string | null };
}

function accountTypeLabel(role: string | null | undefined): string {
  if (role === "admin") return "administrator";
  if (role === "employer") return "employer";
  if (role === "seeker") return "job seeker";
  return "account";
}

export async function issueSeekerOtp(
  supabaseAdmin: AdminClient,
  params: {
    userId: string;
    email: string;
    purpose: SeekerOtpPurpose;
    role?: string | null;
  }
): Promise<void> {
  const emailNormalized = normalizeEmail(params.email);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: cntErr } = await supabaseAdmin
    .from("seeker_auth_otps")
    .select("*", { count: "exact", head: true })
    .eq("email_normalized", emailNormalized)
    .eq("purpose", params.purpose)
    .gte("created_at", oneHourAgo);
  if (cntErr) throw cntErr;
  if ((count ?? 0) >= SEEKER_OTP_MAX_REQUESTS_PER_HOUR) {
    throw new Error("Too many code requests. Try again in about an hour.");
  }

  const otp = generateSixDigitOtp();
  const otpHash = hashAuthOtp(otp, emailNormalized, params.purpose);
  const expiresAt = new Date(Date.now() + SEEKER_OTP_TTL_MS).toISOString();

  const { error: delErr } = await supabaseAdmin
    .from("seeker_auth_otps")
    .delete()
    .eq("email_normalized", emailNormalized)
    .eq("purpose", params.purpose);
  if (delErr) throw delErr;

  const { error: insErr } = await supabaseAdmin.from("seeker_auth_otps").insert({
    user_id: params.userId,
    email_normalized: emailNormalized,
    purpose: params.purpose,
    otp_hash: otpHash,
    expires_at: expiresAt,
    attempt_count: 0,
  });
  if (insErr) throw insErr;

  const accountLabel = accountTypeLabel(params.role);
  const subject =
    params.purpose === "signup"
      ? "Your JobToken verification code"
      : "Your JobToken sign-in code";
  const intro =
    params.purpose === "signup"
      ? `Welcome to JobToken. Enter this code to verify your ${accountLabel} account:`
      : `Enter this code to complete signing in to your JobToken ${accountLabel} account:`;

  await sendMail({
    to: params.email,
    subject,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #18181b;">
        <h1 style="font-size: 20px; color: #059669;">Security verification</h1>
        <p>${intro}</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 0.25em; font-family: ui-monospace, monospace;">${escapeHtml(otp)}</p>
        <p style="font-size: 13px; color: #71717a;">This code expires in 15 minutes. If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function verifySeekerOtp(
  supabaseAdmin: AdminClient,
  email: string,
  otp: string,
  purpose: SeekerOtpPurpose,
  timingSafeEqual: (a: Buffer, b: Buffer) => boolean
): Promise<{ userId: string }> {
  const emailNormalized = normalizeEmail(email);
  const otpDigits = otp.replace(/\s/g, "");
  if (!/^\d{6}$/.test(otpDigits)) {
    throw new Error("Enter the 6-digit code from your email");
  }

  const { data: row, error: selErr } = await supabaseAdmin
    .from("seeker_auth_otps")
    .select("id, user_id, otp_hash, attempt_count")
    .eq("email_normalized", emailNormalized)
    .eq("purpose", purpose)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (!row) {
    throw new Error("Invalid or expired code. Request a new one.");
  }

  const rowTyped = row as { id: string; user_id: string; otp_hash: string; attempt_count: number };
  if (rowTyped.attempt_count >= SEEKER_OTP_MAX_ATTEMPTS) {
    await supabaseAdmin.from("seeker_auth_otps").delete().eq("id", rowTyped.id);
    throw new Error("Too many incorrect attempts. Request a new code.");
  }

  const expectedHash = rowTyped.otp_hash;
  const actualHash = hashAuthOtp(otpDigits, emailNormalized, purpose);
  const a = Buffer.from(expectedHash, "hex");
  const b = Buffer.from(actualHash, "hex");
  const matches = a.length === b.length && timingSafeEqual(a, b);

  if (!matches) {
    await supabaseAdmin
      .from("seeker_auth_otps")
      .update({ attempt_count: rowTyped.attempt_count + 1 })
      .eq("id", rowTyped.id);
    throw new Error("Invalid code. Check your email and try again.");
  }

  await supabaseAdmin
    .from("seeker_auth_otps")
    .delete()
    .eq("email_normalized", emailNormalized)
    .eq("purpose", purpose);

  return { userId: rowTyped.user_id };
}

export async function createSeekerSessionTokens(
  supabaseAdmin: AdminClient,
  email: string
): Promise<{ access_token: string; refresh_token: string }> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: normalizeEmail(email),
  });
  if (error || !data?.properties?.hashed_token) {
    throw error || new Error("Could not create session");
  }

  const client = getAnonAuthClient();
  const { data: sessionData, error: verifyErr } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyErr || !sessionData.session) {
    throw verifyErr || new Error("Could not verify session");
  }

  return {
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  };
}

export async function createSessionTokensFromPassword(
  email: string,
  password: string
): Promise<{ access_token: string; refresh_token: string }> {
  const client = getAnonAuthClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error || !data.session) {
    throw error || new Error("Could not create session");
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

export async function ensureSeekerProfile(
  supabaseAdmin: AdminClient,
  userId: string,
  email: string,
  fullName: string
): Promise<void> {
  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email: normalizeEmail(email),
      full_name: fullName.trim(),
      role: "seeker",
      is_active: true,
      employer_approval_status: null,
      employer_approved_at: null,
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function ensureEmployerProfile(
  supabaseAdmin: AdminClient,
  userId: string,
  email: string,
  fullName: string
): Promise<void> {
  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email: normalizeEmail(email),
      full_name: fullName.trim(),
      role: "employer",
      is_active: true,
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export type SignupRole = "seeker" | "employer";

export async function findAuthUserForSignupResume(
  supabaseAdmin: AdminClient,
  emailNormalized: string
): Promise<{ user: { id: string; email?: string; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> }; profileId: string } | null> {
  const { data: profileRow, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .ilike("email", emailNormalized)
    .maybeSingle();
  if (profileErr) throw profileErr;

  if (profileRow?.id) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(profileRow.id);
    if (!error && data?.user) {
      return { user: data.user, profileId: profileRow.id };
    }
  }

  let page = 1;
  const perPage = 200;
  while (page <= 10) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users as Array<{
      id: string;
      email?: string;
      email_confirmed_at?: string | null;
      user_metadata?: Record<string, unknown>;
    }>;
    const user = users.find((u) => normalizeEmail(u.email || "") === emailNormalized);
    if (user) {
      return { user, profileId: profileRow?.id ?? user.id };
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

export async function sendSignupOtpOrThrow(
  supabaseAdmin: AdminClient,
  params: {
    userId: string;
    email: string;
    role: SignupRole;
  }
): Promise<void> {
  await issueSeekerOtp(supabaseAdmin, {
    userId: params.userId,
    email: params.email,
    purpose: "signup",
    role: params.role,
  });
}
