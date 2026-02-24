import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Resend Client
const resend = new Resend(process.env.RESEND_API_KEY);

// API Routes
app.post("/api/auth/resend-verification", async (req, res) => {
  const { email, type, jobId } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    if (type === 'application_confirmation') {
      const { data: job } = await supabaseAdmin.from('jobs').select('title').eq('id', jobId).single();
      
      await resend.emails.send({
        from: 'JobToken <notifications@resend.dev>',
        to: [email],
        subject: `Application Confirmed: ${job?.title || 'New Job'}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #10b981;">Application Received!</h2>
            <p>Your application for <strong>${job?.title || 'the position'}</strong> has been successfully submitted.</p>
            <p>The employer has been notified and will review your profile shortly.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">Thank you for using JobToken.</p>
          </div>
        `
      });
      return res.json({ success: true });
    }

    // 1. Generate a magic link using Supabase Admin
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
      options: { redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/` }
    });

    if (linkError) throw linkError;

    const verificationLink = data.properties.action_link;

    // 2. Send the email via Resend
    const { error: resendError } = await resend.emails.send({
      from: 'JobToken <onboarding@resend.dev>',
      to: [email],
      subject: 'Verify your JobToken account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10b981;">Welcome to JobToken!</h2>
          <p>Please click the button below to verify your email address and start applying for jobs.</p>
          <a href="${verificationLink}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0;">Verify Email</a>
          <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">${verificationLink}</p>
        </div>
      `
    });

    if (resendError) throw resendError;

    res.json({ success: true, message: "Verification email sent via Resend" });
  } catch (error: any) {
    console.error("Resend error:", error);
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
});

app.post("/api/topup", async (req, res) => {
  const { userId } = req.body;

  try {
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("id, token_balance")
      .eq("user_id", userId)
      .single();

    if (walletError || !wallet) throw new Error("Wallet not found");

    const refId = `MPESA-${Math.random().toString(36).toUpperCase().slice(2, 10)}`;

    // 1. Record Transaction (Simulating completed topup)
    const { error: insertError } = await supabaseAdmin.from("transactions").insert({
      wallet_id: wallet.id,
      tokens_added: 5,
      type: "topup",
      reference_id: refId
    });

    if (insertError) {
      console.error("Transaction insert error:", insertError);
      throw new Error(`Failed to record transaction: ${insertError.message}`);
    }

    // 2. Simulate Daraja Callback Delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 3. Atomic Update
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({ 
        token_balance: wallet.token_balance + 5,
        expires_at: expiresAt.toISOString()
      })
      .eq("id", wallet.id);

    if (updateError) throw updateError;

    res.json({ success: true, newBalance: wallet.token_balance + 5 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/applications/update-status", async (req, res) => {
  const { applicationId, status, notes } = req.body;

  if (!applicationId || !status) {
    return res.status(400).json({ error: "Missing applicationId or status" });
  }

  try {
    // 1. Update application status
    const { data: application, error: updateError } = await supabaseAdmin
      .from("applications")
      .update({ status, notes })
      .eq("id", applicationId)
      .select(`
        *,
        jobs (title),
        profiles:user_id (full_name, email)
      `)
      .single();

    if (updateError) throw updateError;

    // 2. Send email via Resend
    const applicant = (application as any).profiles;
    const job = (application as any).jobs;

    let subject = "";
    let html = "";

    if (status === "shortlisted") {
      subject = `Great news: You've been shortlisted for ${job.title}`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10b981;">Great news, ${applicant.full_name}!</h2>
          <p>The employer for <strong>'${job.title}'</strong> has shortlisted you. They will contact you shortly via this email.</p>
          ${notes ? `<p><strong>Employer Note:</strong> ${notes}</p>` : ""}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Thank you for using JobToken.</p>
        </div>
      `;
    } else if (status === "rejected") {
      subject = `Update on your application for ${job.title}`;
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <p>Hi ${applicant.full_name},</p>
          <p>Thank you for applying to <strong>'${job.title}'</strong>. Unfortunately, the employer has decided to move forward with other candidates at this time.</p>
          <p>We wish you the best in your job search.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">Thank you for using JobToken.</p>
        </div>
      `;
    }

    if (subject && html) {
      await resend.emails.send({
        from: 'JobToken <notifications@resend.dev>',
        to: [applicant.email],
        subject,
        html
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Status update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Admin Endpoints
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
    // 1. Find user by email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (profileError || !profile) throw new Error("User not found");

    // 2. Get wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("id, token_balance")
      .eq("user_id", profile.id)
      .single();

    if (walletError || !wallet) throw new Error("Wallet not found");

    // 3. Update balance
    const { error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({ token_balance: wallet.token_balance + amount })
      .eq("id", wallet.id);

    if (updateError) throw updateError;

    // 4. Record transaction
    const { error: txInsertError } = await supabaseAdmin.from("transactions").insert({
      wallet_id: wallet.id,
      tokens_added: amount,
      type: "admin_grant",
      reference_id: `ADMIN-${Math.random().toString(36).toUpperCase().slice(2, 8)}`
    });

    if (txInsertError) {
      console.error("Admin grant transaction error:", txInsertError);
      throw new Error(`Failed to log admin transaction: ${txInsertError.message}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/stats", async (req, res) => {
  try {
    // 1. Total Revenue (Sum of all topups)
    const { data: topups } = await supabaseAdmin
      .from("transactions")
      .select("tokens_added")
      .eq("type", "topup");
    
    // Each token is roughly Ksh 20 (5 tokens for Ksh 100)
    const totalRevenue = (topups?.length || 0) * 100;

    // 2. Active Seekers (Users with role 'seeker')
    const { count: activeSeekers } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: 'exact', head: true })
      .eq("role", "seeker");

    // 3. Registered Employers
    const { count: registeredEmployers } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: 'exact', head: true })
      .eq("role", "employer");

    // 4. Total Applications
    const { count: totalApplications } = await supabaseAdmin
      .from("applications")
      .select("*", { count: 'exact', head: true });

    res.json({
      total_revenue: totalRevenue,
      active_seekers: activeSeekers || 0,
      registered_employers: registeredEmployers || 0,
      total_applications: totalApplications || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/advanced-stats", async (req, res) => {
  try {
    // 1. Active Token Liability
    const { data: wallets } = await supabaseAdmin.from("wallets").select("token_balance");
    const totalLiability = wallets?.reduce((acc, w) => acc + w.token_balance, 0) || 0;

    // 2. Revenue per Job Category (Estimated from applications)
    // Assuming each application costs 1 token (Ksh 20)
    const { data: catStats } = await supabaseAdmin
      .from("jobs")
      .select("job_type, applications(count)");
    
    const revenuePerCategory: Record<string, number> = {};
    catStats?.forEach(job => {
      const count = (job.applications as any)?.[0]?.count || 0;
      revenuePerCategory[job.job_type] = (revenuePerCategory[job.job_type] || 0) + (count * 20);
    });

    // 3. Average Time to Hire (Shortlisted status)
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
      avgTimeToHire = totalDiff / hiredApps.length / (1000 * 60 * 60 * 24); // in days
    }

    res.json({
      token_liability: totalLiability,
      revenue_per_category: revenuePerCategory,
      avg_time_to_hire: avgTimeToHire.toFixed(1)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/admin/analytics-report", async (req, res) => {
  try {
    // Attempt to query the view directly as requested
    const { data, error } = await supabaseAdmin
      .from("admin_analytics_report")
      .select("*");
    
    if (error) {
      console.warn("admin_analytics_report view not found, falling back to simulation");
      // Fallback simulation if view doesn't exist
      const { data: jobs, error: jobsError } = await supabaseAdmin
        .from("jobs")
        .select(`
          id,
          title,
          job_type,
          created_at,
          profiles:posted_by(full_name),
          applications(count)
        `);
      
      if (jobsError) throw jobsError;

      const report = jobs.map(job => ({
        id: job.id,
        title: job.title,
        category: job.job_type,
        employer: (job.profiles as any)?.full_name,
        applicant_count: (job.applications as any)?.[0]?.count || 0,
        posted_at: job.created_at
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

    // Daily Applications
    const { data: apps } = await supabaseAdmin
      .from("applications")
      .select("created_at")
      .gte("created_at", last7Days.toISOString());

    // Daily Revenue (Topups)
    const { data: topups } = await supabaseAdmin
      .from("transactions")
      .select("created_at")
      .eq("type", "topup")
      .gte("created_at", last7Days.toISOString());

    const chartData: Record<string, { date: string, applications: number, revenue: number }> = {};
    
    // Initialize last 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      chartData[dateStr] = { date: dateStr, applications: 0, revenue: 0 };
    }

    apps?.forEach(app => {
      const dateStr = app.created_at.split('T')[0];
      if (chartData[dateStr]) chartData[dateStr].applications++;
    });

    topups?.forEach(t => {
      const dateStr = t.created_at.split('T')[0];
      if (chartData[dateStr]) chartData[dateStr].revenue += 100; // Ksh 100 per topup
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
      .select(`
        created_at,
        tokens_added,
        type,
        reference_id,
        wallet:wallet_id(profiles:user_id(email))
      `)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) throw error;

    const csvRows = [
      ["Date", "User Email", "Tokens", "Type", "Reference ID"].join(",")
    ];

    txs?.forEach(tx => {
      const row = [
        new Date(tx.created_at).toLocaleString(),
        (tx.wallet as any)?.profiles?.email || "N/A",
        tx.tokens_added,
        tx.type,
        tx.reference_id
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
    // Search in transactions (Ref ID)
    const { data: txResults } = await supabaseAdmin
      .from("transactions")
      .select(`
        id,
        reference_id,
        type,
        created_at,
        wallet:wallet_id(profiles:user_id(email))
      `)
      .ilike("reference_id", `%${query}%`)
      .limit(5);

    // Search in profiles (Email)
    const { data: profileResults } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, role")
      .ilike("email", `%${query}%`)
      .limit(5);

    res.json({
      transactions: txResults || [],
      profiles: profileResults || []
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupVite();
