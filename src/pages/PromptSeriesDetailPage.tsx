import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import {
  Loader2,
  LayoutDashboard,
  PenLine,
  ChevronLeft,
  Coins,
  Banknote,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { PromptSubmitModal, type PromptForSubmit } from "../components/PromptSubmitModal";
import { cn } from "../lib/utils";

type SeriesPayload = {
  id: string;
  title: string;
  description: string | null;
  status: string;
};

type PromptRow = PromptForSubmit & {
  sort_order: number;
  is_published: boolean;
  created_at: string;
};

function formatKes(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

function gradeBadge(status: string) {
  if (status === "pass")
    return {
      label: "Passed",
      className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      Icon: CheckCircle2,
    };
  if (status === "fail")
    return {
      label: "Not passed",
      className: "bg-red-500/10 text-red-400 border-red-500/25",
      Icon: XCircle,
    };
  return {
    label: "Pending review",
    className: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    Icon: Clock,
  };
}

export function PromptSeriesDetailPage({
  user,
  showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const { seriesId } = useParams<{ seriesId: string }>();
  const [series, setSeries] = useState<SeriesPayload | null>(null);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradeByPrompt, setGradeByPrompt] = useState<Record<string, string>>({});
  const [tokenBalance, setTokenBalance] = useState(0);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [modalPrompt, setModalPrompt] = useState<PromptForSubmit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setGradeByPrompt({});
  }, [seriesId]);

  const loadSeries = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/prompts/series/${encodeURIComponent(seriesId)}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Series not found");
      setSeries(j.series);
      setPrompts(j.prompts ?? []);
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Could not load series", "error");
      setSeries(null);
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  }, [seriesId, showToast]);

  const loadSubmissions = useCallback(async () => {
    if (!seriesId || !user?.id || prompts.length === 0) return;
    const ids = prompts.map((p) => p.id);
    const { data, error } = await supabase
      .from("prompt_submissions")
      .select("prompt_id, grade_status")
      .eq("user_id", user.id)
      .in("prompt_id", ids);
    if (error) {
      console.error(error);
      return;
    }
    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      map[(row as { prompt_id: string }).prompt_id] = (row as { grade_status: string })
        .grade_status;
    }
    setGradeByPrompt(map);
  }, [seriesId, user?.id, prompts]);

  const fetchWallet = useCallback(async () => {
    const { data } = await supabase
      .from("wallets")
      .select("token_balance, expires_at")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setTokenBalance(Number(data.token_balance ?? 0));
      setExpiresAt(data.expires_at);
    }
  }, [user.id]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const openSubmit = (p: PromptRow) => {
    setModalPrompt(p);
    setModalOpen(true);
  };

  const onModalSuccess = () => {
    fetchWallet();
    loadSubmissions();
  };

  if (!seriesId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <PromptSubmitModal
        open={modalOpen}
        prompt={modalPrompt}
        userId={user.id}
        tokenBalance={tokenBalance}
        expiresAt={expiresAt}
        onClose={() => {
          setModalOpen(false);
          setModalPrompt(null);
        }}
        onSuccess={onModalSuccess}
        showToast={showToast}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <Link
          to="/dashboard/prompts"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-400 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          All prompt series
        </Link>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
          </div>
        ) : !series ? (
          <div className="text-center py-20">
            <p className="text-zinc-500">This series is not available.</p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 mb-2">
                  <PenLine className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Prompt series</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{series.title}</h1>
                {series.description ? (
                  <p className="text-zinc-500 mt-2 max-w-2xl whitespace-pre-wrap">{series.description}</p>
                ) : null}
              </div>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm font-medium"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
            </div>

            <p className="text-xs text-zinc-500 mb-6">
              Wallet: <strong className="text-zinc-300">{tokenBalance}</strong> tokens
              {expiresAt ? (
                <>
                  {" "}
                  ·{" "}
                  {new Date(expiresAt) < new Date() ? (
                    <span className="text-amber-500">expired — top up to submit</span>
                  ) : (
                    <span>active</span>
                  )}
                </>
              ) : null}
            </p>

            <div className="space-y-4">
              {prompts.length === 0 ? (
                <p className="text-zinc-500 text-center py-12 border border-dashed border-white/10 rounded-2xl">
                  No tasks in this series yet.
                </p>
              ) : (
                prompts.map((p, i) => {
                  const grade = gradeByPrompt[p.id];
                  const submitted = grade !== undefined;
                  const badge = submitted ? gradeBadge(grade) : null;

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="font-bold text-white text-lg">{p.headline}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-zinc-400">
                            <span className="inline-flex items-center gap-1.5">
                              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                              {formatKes(p.reward_kes)} KES
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Coins className="w-3.5 h-3.5 text-amber-400" />
                              {p.submit_cost_tokens} tokens
                            </span>
                            {p.word_limit != null ? (
                              <span>Up to {p.word_limit} words</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2 shrink-0">
                          {badge ? (
                            <>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg border",
                                  badge.className
                                )}
                              >
                                <badge.Icon className="w-3.5 h-3.5" />
                                {badge.label}
                              </span>
                              {!submitted || grade === "fail" ? null : (
                                <span className="text-xs text-zinc-500">Submitted — no edits</span>
                              )}
                            </>
                          ) : null}
                          {!submitted ? (
                            <button
                              type="button"
                              onClick={() => openSubmit(p)}
                              className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 w-full sm:w-auto"
                            >
                              Write answer
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <p className="text-xs text-zinc-600 mt-8 text-center">
              Earnings appear in{" "}
              <Link to="/dashboard/earnings" className="text-emerald-500 hover:underline">
                Earnings
              </Link>{" "}
              after an admin approves your answer.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
