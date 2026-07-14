import { useState, useEffect, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { Search, Loader2, Send, Clock, MessageSquare, ArrowLeft, Headset, AlertCircle } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  account_issue: "Account Issue",
  payment_billing: "Payment & Billing",
  token_wallet: "Token Wallet",
  prompt_submissions: "Prompt Submissions",
  job_applications: "Job Applications",
  technical_bug: "Technical Bug",
  feature_request: "Feature Request",
  other: "Other",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-600 dark:text-blue-400", label: "Open" },
  in_progress: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-600 dark:text-amber-400", label: "In Progress" },
  resolved: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-400", label: "Resolved" },
  closed: { bg: "bg-zinc-500/10 border-zinc-500/20", text: "text-zinc-500", label: "Closed" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.open;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface Ticket {
  id: string;
  ticket_number: string;
  email: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface Reply {
  id: string;
  author_role: string;
  body: string;
  created_at: string;
}

export function TicketTrackPage() {
  const [searchParams] = useSearchParams();
  const [ticketNumber, setTicketNumber] = useState(searchParams.get("ticket") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);

  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    const t = searchParams.get("ticket");
    const e = searchParams.get("email");
    if (t && e) {
      setTicketNumber(t);
      setEmail(e);
      lookupTicket(t, e);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function lookupTicket(tn?: string, em?: string) {
    const t = (tn ?? ticketNumber).trim();
    const e = (em ?? email).trim();
    if (!t || !e) return;

    setLoading(true);
    setError(null);
    setTicket(null);
    setReplies([]);

    try {
      const res = await fetch(`/api/support/tickets/lookup?ticket_number=${encodeURIComponent(t)}&email=${encodeURIComponent(e)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Ticket not found.");
      }
      setTicket(data.ticket);
      setReplies(data.replies || []);
    } catch (err: any) {
      setError(err.message || "Could not find ticket.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || !ticket) return;
    setReplying(true);
    setReplyError(null);

    try {
      const res = await fetch("/api/support/tickets/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_number: ticket.ticket_number,
          email: email.trim(),
          body: replyBody.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send reply.");
      }
      setReplyBody("");
      await lookupTicket(ticket.ticket_number, email.trim());
    } catch (err: any) {
      setReplyError(err.message || "Could not send reply.");
    } finally {
      setReplying(false);
    }
  }

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    lookupTicket();
  };

  return (
    <div className="min-h-[80vh] py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black mx-auto mb-4">
              <Search className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">Track Your Ticket</h1>
            <p className="text-zinc-500 text-sm mt-2 leading-relaxed">
              Enter your ticket number and the email you used when submitting.
            </p>
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch} className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.02] mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 ml-1">Ticket number</label>
                <input
                  type="text"
                  required
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 dark:bg-white/5 dark:border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="JT-20250714-0001"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 ml-1">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 dark:bg-white/5 dark:border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || !ticketNumber.trim() || !email.trim()}
              className="w-full py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-4 h-4" /> Look Up Ticket</>}
            </button>
          </form>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Ticket detail */}
          {ticket && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.02] mb-6">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    {ticket.ticket_number}
                  </span>
                  <StatusBadge status={ticket.status} />
                  <span className="text-xs text-zinc-400 capitalize">{ticket.priority} priority</span>
                </div>

                <h2 className="text-lg font-bold mb-2">{ticket.subject}</h2>

                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(ticket.created_at)}
                  </span>
                  <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                  {ticket.resolved_at && (
                    <span className="text-emerald-500">Resolved {formatDate(ticket.resolved_at)}</span>
                  )}
                </div>

                {/* Conversation thread */}
                <div className="border-t border-zinc-100 dark:border-white/5 pt-4 space-y-4">
                  {/* Original description as first message */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Headset className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold">You</span>
                        <span className="text-xs text-zinc-400">{formatDate(ticket.created_at)}</span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words">{ticket.description}</p>
                    </div>
                  </div>

                  {/* Replies */}
                  {replies.map((reply) => {
                    const isSupport = reply.author_role === "admin" || reply.author_role === "system";
                    return (
                      <div key={reply.id} className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isSupport ? "bg-emerald-500/10" : "bg-zinc-200 dark:bg-white/10"
                        }`}>
                          {isSupport ? (
                            <Headset className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <MessageSquare className="w-4 h-4 text-zinc-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-bold ${isSupport ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                              {isSupport ? "Support Team" : "You"}
                            </span>
                            <span className="text-xs text-zinc-400">{formatDate(reply.created_at)}</span>
                          </div>
                          <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words">{reply.body}</p>
                        </div>
                      </div>
                    );
                  })}

                  {replies.filter((r) => r.author_role === "admin").length === 0 && (
                    <div className="text-center py-6 text-zinc-400 text-sm">
                      <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      No response yet. Our team will get back to you within 24 hours.
                    </div>
                  )}
                </div>
              </div>

              {/* Reply form (only if ticket is not closed) */}
              {ticket.status !== "closed" && (
                <form onSubmit={handleReply} className="p-6 rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.02]">
                  <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2 block">Add a reply</label>
                  <textarea
                    required
                    rows={3}
                    maxLength={5000}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 dark:bg-white/5 dark:border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors resize-y mb-3"
                    placeholder="Type your follow-up message here..."
                  />
                  {replyError && (
                    <p className="text-sm text-red-500 mb-3">{replyError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={replying || !replyBody.trim()}
                    className="px-6 py-3 bg-emerald-500 text-black rounded-xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send Reply
                  </button>
                </form>
              )}
            </motion.div>
          )}

          {/* Navigation */}
          <div className="text-center mt-8">
            <Link to="/contact" className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:underline font-medium text-sm">
              <ArrowLeft className="w-4 h-4" />
              Submit a new ticket
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
