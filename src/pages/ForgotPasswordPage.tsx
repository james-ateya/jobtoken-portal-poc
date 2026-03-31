import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import { Mail, ArrowLeft, Loader2, KeyRound } from "lucide-react";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error("Supabase is not configured.");
      }

      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });

      if (resetErr) throw resetErr;

      setSent(true);
    } catch (err: any) {
      setError(err.message || "Could not send reset email.");
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
          <h1 className="text-2xl font-bold">Forgot password</h1>
          <p className="text-zinc-500 text-sm mt-2">
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
        </div>

        {sent ? (
          <div className="space-y-6 text-center">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-sm">
              If an account exists for <strong className="text-white">{email.trim()}</strong>, you
              will receive an email with reset instructions shortly. Check your spam folder if you
              don&apos;t see it.
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400 ml-1">Email address</label>
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
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send reset link"}
            </button>
          </form>
        )}

        {!sent && (
          <p className="text-center mt-8 text-zinc-500 text-sm">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-emerald-400 hover:underline font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
