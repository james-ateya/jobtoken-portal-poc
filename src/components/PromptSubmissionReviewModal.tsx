import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle, Loader2, X, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

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
};

type PromptSubmissionReviewModalProps = {
  submission: PromptReviewSubmission;
  gradingId: string | null;
  onClose: () => void;
  onGrade: (submissionId: string, grade: "pass" | "fail", gradingNote: string) => Promise<void>;
  seekerLabel?: string;
};

export function PromptSubmissionReviewModal({
  submission,
  gradingId,
  onClose,
  onGrade,
  seekerLabel,
}: PromptSubmissionReviewModalProps) {
  const [gradingNote, setGradingNote] = useState(submission.grading_note ?? "");
  const busy = gradingId === submission.id;

  useEffect(() => {
    setGradingNote(submission.grading_note ?? "");
  }, [submission.id, submission.grading_note]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const seekerDisplay =
    seekerLabel ||
    (submission.seeker_name || submission.seeker_email
      ? `${submission.seeker_name || "—"} · ${submission.seeker_email || ""}`
      : null);

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
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Seeker answer
            </p>
            <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed rounded-xl bg-black/30 border border-white/5 p-4">
              {submission.answer_text}
            </p>
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
