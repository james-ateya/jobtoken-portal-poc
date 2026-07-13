import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import { ShieldCheck, Mail, Loader2, ArrowLeft } from "lucide-react";

type OtpPurpose = "signup" | "login";

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  const t = text.trim();
  if (!t || t.startsWith("<")) return `Request failed (${res.status})`;
  try {
    const j = JSON.parse(t) as { error?: string };
    return j.error || `Request failed (${res.status})`;
  } catch {
    return t.slice(0, 160);
  }
}

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    email?: string;
    purpose?: OtpPurpose;
    otpDeliveryFailed?: boolean;
    resumed?: boolean;
    accountDeactivated?: boolean;
    deactivatedMessage?: string;
  } | null;
  const [email] = useState(state?.email ?? "");
  const [purpose] = useState<OtpPurpose>(state?.purpose === "login" ? "login" : "signup");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!email) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-zinc-500">Missing verification context. Start sign-up or sign-in again.</p>
          <Link to="/login" className="text-emerald-400 hover:underline font-medium">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otp.replace(/\s/g, ""), purpose }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (await readApiError(res)));

      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessErr) throw sessErr;

      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not resend code");
    } catch (err: any) {
      setError(err.message || "Could not resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black mx-auto mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">
            {purpose === "signup" ? "Verify your account" : "Confirm sign-in"}
          </h1>
          <p className="text-zinc-500 text-sm mt-2 leading-relaxed">
            {purpose === "signup"
              ? "Enter the verification code sent to your email before you can access the portal."
              : "For your security, enter the code we sent to your email to complete sign-in."}
          </p>
          {(state?.otpDeliveryFailed || state?.resumed) && purpose === "signup" && (
            <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mt-4 leading-relaxed">
              {state?.otpDeliveryFailed
                ? "We could not deliver the email just now. Use Resend code below, or go back and submit sign-up again with the same email."
                : "Continuing your registration — enter the new code we sent, or resend if needed."}
            </p>
          )}
          {state?.accountDeactivated && purpose === "login" ? (
            <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mt-4 leading-relaxed">
              {state.deactivatedMessage ||
                "Your account is paused. After sign-in, top up your wallet to reactivate automatically."}
            </p>
          ) : null}
          <p className="text-xs text-zinc-600 mt-3 flex items-center justify-center gap-2">
            <Mail className="w-3.5 h-3.5" />
            {email}
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d\s]/g, ""))}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors font-mono tracking-widest text-center text-lg"
              placeholder="000000"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify and continue"}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3 text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-emerald-400 hover:text-emerald-300 font-medium disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
          <Link
            to={purpose === "signup" ? "/signup" : "/login"}
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

/** @deprecated Use VerifyOtpPage */
export const SeekerVerifyOtpPage = VerifyOtpPage;
