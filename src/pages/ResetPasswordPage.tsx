import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import { Lock, Loader2, KeyRound, ArrowLeft, Mail } from "lucide-react";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateEmail = typeof location.state?.email === "string" ? location.state.email : "";

  const [email, setEmail] = useState(stateEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const trimmedEmail = email.trim();
    const otpDigits = otp.replace(/\s/g, "");
    if (!/^\d{6}$/.test(otpDigits)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          otp: otpDigits,
          newPassword: password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error("error" in data ? String(data.error) : "Could not reset password.");
      }
      await supabase.auth.signOut();
      navigate("/login", { replace: true, state: { passwordReset: true } });
    } catch (err: any) {
      setError(err.message || "Could not reset password.");
    } finally {
      setLoading(false);
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
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Reset password</h1>
          <p className="text-zinc-500 text-sm mt-2">
            Enter the code from your email and choose a new password. You will sign in on the next
            step.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1">6-digit code</label>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9\s]*"
                autoComplete="one-time-code"
                maxLength={12}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^\d\s]/g, ""))}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-colors font-mono tracking-widest"
                placeholder="000000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1">New password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1">Confirm password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
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
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update password"}
          </button>
        </form>

        <p className="text-center mt-8 text-zinc-500 text-sm space-y-2">
          <Link
            to="/forgot-password"
            className="block text-emerald-400 hover:underline font-medium"
          >
            Request a new code
          </Link>
          <Link to="/login" className="inline-flex items-center gap-2 text-emerald-400 hover:underline font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
