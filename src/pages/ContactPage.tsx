import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Headset, Mail, User, Tag, AlignLeft, Loader2, CheckCircle, Copy, Search, ChevronDown } from "lucide-react";
import { apiFetch } from "../lib/apiFetch";

const CATEGORIES = [
  { value: "account_issue", label: "Account Issue" },
  { value: "payment_billing", label: "Payment & Billing" },
  { value: "token_wallet", label: "Token Wallet" },
  { value: "prompt_submissions", label: "Prompt Submissions" },
  { value: "job_applications", label: "Job Applications" },
  { value: "technical_bug", label: "Technical Bug" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
] as const;

interface Props {
  showToast: (message: string, type?: "success" | "error") => void;
  user: { email?: string } | null;
}

export function ContactPage({ showToast, user }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user]);

  const canSubmit =
    email.trim().length > 0 &&
    subject.trim().length >= 5 &&
    description.trim().length >= 20 &&
    !loading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          category,
          subject: subject.trim(),
          description: description.trim(),
          company_website: honeypot || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit ticket.");
      }
      setTicketNumber(data.ticket_number);
      showToast("Ticket submitted successfully!");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (ticketNumber) {
      navigator.clipboard.writeText(ticketNumber);
      showToast("Ticket number copied!");
    }
  };

  const handleReset = () => {
    setSubject("");
    setDescription("");
    setCategory("other");
    setError(null);
    setTicketNumber(null);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg p-8 rounded-3xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.02] backdrop-blur-xl"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black mx-auto mb-4">
            <Headset className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold">Contact Support</h1>
          <p className="text-zinc-500 text-sm mt-2 leading-relaxed max-w-sm mx-auto">
            Submit a ticket and our support team will respond within 24 hours.
          </p>
        </div>

        {ticketNumber ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 text-center"
          >
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">Ticket Submitted</h2>
              <p className="text-zinc-500 text-sm">Your ticket has been created and a confirmation email has been sent.</p>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2">Your ticket number</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl font-bold tracking-wider text-emerald-600 dark:text-emerald-400">{ticketNumber}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2 rounded-lg hover:bg-emerald-500/20 transition-colors text-emerald-600 dark:text-emerald-400"
                  title="Copy ticket number"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => navigate(`/support/track?ticket=${encodeURIComponent(ticketNumber)}&email=${encodeURIComponent(email.trim())}`)}
                className="flex-1 py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                Track This Ticket
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-3 border border-zinc-300 dark:border-white/10 rounded-xl font-bold hover:bg-zinc-100 dark:hover:bg-white/5 transition-all active:scale-[0.98]"
              >
                Submit Another
              </button>
            </div>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 ml-1">Category</label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-zinc-50 text-zinc-900 border border-zinc-200 dark:bg-white/5 dark:text-white dark:border-white/10 rounded-xl py-3 pl-12 pr-10 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value} className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">{c.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 ml-1">Email address <span className="text-red-400">*</span></label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 dark:bg-white/5 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 ml-1">Your name <span className="text-zinc-400 dark:text-zinc-600 text-xs">(optional)</span></label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 dark:bg-white/5 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 ml-1">Subject <span className="text-red-400">*</span></label>
              <input
                type="text"
                required
                minLength={5}
                maxLength={200}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 dark:bg-white/5 dark:border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="Brief summary of your issue"
              />
              {subject.length > 0 && subject.trim().length < 5 && (
                <p className="text-xs text-amber-500 ml-1">At least 5 characters required</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 ml-1">Description <span className="text-red-400">*</span></label>
              <textarea
                required
                minLength={20}
                maxLength={5000}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 dark:bg-white/5 dark:border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-y"
                placeholder="Please describe your issue in detail. Include any relevant transaction IDs, error messages, or steps to reproduce the problem."
              />
              <div className="flex justify-between items-center">
                {description.length > 0 && description.trim().length < 20 && (
                  <p className="text-xs text-amber-500 ml-1">At least 20 characters required</p>
                )}
                <p className={`text-xs ml-auto ${description.length > 4500 ? "text-amber-500" : "text-zinc-400"}`}>
                  {description.length.toLocaleString()} / 5,000
                </p>
              </div>
            </div>

            {/* Honeypot */}
            <input
              type="text"
              name="company_website"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ position: "absolute", left: "-9999px" }}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-4 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Submit Ticket"
              )}
            </button>

            <p className="text-center text-sm text-zinc-500">
              Already have a ticket?{" "}
              <Link to="/support/track" className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                Track it here
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}
