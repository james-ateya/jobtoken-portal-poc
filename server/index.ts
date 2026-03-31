import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { sendMail } from "./mail";
import {
  findPackByKes,
  getTokenPacks,
  initiateStkPush,
  normalizeKenyaPhone,
  parseStkCallbackBody,
} from "./mpesa";

// Load .env from project root (not cwd), so `npm run dev` always finds it
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(projectRoot, ".env") });

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function ensureWallet(userId: string) {
  let { data: wallet, error: walletError } = await supabaseAdmin
    .from("wallets")
    .select("id, token_balance")
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
  res.json({ packs: getTokenPacks() });
});

// --- Simulated top-up (dev / fallback) ---
app.post("/api/topup", async (req, res) => {
  const { userId } = req.body;

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
app.post("/api/mpesa/stk-push", async (req, res) => {
  const { userId, phoneNumber, packKes } = req.body;

  if (!userId || !phoneNumber || packKes == null) {
    return res.status(400).json({ error: "userId, phoneNumber, and packKes are required" });
  }

  const pack = findPackByKes(Number(packKes));
  if (!pack) {
    return res.status(400).json({ error: "Invalid pack amount" });
  }

  try {
    const wallet = await ensureWallet(userId);
    const phone254 = normalizeKenyaPhone(String(phoneNumber));
    if (phone254.length < 12) {
      return res.status(400).json({ error: "Enter a valid Kenya phone number" });
    }

    const stk = await initiateStkPush({
      amountKes: pack.kes,
      phone254,
      accountReference: `JT${wallet.id.slice(0, 8)}`,
      transactionDesc: "JobToken wallet",
    });

    const { error: insertError } = await supabaseAdmin.from("transactions").insert({
      wallet_id: wallet.id,
      tokens_added: 0,
      type: "topup",
      reference_id: `STK-PENDING-${stk.checkoutRequestId}`,
      amount_kes: pack.kes,
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
      tokensOnSuccess: pack.tokens,
      kes: pack.kes,
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
    if (parsed.resultCode !== 0) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "failed" })
        .eq("checkout_request_id", parsed.checkoutRequestId)
        .eq("status", "pending");
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { data: txRows, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("id, wallet_id, amount_kes, status, mpesa_receipt_number")
      .eq("checkout_request_id", parsed.checkoutRequestId)
      .limit(1);

    if (txErr || !txRows?.length) {
      console.warn("Callback: unknown checkout", parsed.checkoutRequestId);
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const tx = txRows[0];
    if (tx.status === "completed") {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (parsed.mpesaReceiptNumber) {
      const { data: dup } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("mpesa_receipt_number", parsed.mpesaReceiptNumber)
        .limit(1);
      if (dup?.length) {
        return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
      }
    }

    const amountKes = parsed.amountKes ?? Number(tx.amount_kes);
    const pack = findPackByKes(Math.round(amountKes));
    if (!pack) {
      console.error("Callback: amount does not match a token pack", amountKes);
      await supabaseAdmin
        .from("transactions")
        .update({ status: "failed", mpesa_receipt_number: parsed.mpesaReceiptNumber })
        .eq("id", tx.id);
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { data: wallet, error: wErr } = await supabaseAdmin
      .from("wallets")
      .select("id, token_balance")
      .eq("id", tx.wallet_id)
      .single();

    if (wErr || !wallet) throw wErr || new Error("Wallet missing");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const newBalance = wallet.token_balance + pack.tokens;

    const { error: upWallet } = await supabaseAdmin
      .from("wallets")
      .update({
        token_balance: newBalance,
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", wallet.id);

    if (upWallet) throw upWallet;

    const { error: upTx } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "completed",
        tokens_added: pack.tokens,
        amount_kes: pack.kes,
        mpesa_receipt_number: parsed.mpesaReceiptNumber,
        reference_id: parsed.mpesaReceiptNumber || `MPESA-${tx.id}`,
      })
      .eq("id", tx.id);

    if (upTx) throw upTx;

    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (e) {
    console.error("Callback error:", e);
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
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

app.post("/api/applications/update-status", async (req, res) => {
  const { applicationId, status, notes } = req.body;

  if (!applicationId || !status) {
    return res.status(400).json({ error: "Missing applicationId or status" });
  }

  try {
    const { data: application, error: updateError } = await supabaseAdmin
      .from("applications")
      .update({ status, notes })
      .eq("id", applicationId)
      .select(
        `
        *,
        jobs (title),
        profiles:user_id (full_name, email)
      `
      )
      .single();

    if (updateError) throw updateError;

    const applicant = (application as any).profiles;
    const job = (application as any).jobs;

    let subject = "";
    let html = "";

    if (status === "shortlisted") {
      subject = `Great news: You've been shortlisted for ${job.title}`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10b981;">Great news, ${applicant.full_name}!</h2>
          <p>The employer for <strong>'${job.title}'</strong> has shortlisted you.</p>
          ${notes ? `<p><strong>Employer note:</strong> ${notes}</p>` : ""}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Thank you for using JobToken.</p>
        </div>
      `;
    } else if (status === "rejected") {
      subject = `Update on your application for ${job.title}`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <p>Hi ${applicant.full_name},</p>
          <p>Thank you for applying to <strong>'${job.title}'</strong>. The employer has decided to move forward with other candidates at this time.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Thank you for using JobToken.</p>
        </div>
      `;
    }

    if (subject && html) {
      await sendMail({
        to: applicant.email,
        subject,
        html,
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Status update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- Employer job posting (fees + featured) ---
app.post("/api/employer/post-job", async (req, res) => {
  const { userId, title, description, job_type, token_cost, is_featured } = req.body;

  if (!userId || !title || !description || !job_type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const postingFee = parseInt(process.env.EMPLOYER_POSTING_FEE_TOKENS || "0", 10);
  const featureFee = parseInt(process.env.FEATURE_JOB_TOKENS || "2", 10);
  const featured = Boolean(is_featured);
  let totalFee = postingFee;
  if (featured) totalFee += featureFee;

  try {
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (pErr || profile?.role !== "employer") {
      return res.status(403).json({ error: "Only employers can post jobs" });
    }

    const wallet = await ensureWallet(userId);

    if (totalFee > 0) {
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
      })
      .select()
      .single();

    if (insErr) throw insErr;

    res.json({ success: true, job });
  } catch (error: any) {
    console.error("post-job:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- Admin ---
app.post("/api/admin/jobs/delete", async (req, res) => {
  const { jobId } = req.body;
  try {
    const { error } = await supabaseAdmin.from("jobs").delete().eq("id", jobId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/tokens/grant", async (req, res) => {
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

app.get("/api/admin/stats", async (req, res) => {
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

    const { count: totalApplications } = await supabaseAdmin
      .from("applications")
      .select("*", { count: "exact", head: true });

    res.json({
      total_revenue: totalRevenue,
      active_seekers: activeSeekers || 0,
      registered_employers: registeredEmployers || 0,
      total_applications: totalApplications || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/advanced-stats", async (req, res) => {
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

app.get("/api/admin/analytics-report", async (req, res) => {
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

app.get("/api/admin/chart-data", async (req, res) => {
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

app.get("/api/admin/export-csv", async (req, res) => {
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

app.get("/api/admin/global-search", async (req, res) => {
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

export default app;

async function setupVite() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else if (!process.env.VERCEL) {
    app.use(express.static("dist"));
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

setupVite();
