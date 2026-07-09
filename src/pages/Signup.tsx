import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { UserPlus, Mail, Lock, User, ArrowRight, Loader2, Tag, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";

async function readSignupError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error || "Signup failed";
}

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"seeker" | "employer">("seeker");
  const [couponCode, setCouponCode] = useState("");
  const [showCoupon, setShowCoupon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error(
          "Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables."
        );
      }

      const endpoint =
        role === "seeker" ? "/api/auth/seeker/signup" : "/api/auth/employer/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          ...(role === "seeker" && couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || (await readSignupError(res)));
      }

      navigate("/verify-otp", {
        replace: true,
        state: {
          email: data.email || email.trim().toLowerCase(),
          purpose: "signup" as const,
          otpDeliveryFailed: data.otpDeliveryFailed === true,
          resumed: data.resumed === true,
        },
      });
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during sign up.");
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
            <UserPlus className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-zinc-500 text-sm mt-2">Join the future of job applications</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {role === "employer" ? (
            <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-4 leading-relaxed">
              Employer accounts are reviewed by an administrator. Verify your email with the 6-digit
              code, then wait for approval before posting jobs.
            </p>
          ) : (
            <p className="text-xs text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 mb-4 leading-relaxed">
              Job seeker accounts are verified by a 6-digit code sent to your email before you can
              access the portal. If registration was interrupted, submit the form again with the same
              email to receive a new code.
            </p>
          )}

          <div className="flex p-1 bg-white/5 rounded-xl border border-white/10 mb-6">
            <button
              type="button"
              onClick={() => setRole("seeker")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                role === "seeker" ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
              )}
            >
              Job Seeker
            </button>
            <button
              type="button"
              onClick={() => setRole("employer")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                role === "employer" ? "bg-emerald-500 text-black" : "text-zinc-500 hover:text-white"
              )}
            >
              Employer
            </button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400 ml-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="John Doe"
              />
            </div>
          </div>

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
            <label className="text-sm font-medium text-zinc-400 ml-1">Password</label>
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

          {role === "seeker" && (
            <div>
              <button
                type="button"
                onClick={() => setShowCoupon((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <Tag className="w-3.5 h-3.5" />
                Have a referral code?
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    showCoupon && "rotate-180"
                  )}
                />
              </button>
              {showCoupon && (
                <div className="mt-2 relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-amber-500/50 transition-colors text-sm uppercase tracking-wider"
                    placeholder="e.g. JT-ABC123"
                    maxLength={12}
                  />
                  <p className="text-[10px] text-zinc-600 mt-1 ml-1">
                    Top up Ksh 100+ within 48 hours to claim 3 bonus tokens.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign Up"}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <p className="text-center mt-8 text-zinc-500 text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-emerald-400 hover:underline font-medium">
            Sign in here
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
