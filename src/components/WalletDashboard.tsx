import {
  Wallet,
  Plus,
  RefreshCw,
  History,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  Smartphone,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/apiFetch";
import { cn } from "../lib/utils";

interface Transaction {
  id: string;
  tokens_added: number;
  type: string;
  reference_id: string;
  created_at: string;
  status?: string;
}

export type TokenPack = { kes: number; tokens: number };

interface WalletDashboardProps {
  balance: number;
  onBalanceRefresh?: () => void;
  userId: string;
  expiresAt?: string | null;
  /** Seeker copy vs employer (posting / featured fees). */
  audience?: "seeker" | "employer";
}

export function WalletDashboard({
  balance,
  onBalanceRefresh,
  userId,
  expiresAt,
  audience = "seeker",
}: WalletDashboardProps) {
  const [activeTab, setActiveTab] = useState<"wallet" | "history">("wallet");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [packs, setPacks] = useState<TokenPack[]>([
    { kes: 100, tokens: 5 },
    { kes: 200, tokens: 12 },
    { kes: 500, tokens: 35 },
  ]);
  const [selectedKes, setSelectedKes] = useState(100);
  const [customAmount, setCustomAmount] = useState("");
  const [kesPerToken, setKesPerToken] = useState(20);
  const [minTopupKes, setMinTopupKes] = useState(1);
  const [maxTopupKes, setMaxTopupKes] = useState(150000);
  const [phone, setPhone] = useState("");
  const [stkLoading, setStkLoading] = useState(false);
  const [stkHint, setStkHint] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startBalanceRef = useRef(balance);

  const allowSimulate = import.meta.env.VITE_ALLOW_SIMULATE_TOPUP === "true";
  const [simLoading, setSimLoading] = useState(false);

  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  useEffect(() => {
    fetch("/api/token-packs")
      .then((r) => r.json())
      .then((d) => {
        if (d.packs?.length) {
          setPacks(d.packs);
          setSelectedKes(d.packs[0].kes);
        }
        if (typeof d.kesPerToken === "number" && d.kesPerToken > 0) {
          setKesPerToken(d.kesPerToken);
        }
        if (typeof d.minTopupKes === "number") setMinTopupKes(d.minTopupKes);
        if (typeof d.maxTopupKes === "number") setMaxTopupKes(d.maxTopupKes);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .single();
    if (wallet) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (data) setTransactions(data as Transaction[]);
    }
    setLoadingHistory(false);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startWalletPoll = () => {
    stopPolling();
    startBalanceRef.current = balance;
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("wallets")
        .select("token_balance, expires_at")
        .eq("user_id", userId)
        .single();
      if (data && data.token_balance !== startBalanceRef.current) {
        stopPolling();
        onBalanceRefresh?.();
        setStkHint(null);
      }
    }, 3000);
    setTimeout(() => stopPolling(), 120_000);
  };

  const handleStkTopup = async () => {
    setStkLoading(true);
    setStkHint(null);
    try {
      const custom = customAmount.trim();
      let amountKes: number;
      if (custom !== "") {
        amountKes = Math.round(Number(custom));
        if (!Number.isFinite(amountKes)) {
          setStkHint("Enter a valid amount in Ksh.");
          setStkLoading(false);
          return;
        }
        if (amountKes < minTopupKes || amountKes > maxTopupKes) {
          setStkHint(`Amount must be between Ksh ${minTopupKes} and Ksh ${maxTopupKes}.`);
          setStkLoading(false);
          return;
        }
      } else {
        amountKes = selectedPack?.kes ?? selectedKes;
      }

      const res = await apiFetch("/api/mpesa/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          amountKes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "STK failed");
      setStkHint(
        json.customerMessage ||
          "Check your phone to approve M-Pesa. Your balance will update shortly."
      );
      startBalanceRef.current = balance;
      startWalletPoll();
    } catch (e: any) {
      setStkHint(e.message || "Payment could not be started");
    } finally {
      setStkLoading(false);
    }
  };

  const handleSimulateTopup = async () => {
    setSimLoading(true);
    setStkHint(null);
    try {
      const res = await apiFetch("/api/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Simulate failed");
      onBalanceRefresh?.();
    } catch (e: any) {
      setStkHint(e.message);
    } finally {
      setSimLoading(false);
    }
  };

  const selectedPack = packs.find((p) => p.kes === selectedKes) || packs[0];

  const customTrimmed = customAmount.trim();
  let customParsed: number | null = null;
  if (customTrimmed !== "") {
    const n = Math.round(Number(customTrimmed));
    customParsed = Number.isFinite(n) ? n : null;
  }
  const customActive =
    customTrimmed !== "" &&
    customParsed != null &&
    customParsed >= minTopupKes &&
    customParsed <= maxTopupKes;
  const effectiveKes = customActive
    ? customParsed!
    : selectedPack?.kes ?? selectedKes;
  const previewTokens = (() => {
    const p = packs.find((x) => x.kes === effectiveKes);
    if (p) return p.tokens;
    return Math.floor(effectiveKes / kesPerToken);
  })();

  return (
    <div className="p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black shadow-2xl relative overflow-hidden min-h-[400px]">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -mr-16 -mt-16" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab("wallet")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === "wallet"
                  ? "bg-emerald-500 text-black"
                  : "text-zinc-500 hover:text-white"
              )}
            >
              Wallet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === "history"
                  ? "bg-emerald-500 text-black"
                  : "text-zinc-500 hover:text-white"
              )}
            >
              History
            </button>
          </div>

          {activeTab === "wallet" && (
            <div
              className={cn(
                "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border",
                isExpired
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-white/5 text-zinc-500 border-white/5"
              )}
            >
              <Calendar className="w-3 h-3" />
              {isExpired ? "Tokens Expired" : expiryDate ? `Expires ${expiryDate}` : "30-Day Validity"}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "wallet" ? (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex items-center gap-3 text-zinc-400 mb-4">
                <Wallet className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Current Balance</span>
              </div>

              <div className="flex items-end gap-3 mb-8">
                <motion.span
                  key={balance}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={cn(
                    "text-6xl font-bold tracking-tighter",
                    isExpired ? "text-red-400 opacity-50" : "text-white"
                  )}
                >
                  {balance}
                </motion.span>
                <span className="text-zinc-500 text-xl font-medium mb-2">Tokens</span>
              </div>

              {(balance === 0 || isExpired) && (
                <div
                  className={cn(
                    "mb-6 p-4 rounded-2xl border",
                    isExpired ? "bg-red-500/10 border-red-500/20" : "bg-emerald-500/10 border-emerald-500/20"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isExpired ? "text-red-400" : "text-emerald-400"
                    )}
                  >
                    {isExpired
                      ? audience === "employer"
                        ? "Your tokens expired. Top up to post jobs and use featured listings again."
                        : "Your tokens expired. Top up to apply again."
                      : audience === "employer"
                        ? "Buy a token pack with M-Pesa for posting fees and featured listings (same expiry rules as seeker wallets)."
                        : "Buy a token pack with M-Pesa to start applying."}
                  </p>
                </div>
              )}

              <div className="space-y-4 mb-6">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">
                  Token pack
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {packs.map((p) => (
                    <button
                      key={p.kes}
                      type="button"
                      onClick={() => {
                        setSelectedKes(p.kes);
                        setCustomAmount("");
                      }}
                      className={cn(
                        "py-3 px-2 rounded-xl border text-center transition-all",
                        customAmount.trim() === "" && selectedKes === p.kes
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20"
                      )}
                    >
                      <span className="block text-sm font-bold">Ksh {p.kes}</span>
                      <span className="text-[10px] text-zinc-500">{p.tokens} tokens</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">
                    Or enter amount (Ksh)
                  </label>
                  <p className="text-[11px] text-zinc-600 leading-snug">
                    If you type an amount here, it is used instead of a pack. Tokens = pack match if
                    exact, otherwise floor(amount ÷ {kesPerToken}) (min Ksh {minTopupKes}).
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={minTopupKes}
                    max={maxTopupKes}
                    step={1}
                    placeholder={`e.g. 150 (${minTopupKes}–${maxTopupKes})`}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                  />
                  {customTrimmed !== "" && (
                    <p className="text-xs text-zinc-400">
                      {customParsed == null ? (
                        <span className="text-red-400/90">Enter a valid whole number (Ksh).</span>
                      ) : customParsed < minTopupKes || customParsed > maxTopupKes ? (
                        <span className="text-red-400/90">
                          Use between Ksh {minTopupKes} and Ksh {maxTopupKes}.
                        </span>
                      ) : (
                        <>
                          <span className="text-emerald-500/90">
                            Paying Ksh {effectiveKes} → <strong>{previewTokens}</strong> tokens
                          </span>
                          {previewTokens < 1 && (
                            <span className="text-red-400/90">
                              {" "}
                              (min Ksh {Math.ceil(kesPerToken)} for 1 token)
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  )}
                </div>

                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">
                  M-Pesa phone
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <Smartphone className="w-4 h-4 text-zinc-500 shrink-0" />
                  <input
                    type="tel"
                    inputMode="tel"
                    placeholder="07XX XXX XXX or 2547..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleStkTopup}
                disabled={
                  stkLoading ||
                  !phone.trim() ||
                  (customActive && previewTokens < 1)
                }
                className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-500 text-black rounded-2xl font-bold hover:bg-emerald-400 transition-all active:scale-[0.98] disabled:opacity-50 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                {stkLoading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                Pay Ksh {effectiveKes} via M-Pesa
              </button>

              {allowSimulate && (
                <button
                  type="button"
                  onClick={handleSimulateTopup}
                  disabled={simLoading}
                  className="w-full mt-3 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 border border-dashed border-white/10 rounded-xl"
                >
                  {simLoading ? "Simulating…" : "Dev: simulate top-up (server MPESA_SIMULATE=true)"}
                </button>
              )}

              {stkHint && (
                <p className="mt-4 text-xs text-zinc-400 text-center leading-relaxed">{stkHint}</p>
              )}

              <p className="mt-6 text-[10px] text-zinc-500 text-center uppercase tracking-widest font-bold opacity-50">
                STK Push · Safaricom Daraja
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                    Fetching ledger…
                  </span>
                </div>
              ) : transactions.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center",
                            tx.tokens_added > 0
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          )}
                        >
                          {tx.tokens_added > 0 ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownLeft className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-wider">
                            {tx.type}
                            {tx.status === "pending" ? " · pending" : ""}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-bold",
                            tx.tokens_added > 0 ? "text-emerald-400" : "text-red-400"
                          )}
                        >
                          {tx.tokens_added > 0 ? "+" : ""}
                          {tx.tokens_added}
                        </p>
                        <p className="text-[9px] text-zinc-600 font-mono truncate max-w-[120px]">
                          {tx.reference_id}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                  <p className="text-zinc-500 text-sm">No transaction history found.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
