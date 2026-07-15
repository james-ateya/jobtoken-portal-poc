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
  Coins,
  Gift,
  Smartphone,
  ShieldCheck,
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
    case "token_redemption":
      return "Token redemption";
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
  const [minWithdrawalKes, setMinWithdrawalKes] = useState(1500);
  const [canRequestWithdrawal, setCanRequestWithdrawal] = useState(false);
  const [kesPerToken, setKesPerToken] = useState(20);
  const [tokenExchangeEnabled, setTokenExchangeEnabled] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [giftEmail, setGiftEmail] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [gifting, setGifting] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const previewTokens = (amountRaw: string): number => {
    const amount = parseFloat(amountRaw.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    return Math.floor(amount / kesPerToken);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, ledRes, wrRes, exchangeRes] = await Promise.all([
        apiFetch("/api/earnings/summary"),
        apiFetch("/api/earnings/ledger?limit=50"),
        supabase
          .from("withdrawal_requests")
          .select("id, amount_kes_requested, period_month, status, amount_paid_kes, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        apiFetch("/api/earnings/exchange-info"),
      ]);

      if (!sumRes.ok) {
        const j = await sumRes.json().catch(() => ({}));
        throw new Error(j.error || "Could not load balance");
      }
      const sumJson = await sumRes.json();
      setBalanceKes(Number(sumJson.balance_kes ?? 0));
      setMinWithdrawalKes(Number(sumJson.minimum_withdrawal_kes ?? 1500));
      setCanRequestWithdrawal(Boolean(sumJson.can_request_withdrawal));

      if (exchangeRes.ok) {
        const exchangeJson = await exchangeRes.json();
        setKesPerToken(Number(exchangeJson.kes_per_token ?? 20));
        const redeemEnabled = Boolean(exchangeJson.redeem_enabled);
        const giftEnabled = Boolean(exchangeJson.gift_enabled);
        setTokenExchangeEnabled(redeemEnabled || giftEnabled);
      } else {
        setTokenExchangeEnabled(false);
      }

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

  const isValidLocalPhone = (p: string): boolean => {
    const cleaned = p.replace(/[\s-]/g, "");
    return /^(07\d{8}|01\d{8}|\+?2547\d{8}|\+?2541\d{8})$/.test(cleaned);
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!withdrawalAllowed) {
      showToast("Withdrawal requests are not available right now", "error");
      return;
    }
    const amount = parseFloat(amountInput.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount in KES", "error");
      return;
    }
    if (amount < minWithdrawalKes) {
      showToast(`Minimum withdrawal is Ksh ${minWithdrawalKes.toLocaleString("en-KE")}`, "error");
      return;
    }
    if (!isValidLocalPhone(phoneInput)) {
      showToast("Enter a valid Safaricom number (e.g. 0712345678)", "error");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await apiFetch("/api/earnings/withdrawal-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKesRequested: amount,
          phone: phoneInput.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not send OTP");
      setOtpStep(true);
      setOtpSent(true);
      setOtpCode("");
      showToast("Verification code sent to your email", "success");
    } catch (e: any) {
      showToast(e.message || "Could not send OTP", "error");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyAndSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountInput.replace(/,/g, ""));
    if (!otpCode.trim() || !/^\d{6}$/.test(otpCode.replace(/\s/g, ""))) {
      showToast("Enter the 6-digit code from your email", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/earnings/withdrawal-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKesRequested: amount,
          phone: phoneInput.trim(),
          otp: otpCode.replace(/\s/g, ""),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Request failed");
      showToast("Withdrawal request submitted", "success");
      setAmountInput("");
      setPhoneInput("");
      setOtpCode("");
      setOtpStep(false);
      setOtpSent(false);
      await load();
    } catch (e: any) {
      showToast(e.message || "Could not submit request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOtp = () => {
    setOtpStep(false);
    setOtpCode("");
    setOtpSent(false);
  };

  const handleRedeemForTokens = async (e: FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(redeemAmount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount in KES", "error");
      return;
    }
    setRedeeming(true);
    try {
      const res = await apiFetch("/api/earnings/redeem-for-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKes: amount }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Redemption failed");
      showToast(`Converted ${formatKes(json.amount_kes_debited)} KES into ${json.tokens_credited} tokens`, "success");
      setRedeemAmount("");
      await load();
    } catch (error: any) {
      showToast(error.message || "Could not redeem earnings", "error");
    } finally {
      setRedeeming(false);
    }
  };

  const handleGiftTokens = async (e: FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(giftAmount.replace(/,/g, ""));
    const recipientEmail = giftEmail.trim();
    if (!recipientEmail) {
      showToast("Enter the recipient email address", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a valid amount in KES", "error");
      return;
    }
    setGifting(true);
    try {
      const res = await apiFetch("/api/earnings/gift-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKes: amount, recipientEmail }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Gift failed");
      showToast(
        `Gifted ${json.tokens_credited} tokens to ${json.recipient_email || recipientEmail}`,
        "success"
      );
      setGiftAmount("");
      setGiftEmail("");
      await load();
    } catch (error: any) {
      showToast(error.message || "Could not gift tokens", "error");
    } finally {
      setGifting(false);
    }
  };

  const pendingWithdrawal = withdrawals.find((w) => w.status === "pending");
  const balance = balanceKes ?? 0;
  const withdrawalAllowed =
    canRequestWithdrawal && !pendingWithdrawal;
  const withdrawalBlockedReason = pendingWithdrawal
    ? null
    : balance < minWithdrawalKes
      ? "low_balance"
      : null;

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
                    Withdraw your earnings anytime once you reach the minimum balance.
                  </p>
                  <p className="text-sm text-zinc-400 mt-2">
                    Minimum withdrawal:{" "}
                    <span className="text-white font-semibold tabular-nums">
                      Ksh {minWithdrawalKes.toLocaleString("en-KE")}
                    </span>
                    . The team will process your request as soon as possible.
                  </p>
                </div>
              </div>

              {pendingWithdrawal ? (
                <div className="rounded-xl bg-amber-950/40 border border-amber-500/30 px-4 py-3 text-sm text-amber-100">
                  You have a <strong>pending</strong> withdrawal for{" "}
                  {formatKes(pendingWithdrawal.amount_kes_requested)} KES (
                  {pendingWithdrawal.period_month}). The team will process it soon.
                </div>
              ) : !withdrawalAllowed ? (
                <div className="rounded-xl bg-zinc-950/80 border border-zinc-700 px-4 py-3 text-sm text-zinc-300">
                  {withdrawalBlockedReason === "low_balance" ? (
                    <>
                      You need at least{" "}
                      <strong>Ksh {minWithdrawalKes.toLocaleString("en-KE")}</strong> in earnings to
                      request a withdrawal. Your current balance is{" "}
                      <strong>Ksh {formatKes(balance)}</strong>.
                    </>
                  ) : (
                    <>Withdrawal requests are not available right now.</>
                  )}
                </div>
              ) : !otpStep ? (
                <form onSubmit={handleRequestOtp} className="space-y-3 mt-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={`Amount (KES, min ${minWithdrawalKes.toLocaleString("en-KE")})`}
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="flex-1 rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <div className="relative flex-1">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        type="tel"
                        inputMode="tel"
                        placeholder="Safaricom number (e.g. 0712345678)"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        maxLength={13}
                        className="w-full rounded-xl bg-zinc-950 border border-zinc-700 pl-10 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Enter your Safaricom M-Pesa number. A verification code will be sent to your registered email.
                  </p>
                  <button
                    type="submit"
                    disabled={
                      otpLoading ||
                      !amountInput.trim() ||
                      !phoneInput.trim() ||
                      (amountInput.trim() !== "" &&
                        (parseFloat(amountInput.replace(/,/g, "")) < minWithdrawalKes ||
                          !Number.isFinite(parseFloat(amountInput.replace(/,/g, "")))))
                    }
                    className="rounded-xl bg-emerald-500 text-black font-semibold px-6 py-3 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                  >
                    {otpLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Sending code…
                      </span>
                    ) : (
                      "Continue"
                    )}
                  </button>
                </form>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/20 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-emerald-100 font-medium">Verify your withdrawal</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Enter the 6-digit code sent to your email to confirm withdrawal of{" "}
                          <strong className="text-white">KES {formatKes(parseFloat(amountInput.replace(/,/g, "")) || 0)}</strong>{" "}
                          to M-Pesa <strong className="text-white">{phoneInput}</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                  <form onSubmit={handleVerifyAndSubmit} className="space-y-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter 6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9\s]/g, ""))}
                      maxLength={7}
                      autoFocus
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-white text-center text-lg tracking-widest font-mono placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="submit"
                        disabled={submitting || otpCode.replace(/\s/g, "").length !== 6}
                        className="flex-1 rounded-xl bg-emerald-500 text-black font-semibold px-6 py-3 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                      >
                        {submitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                          </span>
                        ) : (
                          "Verify & Submit"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={otpLoading}
                        className="rounded-xl border border-zinc-700 text-zinc-300 font-medium px-6 py-3 hover:bg-zinc-800 disabled:opacity-50 transition-colors text-sm"
                      >
                        {otpLoading ? "Sending…" : "Resend code"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelOtp}
                        className="rounded-xl border border-zinc-700 text-zinc-400 font-medium px-4 py-3 hover:bg-zinc-800 transition-colors text-sm"
                      >
                        Back
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </section>

            {tokenExchangeEnabled ? (
              <>
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Coins className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h2 className="font-semibold text-white">Redeem earnings for tokens</h2>
                      <p className="text-sm text-zinc-500 mt-1">
                        Convert part of your KES balance into wallet tokens at {kesPerToken} KES per
                        token.
                      </p>
                    </div>
                  </div>
                  <form onSubmit={handleRedeemForTokens} className="space-y-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Amount to redeem (KES)"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                    {redeemAmount.trim() ? (
                      <p className="text-xs text-zinc-400">
                        You will receive <strong>{previewTokens(redeemAmount)}</strong> tokens (
                        {formatKes(previewTokens(redeemAmount) * kesPerToken)} KES debited).
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={redeeming || previewTokens(redeemAmount) < 1}
                      className="rounded-xl bg-emerald-500 text-black font-semibold px-6 py-3 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                    >
                      {redeeming ? "Redeeming…" : "Redeem for tokens"}
                    </button>
                  </form>
                </section>

                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Gift className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h2 className="font-semibold text-white">Gift tokens from earnings</h2>
                      <p className="text-sm text-zinc-500 mt-1">
                        Buy tokens for another subscriber using their registered email address.
                      </p>
                    </div>
                  </div>
                  <form onSubmit={handleGiftTokens} className="space-y-3">
                    <input
                      type="email"
                      placeholder="Recipient email"
                      value={giftEmail}
                      onChange={(e) => setGiftEmail(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Amount from earnings (KES)"
                      value={giftAmount}
                      onChange={(e) => setGiftAmount(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    {giftAmount.trim() ? (
                      <p className="text-xs text-zinc-400">
                        Recipient will receive <strong>{previewTokens(giftAmount)}</strong> tokens.
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={gifting || previewTokens(giftAmount) < 1 || !giftEmail.trim()}
                      className="rounded-xl bg-amber-500 text-black font-semibold px-6 py-3 hover:bg-amber-400 disabled:opacity-50 transition-colors"
                    >
                      {gifting ? "Sending gift…" : "Gift tokens"}
                    </button>
                  </form>
                </section>
              </>
            ) : (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 opacity-70">
                <div className="flex items-start gap-3">
                  <Coins className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-semibold text-zinc-300">Redeem & gift tokens</h2>
                    <p className="text-sm text-zinc-500 mt-1">
                      Converting earnings into wallet tokens or gifting tokens to others is temporarily
                      unavailable.
                    </p>
                  </div>
                </div>
              </section>
            )}

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
