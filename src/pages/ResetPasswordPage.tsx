import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import { Lock, Loader2, KeyRound, ArrowLeft } from "lucide-react";

function hashLooksLikeRecovery(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hash;
  const q = window.location.search;
  return (
    h.includes("type=recovery") ||
    q.includes("type=recovery") ||
    (h.includes("access_token") && h.includes("refresh_token"))
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fromLink = hashLooksLikeRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        setCanReset(true);
      }
      if (session && fromLink && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        setCanReset(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session && fromLink) setCanReset(true);
      setChecking(false);
    });

    const retry = window.setTimeout(() => {
      if (cancelled) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        if (session && fromLink) setCanReset(true);
      });
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      subscription.unsubscribe();
    };
  }, []);

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

    setLoading(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message || "Could not update password.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!canReset) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl text-center space-y-4"
        >
          <KeyRound className="w-12 h-12 text-zinc-600 mx-auto" />
          <h1 className="text-xl font-bold">Link invalid or expired</h1>
          <p className="text-zinc-500 text-sm">
            Open the reset link from your email, or request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block mt-2 px-6 py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400"
          >
            Request new link
          </Link>
          <div>
            <Link to="/login" className="text-sm text-emerald-400 hover:underline inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Sign in
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="text-zinc-500 text-sm mt-2">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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

        <p className="text-center mt-8 text-zinc-500 text-sm">
          <Link to="/login" className="text-emerald-400 hover:underline font-medium">
            Back to sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
