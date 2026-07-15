import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Loader2,
  Banknote,
  ArrowLeft,
  Download,
  Phone,
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  CheckCircle,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";

type WithdrawalReq = {
  id: string;
  user_id: string;
  amount_kes_requested: number | string;
  period_month: string;
  status: string;
  amount_paid_kes: number | string;
  payout_reference: string | null;
  admin_note: string | null;
  payout_phone: string | null;
  created_at: string;
  profiles?: { email?: string; full_name?: string; phone?: string } | null;
};

type PayoutSummary = {
  total_earnings_credited: number;
  total_adjustments: number;
  total_requested: number;
  total_paid_out: number;
  total_settled_on_requests: number;
  outstanding_balance: number;
  pending_count: number;
  pending_amount: number;
  paid_full_count: number;
  paid_partial_count: number;
  rejected_count: number;
  total_requests: number;
};

function fmtKes(n: number): string {
  return n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function num(v: number | string | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function AdminWithdrawalsPage({
  user: _user,
  showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [requests, setRequests] = useState<WithdrawalReq[]>([]);
  const [openRequests, setOpenRequests] = useState<WithdrawalReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 25;
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [amountById, setAmountById] = useState<Record<string, string>>({});
  const [refById, setRefById] = useState<Record<string, string>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [exportingCsv, setExportingCsv] = useState(false);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [exportingPaidCsv, setExportingPaidCsv] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await apiFetch("/api/admin/withdrawal-requests/payout-summary");
      const j = await res.json().catch(() => ({}));
      if (res.ok) setSummary(j as PayoutSummary);
    } catch { /* silent */ } finally {
      setSummaryLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const openQ = `status=${encodeURIComponent("pending,paid_partial")}&page=1&pageSize=100`;
      const browseStatus = statusFilter !== "all" ? `&status=${encodeURIComponent(statusFilter)}` : "";
      const [openRes, pageRes] = await Promise.all([
        apiFetch(`/api/admin/withdrawal-requests?${openQ}`),
        apiFetch(`/api/admin/withdrawal-requests?page=${page}&pageSize=${pageSize}${browseStatus}`),
      ]);
      const jo = await openRes.json().catch(() => ({}));
      const jp = await pageRes.json().catch(() => ({}));
      if (!openRes.ok) throw new Error(jo.error || "Failed to load open requests");
      if (!pageRes.ok) throw new Error(jp.error || "Failed to load");
      setOpenRequests((jo.requests ?? []) as WithdrawalReq[]);
      setRequests((jp.requests ?? []) as WithdrawalReq[]);
      setTotalPages(Math.max(1, Number(jp.totalPages) || 1));
    } catch (e: any) {
      showToast(e.message || "Could not load requests", "error");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, showToast]);

  useEffect(() => {
    load();
    loadSummary();
  }, [load, loadSummary]);

  const setDefaultAmount = (r: WithdrawalReq) => {
    const rem = Math.max(0, num(r.amount_kes_requested) - num(r.amount_paid_kes));
    if (!amountById[r.id] && rem > 0) {
      setAmountById((m) => ({ ...m, [r.id]: String(Math.round(rem * 100) / 100) }));
    }
  };

  const settle = async (e: FormEvent, r: WithdrawalReq) => {
    e.preventDefault();
    const raw = amountById[r.id]?.trim() || "";
    const amount = parseFloat(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid payout amount (KES)", "error");
      return;
    }
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${r.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setSettlingId(r.id);
    try {
      const res = await apiFetch(`/api/admin/withdrawal-requests/${r.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPaidKes: amount,
          payoutReference: refById[r.id]?.trim() || "",
          adminNote: noteById[r.id]?.trim() || null,
          idempotencyKey,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Settlement failed");
      showToast(`Recorded. Status: ${j.status || "updated"}`, "success");
      load();
      loadSummary();
    } catch (e: any) {
      showToast(e.message || "Could not settle", "error");
    } finally {
      setSettlingId(null);
    }
  };

  const formatPhone = (r: WithdrawalReq): string => {
    const phone = r.payout_phone || r.profiles?.phone || "";
    if (phone.startsWith("254") && phone.length === 12) return `0${phone.slice(3)}`;
    return phone;
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const statusQ = statusFilter !== "all" ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await apiFetch(`/api/admin/withdrawal-requests/export-csv${statusQ}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Export failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `withdrawal-requests-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("CSV downloaded", "success");
    } catch (e: any) {
      showToast(e.message || "Export failed", "error");
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPaidCsv = async () => {
    setExportingPaidCsv(true);
    try {
      const res = await apiFetch(
        `/api/admin/withdrawal-requests/export-csv?status=${encodeURIComponent("paid_full,paid_partial")}`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Export failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payouts-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Payouts report downloaded", "success");
    } catch (e: any) {
      showToast(e.message || "Export failed", "error");
    } finally {
      setExportingPaidCsv(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Withdrawal requests</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Record M-Pesa or bank payouts; ledger debits the seeker&apos;s earnings balance.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="all" className="bg-zinc-800 text-white">All statuses</option>
            <option value="pending" className="bg-zinc-800 text-white">Pending</option>
            <option value="paid_partial" className="bg-zinc-800 text-white">Paid partial</option>
            <option value="paid_full" className="bg-zinc-800 text-white">Paid full</option>
            <option value="rejected" className="bg-zinc-800 text-white">Rejected</option>
          </select>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 disabled:opacity-40"
          >
            {exportingCsv ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export CSV
          </button>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30"
            >
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30"
            >
              Next
            </button>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            Admin home
          </Link>
        </div>
      </div>

      {/* Payout Summary Report */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/[0.02] mb-8 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              Payout Report
            </h2>
          </div>
          <button
            type="button"
            onClick={handleExportPaidCsv}
            disabled={exportingPaidCsv}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
          >
            {exportingPaidCsv ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            Export Paid CSV
          </button>
        </div>
        {summaryLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : summary ? (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total Earned</p>
                </div>
                <p className="text-xl font-black text-emerald-400 tabular-nums">
                  {fmtKes(summary.total_earnings_credited)}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">KES credited to seekers</p>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total Paid Out</p>
                </div>
                <p className="text-xl font-black text-red-400 tabular-nums">
                  {fmtKes(summary.total_paid_out)}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">KES via M-Pesa/bank</p>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-amber-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Outstanding</p>
                </div>
                <p className="text-xl font-black text-amber-400 tabular-nums">
                  {fmtKes(summary.outstanding_balance)}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  Earned {summary.total_adjustments !== 0 ? `+ adjustments (${fmtKes(summary.total_adjustments)}) ` : ""}minus paid out
                </p>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pending</p>
                </div>
                <p className="text-xl font-black text-blue-400 tabular-nums">
                  {fmtKes(summary.pending_amount)}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">{summary.pending_count} request{summary.pending_count !== 1 ? "s" : ""} awaiting payout</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                <p className="text-lg font-black tabular-nums">{summary.total_requests}</p>
                <p className="text-[10px] font-bold uppercase text-zinc-500 mt-0.5">Total Requests</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <p className="text-lg font-black text-emerald-400 tabular-nums">{summary.paid_full_count}</p>
                </div>
                <p className="text-[10px] font-bold uppercase text-zinc-500 mt-0.5">Paid Full</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                <p className="text-lg font-black text-blue-400 tabular-nums">{summary.paid_partial_count}</p>
                <p className="text-[10px] font-bold uppercase text-zinc-500 mt-0.5">Paid Partial</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center">
                <p className="text-lg font-black text-zinc-500 tabular-nums">{summary.rejected_count}</p>
                <p className="text-[10px] font-bold uppercase text-zinc-500 mt-0.5">Rejected</p>
              </div>
            </div>

            {summary.total_paid_out > 0 && summary.total_earnings_credited > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-zinc-400">Payout ratio (paid out / earned)</span>
                  <span className={cn(
                    "font-bold",
                    (summary.total_paid_out / summary.total_earnings_credited) > 0.8
                      ? "text-red-400"
                      : (summary.total_paid_out / summary.total_earnings_credited) > 0.5
                        ? "text-amber-400"
                        : "text-emerald-400"
                  )}>
                    {((summary.total_paid_out / summary.total_earnings_credited) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      (summary.total_paid_out / summary.total_earnings_credited) > 0.8
                        ? "bg-red-500"
                        : (summary.total_paid_out / summary.total_earnings_credited) > 0.5
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    )}
                    style={{ width: `${Math.min(100, (summary.total_paid_out / summary.total_earnings_credited) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-zinc-600 py-6 text-sm">Could not load payout summary.</p>
        )}
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
            Open (pending / partial)
          </h2>
          <p className="text-xs text-zinc-600 -mt-2 mb-2">
            All open requests (up to 100, newest first). Independent of the paginated table below.
          </p>
          {openRequests.length === 0 ? (
            <p className="text-zinc-500 py-8 text-center border border-dashed border-white/10 rounded-2xl">
              No open withdrawal requests.
            </p>
          ) : (
            <ul className="space-y-4">
              {openRequests.map((r, i) => {
                const requested = num(r.amount_kes_requested);
                const paid = num(r.amount_paid_kes);
                const remaining = Math.max(0, requested - paid);
                return (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="font-semibold">
                          {r.profiles?.full_name || "—"}{" "}
                          <span className="text-zinc-500 font-normal">
                            ({r.profiles?.email || r.user_id})
                          </span>
                        </p>
                        {formatPhone(r) && (
                          <p className="text-sm text-emerald-400 mt-1 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" />
                            M-Pesa: {formatPhone(r)}
                          </p>
                        )}
                        <p className="text-xs text-zinc-500 mt-1">
                          Period {r.period_month} · Requested {requested.toFixed(2)} KES · Paid so far{" "}
                          {paid.toFixed(2)} · Remaining {remaining.toFixed(2)}
                        </p>
                        <span
                          className={cn(
                            "inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                            r.status === "pending"
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              : "bg-blue-500/15 text-blue-300 border-blue-500/30"
                          )}
                        >
                          {r.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <form
                      onSubmit={(e) => settle(e, r)}
                      onFocus={() => setDefaultAmount(r)}
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
                    >
                      <div>
                        <label className="text-[10px] font-bold uppercase text-zinc-500">
                          Pay now (KES)
                        </label>
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={amountById[r.id] ?? ""}
                          onChange={(e) =>
                            setAmountById((m) => ({ ...m, [r.id]: e.target.value }))
                          }
                          placeholder={remaining.toFixed(2)}
                          className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-zinc-500">
                          Reference
                        </label>
                        <input
                          type="text"
                          value={refById[r.id] ?? ""}
                          onChange={(e) =>
                            setRefById((m) => ({ ...m, [r.id]: e.target.value }))
                          }
                          placeholder="M-Pesa / receipt"
                          className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-zinc-500">
                          Note
                        </label>
                        <input
                          type="text"
                          value={noteById[r.id] ?? ""}
                          onChange={(e) =>
                            setNoteById((m) => ({ ...m, [r.id]: e.target.value }))
                          }
                          className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={settlingId === r.id}
                        className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 disabled:opacity-40"
                      >
                        {settlingId === r.id ? (
                          <Loader2 className="w-4 h-4 animate-spin inline" />
                        ) : (
                          "Record payout"
                        )}
                      </button>
                    </form>
                  </motion.li>
                );
              })}
            </ul>
          )}

          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 pt-8">
            Browse (all statuses)
          </h2>
          <p className="text-xs text-zinc-600 -mt-2 mb-2">
            Page {page} of {totalPages} — {pageSize} rows per page.
          </p>
          <div className="rounded-2xl border border-white/10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-zinc-500">
                  <th className="p-3 font-medium">Created</th>
                  <th className="p-3 font-medium">User</th>
                  <th className="p-3 font-medium">Phone (M-Pesa)</th>
                  <th className="p-3 font-medium">Requested</th>
                  <th className="p-3 font-medium">Paid</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="p-3 text-zinc-400 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">{r.profiles?.email ?? r.user_id}</td>
                    <td className="p-3 text-zinc-300 whitespace-nowrap">{formatPhone(r) || "—"}</td>
                    <td className="p-3 tabular-nums">{num(r.amount_kes_requested).toFixed(2)}</td>
                    <td className="p-3 tabular-nums">{num(r.amount_paid_kes).toFixed(2)}</td>
                    <td className="p-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
