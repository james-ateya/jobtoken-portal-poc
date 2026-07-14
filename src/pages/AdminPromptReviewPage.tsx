import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiFetch } from "../lib/apiFetch";
import { cn } from "../lib/utils";

type PromptInfo = {
  id: string;
  headline: string;
  reward_kes: number;
  submit_cost_tokens: number;
  series_title: string | null;
};

type Submission = {
  id: string;
  user_id: string;
  answer_text: string;
  word_count: number;
  tokens_charged: number;
  grade_status: "pass" | "fail" | "pending";
  submitted_at: string;
  graded_at: string | null;
  grading_note: string | null;
  seeker_name: string | null;
  seeker_email: string | null;
};

const GRADE_ICON = {
  pass: <CheckCircle className="w-4 h-4 text-emerald-400" />,
  fail: <XCircle className="w-4 h-4 text-red-400" />,
  pending: <Clock className="w-4 h-4 text-zinc-500" />,
};

const GRADE_LABEL = {
  pass: "text-emerald-400",
  fail: "text-red-400",
  pending: "text-zinc-500",
};

export function AdminPromptReviewPage({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const { promptId } = useParams<{ promptId: string }>();
  const [prompt, setPrompt] = useState<PromptInfo | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [regradingId, setRegradingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!promptId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/prompts/${promptId}/submissions`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed to load");
      setPrompt(j.prompt);
      setSubmissions(j.submissions ?? []);
    } catch (e: any) {
      showToast(e.message || "Could not load submissions", "error");
    } finally {
      setLoading(false);
    }
  }, [promptId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRegrade = async (submissionId: string) => {
    setRegradingId(submissionId);
    try {
      const res = await apiFetch(
        `/api/admin/prompt-submissions/${submissionId}/grade`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grade: "fail",
            skipEmail: true,
            gradingNote: "Regraded via platform health review",
          }),
        }
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || "Regrade failed");

      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId
            ? { ...s, grade_status: "fail" as const, graded_at: new Date().toISOString(), grading_note: "Regraded via platform health review" }
            : s
        )
      );

      const adj = Number(j.earningsAdjustmentKes || 0);
      showToast(
        `Regraded to fail${adj ? ` — KES ${Math.abs(adj).toLocaleString("en-KE")} reversed` : ""}`,
        "success"
      );
    } catch (e: any) {
      showToast(e.message || "Regrade failed", "error");
    } finally {
      setRegradingId(null);
    }
  };

  const passCount = submissions.filter((s) => s.grade_status === "pass").length;
  const failCount = submissions.filter((s) => s.grade_status === "fail").length;
  const pendingCount = submissions.filter((s) => s.grade_status === "pending").length;
  const graded = passCount + failCount;
  const passRate = graded > 0 ? passCount / graded : 0;

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!prompt) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-12 text-white text-center">
        <p className="text-zinc-500">Prompt not found.</p>
        <Link to="/admin/platform-health" className="text-emerald-400 underline mt-4 inline-block">
          Back to Platform Health
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-12 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/admin/platform-health"
            className="shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80">
              {prompt.series_title || "Series"}
            </p>
            <h1 className="text-lg font-bold truncate">{prompt.headline}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <p className="text-2xl font-black">{submissions.length}</p>
          <p className="text-[10px] font-bold uppercase text-zinc-500 mt-1">Total</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <p className="text-2xl font-black text-emerald-400">{passCount}</p>
          <p className="text-[10px] font-bold uppercase text-zinc-500 mt-1">Passed</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <p className="text-2xl font-black text-red-400">{failCount}</p>
          <p className="text-[10px] font-bold uppercase text-zinc-500 mt-1">Failed</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <p className={cn("text-2xl font-black", passRate > 0.5 ? "text-amber-400" : "text-emerald-400")}>
            {(passRate * 100).toFixed(0)}%
          </p>
          <p className="text-[10px] font-bold uppercase text-zinc-500 mt-1">Pass rate</p>
        </div>
      </div>

      {passRate > 0.5 && passCount > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-5 py-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-300">
              Pass rate is {(passRate * 100).toFixed(0)}% — above the 50% target
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Review the passed submissions below and regrade any that don't meet quality standards.
              Regrading to fail will reverse the KES {prompt.reward_kes.toLocaleString("en-KE")} reward silently (no email sent).
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 mb-4 flex items-center justify-between text-xs text-zinc-500">
        <span>
          Reward: <span className="text-amber-400 font-bold">{prompt.reward_kes.toLocaleString("en-KE")} KES</span> per pass
        </span>
        <span>
          Submit cost: <span className="text-zinc-300 font-bold">{prompt.submit_cost_tokens} tokens</span>
        </span>
        {pendingCount > 0 && (
          <span className="text-zinc-400">{pendingCount} pending review</span>
        )}
      </div>

      <div className="space-y-2">
        {submissions.map((s, i) => {
          const isExpanded = expandedId === s.id;
          const canRegrade = s.grade_status === "pass";
          const isRegrading = regradingId === s.id;

          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.015 }}
              className={cn(
                "rounded-xl border bg-white/[0.02] overflow-hidden",
                s.grade_status === "pass"
                  ? "border-emerald-500/20"
                  : s.grade_status === "fail"
                    ? "border-red-500/15"
                    : "border-white/10"
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : s.id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="shrink-0">{GRADE_ICON[s.grade_status]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">
                      {s.seeker_name || "Unknown"}
                    </span>
                    <span className="text-xs text-zinc-600">{s.seeker_email || s.user_id}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-500">
                    <span className={cn("font-bold uppercase", GRADE_LABEL[s.grade_status])}>
                      {s.grade_status}
                    </span>
                    <span>{s.word_count} words</span>
                    <span>{new Date(s.submitted_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="shrink-0 text-zinc-600">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-white/5 px-4 py-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
                      Answer
                    </p>
                    <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                      {s.answer_text}
                    </p>
                  </div>

                  {s.grading_note && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                        Grading note
                      </p>
                      <p className="text-xs text-zinc-400 italic">{s.grading_note}</p>
                    </div>
                  )}

                  {canRegrade && (
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleRegrade(s.id)}
                        disabled={isRegrading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                      >
                        {isRegrading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Regrade to Fail
                      </button>
                      <span className="text-[11px] text-zinc-600">
                        Reverses KES {prompt.reward_kes.toLocaleString("en-KE")} · No email sent
                      </span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {submissions.length === 0 && (
        <p className="text-center text-zinc-500 py-16">No submissions for this prompt yet.</p>
      )}
    </main>
  );
}
