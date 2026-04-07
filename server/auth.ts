import type { NextFunction, Request, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthedRequest = Request & { authUserId: string };

export function extractBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== "string") return null;
  const m = /^Bearer\s+(\S+)/i.exec(h.trim());
  return m ? m[1] : null;
}

/** Verify Supabase JWT and attach `authUserId`. */
export function requireAuth(supabaseAdmin: SupabaseClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({
        error: "Authorization: Bearer <access_token> required",
      });
    }
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    (req as AuthedRequest).authUserId = user.id;
    next();
  };
}

export function requireAdmin(supabaseAdmin: SupabaseClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({
        error: "Authorization: Bearer <access_token> required",
      });
    }
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (p?.role !== "admin") {
      return res.status(403).json({ error: "Admin only" });
    }
    (req as AuthedRequest).authUserId = user.id;
    next();
  };
}

/** Employer with admin approval (can post jobs and use employer prompt RLS). */
export function requireApprovedEmployer(supabaseAdmin: SupabaseClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({
        error: "Authorization: Bearer <access_token> required",
      });
    }
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("role, employer_approval_status, is_active")
      .eq("id", user.id)
      .single();
    if (p?.role !== "employer") {
      return res.status(403).json({ error: "Employer only" });
    }
    if (p.is_active === false) {
      return res.status(403).json({ error: "Account deactivated" });
    }
    if (p.employer_approval_status !== "approved") {
      return res.status(403).json({
        error:
          p.employer_approval_status === "pending"
            ? "Your employer account is pending admin approval. You cannot post jobs until approved."
            : "Your employer account is not approved to post jobs.",
      });
    }
    (req as AuthedRequest).authUserId = user.id;
    next();
  };
}

export function requireEmployer(supabaseAdmin: SupabaseClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({
        error: "Authorization: Bearer <access_token> required",
      });
    }
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (p?.role !== "employer") {
      return res.status(403).json({ error: "Employer only" });
    }
    (req as AuthedRequest).authUserId = user.id;
    next();
  };
}

export function requireSeeker(supabaseAdmin: SupabaseClient) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({
        error: "Authorization: Bearer <access_token> required",
      });
    }
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();
    if (p?.role !== "seeker") {
      return res.status(403).json({ error: "Job seeker only" });
    }
    if (p.is_active === false) {
      return res.status(403).json({ error: "Account deactivated" });
    }
    (req as AuthedRequest).authUserId = user.id;
    next();
  };
}
