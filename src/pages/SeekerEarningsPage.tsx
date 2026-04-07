import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/apiFetch";
import { motion } from "motion/react";
import {
  Loader2,
  LayoutDashboard,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Download,
} from "lucide-react";
import { cn } from "../lib/utils";

type LedgerRow = {
  id: string;
  amount_kes: number | string;
  entry_type: string;
  reference_type: string | null;
  reference_id?: string | null;
  created_at: string;
};

function csvEscapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

type WithdrawalRow = {
  id: string;
  amount_kes_requested: number | string;
  period_month: string;
  status: string;
  amount_paid_kes: number | string;
  created_at: string;
};

function formatKes(n: number | string | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : Number(n ?? 0);
  if (!Number.isFinite(v)) return "0.00";
  return v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function entryLabel(type: string): string {
  switch (type) {
    case "reward_credit":
      return "Reward";
    case "withdrawal_payout":
      return "Withdrawal";
    case "adjustment":
      return "Adjustment";
    case "reversal":
      return "Reversal";
    default:
      return type;
  }
}

export function SeekerEarningsPage({
  user,
  showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [balanceKes, setBalanceKes] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [amountInput, setAmountInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, ledRes, wrRes] = await Promise.all([
        apiFetch("/api/earnings/summary"),
        apiFetch("/api/earnings/ledger?limit=50"),
        supabase
          .from("withdrawal_requests")
          .select("id, amount_kes_requested, period_month, status, amount_paid_kes, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (!sumRes.ok) {
        const j = await sumRes.json().catch(() => ({}));
        throw new Error(j.error || "Could not load balance");
      }
      const sumJson = await sumRes.json();
      setBalanceKes(Number(sumJson.balance_kes ?? 0));

      if (!ledRes.ok) {
        const j = await ledRes.json().catch(() => ({}));
        throw new Error(j.error || "Could not load ledger");
      }
      const ledJson = await ledRes.json();
      setLedger(ledJson.entries ?? []);

      if (wrRes.error) throw wrRes.error;
      setWithdrawals((wrRes.data ?? []) as WithdrawalRow[]);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Could not load earnings", "error");
    } finally {
      setLoading(false);
    }
  }, [user.id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleWithdrawalRequest = async (e: FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountInput.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount in KES", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/earnings/withdrawal-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKesRequested: amount,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error || "Request failed");
      }
      showToast("Withdrawal request submitted", "success");
      setAmountInput("");
      await load();
    } catch (e: any) {
      showToast(e.message || "Could not submit request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingWithdrawal = withdrawals.find((w) => w.status === "pending");

  const downloadStatementCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await apiFetch("/api/earnings/ledger?limit=500");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not load ledger for export");
      const entries = (j.entries ?? []) as LedgerRow[];
      const header = ["Date (UTC)", "Type", "Amount_KES", "Reference_type", "Reference_id"];
      const lines = [header.join(",")];
      for (const row of entries) {
        lines.push(
          [
            csvEscapeCell(new Date(row.created_at).toISOString()),
            csvEscapeCell(entryLabel(row.entry_type)),
            csvEscapeCell(String(row.amount_kes)),
            csvEscapeCell(String(row.reference_type ?? "")),
            csvEscapeCell(String(row.reference_id ?? "")),
          ].join(",")
        );
      }
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `earnings_statement_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Statement downloaded", "success");
    } catch (e: any) {
      showToast(e.message || "Export failed", "error");
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <Banknote className="w-8 h-8 text-emerald-400" />
              Earnings
            </h1>
            <p className="text-zinc-500 mt-1 text-sm sm:text-base">
              KES balance from approved prompt rewards. Withdrawals are processed by the platform team
              during the monthly window.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm font-medium transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
          </div>
        ) : (
          <div className="space-y-10">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-zinc-900/80 p-6 sm:p-8"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500/90">
                Available balance
              </p>
              <p className="mt-2 text-4xl sm:text-5xl font-bold tabular-nums text-white">
                {formatKes(balanceKes ?? 0)}{" "}
                <span className="text-lg font-semibold text-zinc-500">KES</span>
              </p>
            </motion.div>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="flex items-start gap-3 mb-4">
                <CalendarClock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-white">Request a withdrawal</h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Requests typically open from day 25 of each month through month-end (see server{" "}
                    <code className="text-zinc-400">EARNINGS_WITHDRAWAL_DAY_MIN</code>). If your
                    request is rejected as outside the window, try again during that period.
                  </p>
                </div>
              </div>

              {pendingWithdrawal ? (
                <div className="rounded-xl bg-amber-950/40 border border-amber-500/30 px-4 py-3 text-sm text-amber-100">
                  You have a <strong>pending</strong> withdrawal for{" "}
                  {formatKes(pendingWithdrawal.amount_kes_requested)} KES (
                  {pendingWithdrawal.period_month}). The team will process it soon.
                </div>
              ) : (
                <form onSubmit={handleWithdrawalRequest} className="flex flex-col sm:flex-row gap-3 mt-4">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Amount (KES)"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="flex-1 rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-emerald-500 text-black font-semibold px-6 py-3 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Submitting…" : "Submit request"}
                  </button>
                </form>
              )}
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-white">Statement</h2>
                <button
                  type="button"
                  onClick={downloadStatementCsv}
                  disabled={exportingCsv}
                  className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                >
                  {exportingCsv ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download CSV
                </button>
              </div>
              <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                {ledger.length === 0 ? (
                  <p className="p-8 text-center text-zinc-500 text-sm">
                    No ledger entries yet. Complete prompt tasks and pass grading to earn KES.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-800">
                    {ledger.map((row) => {
                      const amt = Number(row.amount_kes);
                      const positive = amt >= 0;
                      return (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {positive ? (
                              <ArrowDownLeft className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <div>
                              <p className="font-medium text-white">{entryLabel(row.entry_type)}</p>
                              <p className="text-xs text-zinc-500">
                                {new Date(row.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "font-mono font-semibold tabular-nums",
                              positive ? "text-emerald-400" : "text-rose-300"
                            )}
                          >
                            {positive ? "+" : ""}
                            {formatKes(amt)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            {withdrawals.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 text-white">Withdrawal history</h2>
                <div className="rounded-2xl border border-zinc-800 divide-y divide-zinc-800">
                  {withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-zinc-900/40"
                    >
                      <div>
                        <p className="text-white font-medium">{formatKes(w.amount_kes_requested)} KES</p>
                        <p className="text-xs text-zinc-500">
                          {w.period_month} · {w.status.replace("_", " ")}
                          {Number(w.amount_paid_kes) > 0 && (
                            <> · paid {formatKes(w.amount_paid_kes)}</>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {new Date(w.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
