import { useState, type FormEvent } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import { LogIn, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";

async function readLoginApiError(res: Response): Promise<string> {
  const text = await res.text();
  const t = text.trim();
  if (!t || t.startsWith("<")) return `Sign in failed (${res.status})`;
  try {
    const j = JSON.parse(t) as { error?: string };
    return j.error || `Sign in failed (${res.status})`;
  } catch {
    return t.slice(0, 160);
  }
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const passwordJustReset =
    typeof location.state === "object" &&
    location.state !== null &&
    "passwordReset" in location.state &&
    (location.state as { passwordReset?: boolean }).passwordReset === true;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowResend(false);

    try {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.");
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error?.toLowerCase?.().includes("email not confirmed")) {
          setShowResend(true);
        }
        throw new Error(data.error || (await readLoginApiError(res)));
      }

      if (data.requiresOtp) {
        setLoading(false);
        navigate("/verify-otp", {
          state: { email: data.email || email.trim().toLowerCase(), purpose: "login" as const },
        });
        return;
      }

      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessErr) throw sessErr;

      navigate("/");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during sign in.");
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (response.ok) {
        alert("Verification email sent. Please check your inbox.");
        setShowResend(false);
      } else {
        alert(result.error || "Failed to resend email");
      }
    } catch (err) {
      alert("Network error occurred");
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
            <LogIn className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-zinc-500 text-sm mt-2">Enter your credentials to access your account</p>
          <p className="text-xs text-zinc-600 mt-2">
            After password sign-in, a one-time email code is required for all accounts.
          </p>
        </div>

        {passwordJustReset && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-sm text-center leading-relaxed">
            Password updated. Sign in with your new password — you will still receive a sign-in
            verification code by email.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="text-sm font-medium text-zinc-400">Password</label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex flex-col gap-2">
              <span>{error}</span>
              {showResend && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-emerald-400 hover:text-emerald-300 font-medium underline text-left flex items-center gap-2"
                >
                  {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Resend verification email
                </button>
              )}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <p className="text-center mt-8 text-zinc-500 text-sm">
          Don't have an account?{" "}
          <Link to="/signup" className="text-emerald-400 hover:underline font-medium">
            Create one now
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
