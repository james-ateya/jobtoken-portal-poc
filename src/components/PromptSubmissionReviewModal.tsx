import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle, Loader2, X, XCircle, ShieldAlert, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";

type QualityReport = {
  ai_probability: number;
  relevance_score: number;
  spelling_grammar_score: number;
  effort_score: number;
  flags: string[];
  recommendation: "pass" | "review" | "fail";
  summary: string;
  plagiarism?: { is_plagiarized: boolean; similarity_score: number };
};

export type PromptReviewSubmission = {
  id: string;
  answer_text: string;
  word_count: number;
  tokens_charged: number;
  grade_status: string;
  submitted_at: string;
  prompt_headline: string | null;
  reward_kes: number;
  series_title: string | null;
  seeker_email?: string | null;
  seeker_name?: string | null;
  grading_note?: string | null;
  quality_report?: QualityReport | null;
  quality_checked_at?: string | null;
  pass_rate?: number | null;
};

type PromptSubmissionReviewModalProps = {
  submission: PromptReviewSubmission;
  gradingId: string | null;
  onClose: () => void;
  onGrade: (submissionId: string, grade: "pass" | "fail", gradingNote: string) => Promise<void>;
  seekerLabel?: string;
};

function ScoreBar({ label, value, invertColor }: { label: string; value: number; invertColor?: boolean }) {
  const effective = invertColor ? 100 - value : value;
  const color =
    effective >= 70 ? "bg-emerald-500" : effective >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor =
    effective >= 70 ? "text-emerald-400" : effective >= 40 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={cn("font-bold", textColor)}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RecommendationBadge({ rec }: { rec: "pass" | "review" | "fail" }) {
  const cls =
    rec === "pass"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : rec === "fail"
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase border", cls)}>
      {rec === "pass" ? <CheckCircle className="w-3 h-3" /> : rec === "fail" ? <XCircle className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
      {rec}
    </span>
  );
}

export function PromptSubmissionReviewModal({
  submission,
  gradingId,
  onClose,
  onGrade,
  seekerLabel,
}: PromptSubmissionReviewModalProps) {
  const [gradingNote, setGradingNote] = useState(submission.grading_note ?? "");
  const [qr, setQr] = useState<QualityReport | null>(submission.quality_report ?? null);
  const [qrLoading, setQrLoading] = useState(false);
  const busy = gradingId === submission.id;

  useEffect(() => {
    setGradingNote(submission.grading_note ?? "");
    setQr(submission.quality_report ?? null);
  }, [submission.id, submission.grading_note, submission.quality_report]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const [qrError, setQrError] = useState<string | null>(null);

  const runQualityCheck = async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const res = await apiFetch(`/api/admin/prompt-submissions/${submission.id}/quality-check`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (j.quality_report) {
        setQr(j.quality_report);
      } else if (j.error) {
        setQrError(j.error);
      }
    } catch {
      setQrError("Network error — could not reach the server");
    } finally {
      setQrLoading(false);
    }
  };

  const seekerDisplay =
    seekerLabel ||
    (submission.seeker_name || submission.seeker_email
      ? `${submission.seeker_name || "—"} · ${submission.seeker_email || ""}`
      : null);

  const passRate = submission.pass_rate != null ? Number(submission.pass_rate) : null;
  const passRateWarning = passRate !== null && passRate > 0.50;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-review-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-3xl max-h-[min(92vh,760px)] rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/90">
              {submission.series_title || "Series"}
            </p>
            <h2 id="prompt-review-title" className="font-bold text-lg mt-1 text-white">
              {submission.prompt_headline || "Prompt"}
            </h2>
            {seekerDisplay ? (
              <p className="text-sm text-zinc-400 mt-1">{seekerDisplay}</p>
            ) : null}
            <p className="text-xs text-zinc-500 mt-2">
              {submission.word_count} words · {submission.tokens_charged} tokens charged · Submitted{" "}
              {new Date(submission.submitted_at).toLocaleString()}
              {submission.grade_status !== "pending" ? (
                <span className="text-zinc-400">
                  {" "}
                  · Current grade:{" "}
                  <span
                    className={cn(
                      "font-semibold uppercase",
                      submission.grade_status === "pass" ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {submission.grade_status}
                  </span>
                </span>
              ) : null}
            </p>
            {submission.reward_kes > 0 ? (
              <p className="text-xs text-amber-400/90 mt-2">
                Reward on pass: {submission.reward_kes.toLocaleString("en-KE")} KES (credited to seeker
                earnings)
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 border-b border-white/10">
          {passRateWarning && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 text-xs text-amber-300">
              <span className="font-bold">Pass rate warning:</span> This prompt has a{" "}
              {(passRate! * 100).toFixed(0)}% pass rate (target: 50%). Consider tightening criteria or
              reducing the reward.
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Seeker answer
            </p>
            <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed rounded-xl bg-black/30 border border-white/5 p-4">
              {submission.answer_text}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                AI Quality Report
              </p>
              <button
                type="button"
                onClick={runQualityCheck}
                disabled={qrLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
              >
                {qrLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {qr ? "Re-check" : "Run check"}
              </button>
            </div>
            {qr ? (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <RecommendationBadge rec={qr.recommendation} />
                  {submission.quality_checked_at && (
                    <span className="text-[10px] text-zinc-600">
                      Checked {new Date(submission.quality_checked_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ScoreBar label="AI probability" value={qr.ai_probability} invertColor />
                  <ScoreBar label="Relevance" value={qr.relevance_score} />
                  <ScoreBar label="Spelling & grammar" value={qr.spelling_grammar_score} />
                  <ScoreBar label="Effort" value={qr.effort_score} />
                </div>
                {qr.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {qr.flags.map((f, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 border border-red-500/20 text-red-400"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                {qr.summary && (
                  <p className="text-xs text-zinc-400 leading-relaxed">{qr.summary}</p>
                )}
              </>
            ) : (
              <div className="space-y-2">
                {qrError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {qrError}
                  </p>
                )}
                <p className="text-xs text-zinc-600">
                  {qrLoading ? "Analyzing submission..." : "No quality report yet. Click \"Run check\" to analyze."}
                </p>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="grading-note"
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 block mb-2"
            >
              Feedback note (emailed to seeker)
            </label>
            <textarea
              id="grading-note"
              rows={4}
              value={gradingNote}
              onChange={(e) => setGradingNote(e.target.value)}
              placeholder="Explain what was strong or what to improve. This note is included in the email sent to the seeker."
              className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y min-h-[96px]"
            />
            <p className="text-xs text-zinc-500 mt-2">
              A review email is sent when you pass or fail. Your note helps seekers understand the decision.
            </p>
          </div>
        </div>

        <div className="p-5 flex flex-wrap gap-3 justify-end shrink-0 bg-black/30">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onGrade(submission.id, "fail", gradingNote)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            {submission.grade_status === "fail" ? "Update fail" : "Fail"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onGrade(submission.id, "pass", gradingNote)}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm",
              "bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40"
            )}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {submission.grade_status === "pass" ? "Update pass" : "Pass"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
