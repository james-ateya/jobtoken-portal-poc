import { useState, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Headset, Loader2, ChevronDown, X, Send, Clock, MessageSquare,
  AlertCircle, Eye, EyeOff, RefreshCw, Inbox,
} from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import { AdminPagination } from "../components/AdminPagination";

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

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400", label: "Open" },
  in_progress: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", label: "In Progress" },
  resolved: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", label: "Resolved" },
  closed: { bg: "bg-zinc-500/10 border-zinc-500/20", text: "text-zinc-500", label: "Closed" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.open;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.bg} ${style.text} uppercase tracking-wider`}>
      {style.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface Ticket {
  id: string;
  ticket_number: string;
  email: string;
  name: string | null;
  user_id: string | null;
  category: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

interface Reply {
  id: string;
  author_id: string | null;
  author_role: string;
  author_name: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

interface Props {
  showToast: (message: string, type?: "success" | "error") => void;
}

export function AdminSupportPage({ showToast }: Props) {
  const [stats, setStats] = useState<Record<string, number>>({ open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDebounce, setSearchDebounce] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [detailReplies, setDetailReplies] = useState<Reply[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, categoryFilter, searchDebounce]);

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadTickets(); }, [page, statusFilter, priorityFilter, categoryFilter, searchDebounce]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadStats() {
    try {
      const res = await apiFetch("/api/admin/support/stats");
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }

  async function loadTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (searchDebounce.trim()) params.set("search", searchDebounce.trim());

      const res = await apiFetch(`/api/admin/support/tickets?${params}`);
      const data = await res.json();
      setTickets(data.tickets || []);
      setTotalPages(data.totalPages || 0);
      setTotal(data.total || 0);
    } catch {
      showToast("Failed to load tickets", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    setDetailReplies([]);
    setReplyBody("");
    setIsInternal(false);
    setNewStatus("");

    try {
      const res = await apiFetch(`/api/admin/support/tickets/${id}`);
      const data = await res.json();
      setDetail(data.ticket);
      setDetailReplies(data.replies || []);
    } catch {
      showToast("Failed to load ticket", "error");
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!replyBody.trim() || !selectedId) return;
    setReplying(true);

    try {
      const res = await apiFetch(`/api/admin/support/tickets/${selectedId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: replyBody.trim(),
          is_internal: isInternal,
          new_status: newStatus || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send reply.");
      }
      showToast(isInternal ? "Internal note added" : "Reply sent and email notification delivered");
      setReplyBody("");
      setIsInternal(false);
      setNewStatus("");
      await loadDetail(selectedId);
      loadStats();
      loadTickets();
    } catch (err: any) {
      showToast(err.message || "Failed to send reply", "error");
    } finally {
      setReplying(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await apiFetch(`/api/admin/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      showToast(`Ticket status updated to ${status.replace("_", " ")}`);
      if (detail && detail.id === id) await loadDetail(id);
      loadStats();
      loadTickets();
    } catch {
      showToast("Failed to update status", "error");
    }
  }

  async function handlePriorityChange(id: string, priority: string) {
    try {
      const res = await apiFetch(`/api/admin/support/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) throw new Error();
      showToast(`Priority updated to ${priority}`);
      if (detail && detail.id === id) await loadDetail(id);
      loadTickets();
    } catch {
      showToast("Failed to update priority", "error");
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black">
          <Headset className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-zinc-500 mt-1">Manage and respond to user support requests.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {(["open", "in_progress", "resolved", "closed"] as const).map((key) => {
          const style = STATUS_STYLES[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setStatusFilter(key === statusFilter ? "all" : key); }}
              className={`p-4 rounded-2xl border text-left transition-all ${
                statusFilter === key ? "ring-2 ring-emerald-500" : ""
              } ${style.bg}`}
            >
              <p className={`text-2xl font-bold ${style.text}`}>{stats[key] ?? 0}</p>
              <p className="text-xs font-medium text-zinc-500 mt-1">{style.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-zinc-50 text-zinc-900 border border-zinc-200 dark:bg-white/5 dark:text-white dark:border-white/10 rounded-xl py-2 pl-3 pr-8 text-sm focus:outline-none focus:border-emerald-500"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">{o.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="appearance-none bg-zinc-50 text-zinc-900 border border-zinc-200 dark:bg-white/5 dark:text-white dark:border-white/10 rounded-xl py-2 pl-3 pr-8 text-sm focus:outline-none focus:border-emerald-500"
          >
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">{o.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="appearance-none bg-zinc-50 text-zinc-900 border border-zinc-200 dark:bg-white/5 dark:text-white dark:border-white/10 rounded-xl py-2 pl-3 pr-8 text-sm focus:outline-none focus:border-emerald-500"
          >
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">{o.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticket #, email, subject..."
          className="bg-zinc-50 text-zinc-900 border border-zinc-200 dark:bg-white/5 dark:text-white dark:border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-emerald-500 w-64"
        />
        <button
          type="button"
          onClick={() => { loadTickets(); loadStats(); }}
          className="p-2 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex gap-6">
        {/* Ticket list */}
        <div className={`flex-1 min-w-0 ${selectedId ? "hidden lg:block lg:max-w-md" : ""}`}>
          {loading && tickets.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tickets found</p>
              <p className="text-sm mt-1">Try adjusting your filters.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => loadDetail(t.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all hover:bg-white/5 ${
                      selectedId === t.id ? "border-emerald-500 bg-white/5" : "border-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-zinc-500 tracking-wider">{t.ticket_number}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="text-sm font-bold truncate">{t.subject}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500">
                      <span>{t.email}</span>
                      <span>{formatDate(t.created_at)}</span>
                      <span className="capitalize">{t.priority}</span>
                    </div>
                  </button>
                ))}
              </div>
              <AdminPagination page={page} totalPages={totalPages} total={total} loading={loading} onPageChange={setPage} />
            </>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedId && (
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 min-w-0"
            >
              {detailLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                </div>
              ) : detail ? (
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  {/* Detail header */}
                  <div className="p-5 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-zinc-500 tracking-wider">{detail.ticket_number}</span>
                          <StatusBadge status={detail.status} />
                        </div>
                        <h2 className="text-lg font-bold">{detail.subject}</h2>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-500">
                          <span>{detail.email}</span>
                          {detail.name && <span>{detail.name}</span>}
                          <span>{CATEGORY_LABELS[detail.category] || detail.category}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDateLong(detail.created_at)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedId(null); setDetail(null); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-500"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Quick actions */}
                    <div className="flex flex-wrap gap-3 mt-4">
                      <div className="relative">
                        <select
                          value={detail.status}
                          onChange={(e) => handleStatusChange(detail.id, e.target.value)}
                          className="appearance-none bg-zinc-50 text-zinc-900 border border-zinc-200 dark:bg-white/5 dark:text-white dark:border-white/10 rounded-lg py-1.5 pl-3 pr-7 text-xs font-medium focus:outline-none focus:border-emerald-500"
                        >
                          <option value="open" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">Open</option>
                          <option value="in_progress" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">In Progress</option>
                          <option value="resolved" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">Resolved</option>
                          <option value="closed" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">Closed</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                      </div>
                      <div className="relative">
                        <select
                          value={detail.priority}
                          onChange={(e) => handlePriorityChange(detail.id, e.target.value)}
                          className="appearance-none bg-zinc-50 text-zinc-900 border border-zinc-200 dark:bg-white/5 dark:text-white dark:border-white/10 rounded-lg py-1.5 pl-3 pr-7 text-xs font-medium focus:outline-none focus:border-emerald-500"
                        >
                          <option value="low" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">Low</option>
                          <option value="medium" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">Medium</option>
                          <option value="high" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">High</option>
                          <option value="urgent" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">Urgent</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Conversation thread */}
                  <div className="p-5 max-h-[50vh] overflow-y-auto space-y-4">
                    {/* Original description */}
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold">{detail.name || detail.email}</span>
                          <span className="text-[10px] text-zinc-500">{formatDate(detail.created_at)}</span>
                        </div>
                        <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{detail.description}</p>
                      </div>
                    </div>

                    {detailReplies.map((reply) => {
                      const isAdmin = reply.author_role === "admin";
                      const isSystem = reply.author_role === "system";
                      return (
                        <div key={reply.id} className={`flex gap-3 ${reply.is_internal ? "opacity-70" : ""}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isAdmin ? "bg-emerald-500/20" : isSystem ? "bg-amber-500/20" : "bg-zinc-700"
                          }`}>
                            {reply.is_internal ? (
                              <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                            ) : isAdmin ? (
                              <Headset className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-sm font-bold ${isAdmin ? "text-emerald-400" : ""}`}>
                                {reply.author_name}
                              </span>
                              {reply.is_internal && (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  Internal note
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-500">{formatDate(reply.created_at)}</span>
                            </div>
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{reply.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply form */}
                  <form onSubmit={handleReply} className="p-5 border-t border-white/5 bg-white/[0.02]">
                    <textarea
                      rows={3}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-y mb-3"
                      placeholder={isInternal ? "Add an internal note (not visible to user)..." : "Type your reply to the user..."}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                        />
                        {isInternal ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-zinc-400" />}
                        <span className={isInternal ? "text-amber-400 font-medium" : "text-zinc-400"}>Internal note</span>
                      </label>
                      <div className="relative">
                        <select
                          value={newStatus}
                          onChange={(e) => setNewStatus(e.target.value)}
                          className="appearance-none bg-zinc-50 text-zinc-900 border border-zinc-200 dark:bg-white/5 dark:text-white dark:border-white/10 rounded-lg py-1.5 pl-3 pr-7 text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value="" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">No status change</option>
                          <option value="in_progress" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">Set In Progress</option>
                          <option value="resolved" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">Set Resolved</option>
                          <option value="closed" className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-white">Set Closed</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                      </div>
                      <button
                        type="submit"
                        disabled={replying || !replyBody.trim()}
                        className="ml-auto px-5 py-2 bg-emerald-500 text-black rounded-xl text-sm font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {isInternal ? "Add Note" : "Send Reply"}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="text-center py-20 text-zinc-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p>Could not load ticket details.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
