import { useCallback, useEffect, useState, useRef, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronRight, Loader2, PiggyBank } from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";
import { AdminPagination } from "../components/AdminPagination";
import { AdminVirtualList } from "../components/AdminVirtualList";

type PayoutUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  earnings_balance_kes: number;
  planning_status: "requested" | "awaiting_request";
  expected_pay_kes: number;
  pay_by_date: string | null;
  next_request_window: string | null;
  withdrawal_request: {
    id: string;
    amount_requested: number;
    amount_paid: number;
    amount_remaining: number;
    period_month: string;
    status: string;
    created_at: string;
  } | null;
};

type PayoutReport = {
  schedule: string;
  next_withdrawal_window: string;
  withdrawal_window_open: boolean;
  summary: {
    users_count: number;
    open_requests_count: number;
    total_earnings_balance_kes: number;
    committed_pay_kes: number;
    potential_pay_kes: number;
  };
  users: PayoutUser[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

function formatKes(value: number): string {
  return value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function AdminPayoutPlanningPage({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [report, setReport] = useState<PayoutReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [amountById, setAmountById] = useState<Record<string, string>>({});
  const [refById, setRefById] = useState<Record<string, string>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/admin/payout-planning-report?page=${page}&pageSize=${pageSize}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load payout report");
      setReport(json as PayoutReport);
      setTotalPages(Math.max(1, Number(json.totalPages) || 1));
    } catch (error: any) {
      showToast(error.message || "Could not load payout report", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const setDefaultAmount = (requestId: string, remaining: number) => {
    if (!amountById[requestId] && remaining > 0) {
      setAmountById((current) => ({
        ...current,
        [requestId]: String(Math.round(remaining * 100) / 100),
      }));
    }
  };

  const settle = async (e: FormEvent, row: PayoutUser) => {
    e.preventDefault();
    const request = row.withdrawal_request;
    if (!request) return;

    const raw = amountById[request.id]?.trim() || "";
    const amount = parseFloat(raw);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid payout amount (KES)", "error");
      return;
    }

    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${request.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setSettlingId(request.id);
    try {
      const res = await apiFetch(`/api/admin/withdrawal-requests/${request.id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPaidKes: amount,
          payoutReference: refById[request.id]?.trim() || "",
          adminNote: noteById[request.id]?.trim() || null,
          idempotencyKey,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Settlement failed");
      showToast(`Marked paid. Status: ${json.status || "updated"}`, "success");
      load();
    } catch (error: any) {
      showToast(error.message || "Could not record payout", "error");
    } finally {
      setSettlingId(null);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Payout planning</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Seekers with earnings balances, committed payouts, and pay-by dates.
            </p>
          </div>
        </div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Admin home
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : report ? (
        <div className="space-y-8">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CalendarClock className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">Withdrawal schedule</p>
                  <p className="text-sm text-zinc-500 mt-1">{report.schedule}</p>
                  <p className="text-sm text-zinc-400 mt-2">
                    Next request window:{" "}
                    <span className="text-white font-medium">
                      {formatDate(report.next_withdrawal_window)}
                    </span>
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border",
                  report.withdrawal_window_open
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-zinc-500/15 text-zinc-300 border-zinc-500/30"
                )}
              >
                {report.withdrawal_window_open ? "Window open today" : "Window closed"}
              </span>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Users with earnings
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">{report.summary.users_count}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Committed payouts
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-amber-300">
                {formatKes(report.summary.committed_pay_kes)} KES
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {report.summary.open_requests_count} open request
                {report.summary.open_requests_count === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Potential payouts
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-200">
                {formatKes(report.summary.potential_pay_kes)} KES
              </p>
              <p className="text-xs text-zinc-500 mt-1">Balances awaiting withdrawal requests</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Total earnings balance
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-300">
                {formatKes(report.summary.total_earnings_balance_kes)} KES
              </p>
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                Payout forecast
              </h2>
              <label className="flex items-center gap-2 text-sm text-zinc-500">
                <span>Per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>
            {report.users.length === 0 ? (
              <p className="text-zinc-500 py-10 text-center border border-dashed border-white/10 rounded-2xl">
                No seekers with earnings balances or open withdrawal requests yet.
              </p>
            ) : (
              <AdminVirtualList<PayoutUser>
                items={report.users}
                estimateSize={220}
                maxHeight={720}
                className="space-y-0"
                getKey={(row) => row.user_id}
                renderItem={(row) => {
                  const request = row.withdrawal_request;
                  const remaining = request?.amount_remaining ?? 0;
                  return (
                    <div className="pb-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <Link
                          to={`/admin/payout-planning/${row.user_id}`}
                          className="block p-5 hover:bg-white/[0.05] transition-colors"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-white">{row.full_name || "—"}</p>
                                <ChevronRight className="w-4 h-4 text-zinc-500" />
                              </div>
                              <p className="text-xs text-zinc-500">{row.email || row.user_id}</p>
                              <p className="text-xs text-emerald-400 mt-2">
                                View prompt attempts and grading breakdown
                              </p>
                              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Balance</p>
                                  <p className="tabular-nums">{formatKes(row.earnings_balance_kes)} KES</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Expected pay</p>
                                  <p className="tabular-nums text-amber-200 font-semibold">
                                    {formatKes(row.expected_pay_kes)} KES
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Pay by</p>
                                  <p>
                                    {row.planning_status === "requested"
                                      ? formatDate(row.pay_by_date)
                                      : "After request"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Status</p>
                                  <span
                                    className={cn(
                                      "inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                                      row.planning_status === "requested"
                                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                        : "bg-blue-500/15 text-blue-300 border-blue-500/30"
                                    )}
                                  >
                                    {row.planning_status === "requested"
                                      ? request?.status.replace("_", " ") || "requested"
                                      : "awaiting request"}
                                  </span>
                                </div>
                              </div>
                              {request ? (
                                <p className="text-xs text-zinc-500 mt-3">
                                  Requested {formatKes(request.amount_requested)} KES · Paid{" "}
                                  {formatKes(request.amount_paid)} KES · Remaining{" "}
                                  {formatKes(remaining)} KES · Period {request.period_month}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </Link>

                        {request && remaining > 0 ? (
                          <form
                            onSubmit={(e) => settle(e, row)}
                            onFocus={() => setDefaultAmount(request.id, remaining)}
                            className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end border-t border-white/10 pt-4"
                          >
                            <div>
                              <label className="text-[10px] font-bold uppercase text-zinc-500">
                                Mark paid (KES)
                              </label>
                              <input
                                type="number"
                                min={0.01}
                                step={0.01}
                                max={remaining}
                                value={amountById[request.id] ?? ""}
                                onChange={(e) =>
                                  setAmountById((current) => ({
                                    ...current,
                                    [request.id]: e.target.value,
                                  }))
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
                                value={refById[request.id] ?? ""}
                                onChange={(e) =>
                                  setRefById((current) => ({
                                    ...current,
                                    [request.id]: e.target.value,
                                  }))
                                }
                                placeholder="M-Pesa / receipt"
                                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-zinc-500">Note</label>
                              <input
                                type="text"
                                value={noteById[request.id] ?? ""}
                                onChange={(e) =>
                                  setNoteById((current) => ({
                                    ...current,
                                    [request.id]: e.target.value,
                                  }))
                                }
                                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={settlingId === request.id}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400 disabled:opacity-40"
                            >
                              {settlingId === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Mark as paid
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  );
                }}
              />
            )}
            <AdminPagination
              page={page}
              totalPages={totalPages}
              total={report.summary.users_count}
              loading={loading}
              onPageChange={setPage}
            />
          </section>
        </div>
      ) : null}
    </main>
  );
}
