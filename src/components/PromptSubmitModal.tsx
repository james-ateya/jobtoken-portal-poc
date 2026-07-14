import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Coins, Banknote, Clock } from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";

const PROMPT_ANSWER_MAX_SECONDS = 30 * 60;

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type PromptForSubmit = {
  id: string;
  headline: string;
  instructions: string;
  word_limit: number | null;
  reward_kes: number | string;
  submit_cost_tokens: number;
};

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function formatKes(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

export function PromptSubmitModal({
  open,
  prompt,
  userId,
  tokenBalance,
  expiresAt,
  onClose,
  onSuccess,
  showToast,
}: {
  open: boolean;
  prompt: PromptForSubmit | null;
  userId: string;
  tokenBalance: number;
  expiresAt: string | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(PROMPT_ANSWER_MAX_SECONDS);

  useEffect(() => {
    if (open && prompt) setAnswer("");
  }, [open, prompt?.id]);

  useEffect(() => {
    if (!open || !prompt) return;

    const deadline = Date.now() + PROMPT_ANSWER_MAX_SECONDS * 1000;
    setSecondsLeft(PROMPT_ANSWER_MAX_SECONDS);

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, prompt?.id]);

  useEffect(() => {
    if (!open) return;
    const blockEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", blockEscape);
    return () => window.removeEventListener("keydown", blockEscape);
  }, [open]);

  const wc = useMemo(() => countWords(answer), [answer]);
  const cost = prompt ? Number(prompt.submit_cost_tokens) || 0 : 0;
  const overLimit =
    prompt?.word_limit != null && wc > Number(prompt.word_limit);
  const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const timeExpired = secondsLeft <= 0;
  const canSubmit =
    !!prompt &&
    answer.trim().length > 0 &&
    !overLimit &&
    !expired &&
    !timeExpired &&
    tokenBalance >= cost &&
    cost >= 1;

  const handleClose = () => {
    if (!submitting) {
      setAnswer("");
      onClose();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt || !canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/prompts/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptId: prompt.id,
          answerText: answer.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.error || "Submit failed");
      }
      showToast("Answer submitted — pending review", "success");
      setAnswer("");
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || "Could not submit", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!prompt) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-submit-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-start justify-between gap-4 p-5 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur z-10">
              <div className="min-w-0 flex-1">
                <h2 id="prompt-submit-title" className="text-lg font-bold text-white">
                  {prompt.headline}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-bold tabular-nums rounded-lg px-3 py-1.5",
                      timeExpired
                        ? "text-red-300 bg-red-500/15 ring-1 ring-red-500/30 text-lg"
                        : secondsLeft <= 300
                          ? "text-amber-300 bg-amber-500/15 ring-1 ring-amber-500/30 text-lg animate-pulse"
                          : "text-cyan-300 bg-cyan-500/10 ring-1 ring-cyan-500/20 text-lg"
                    )}
                  >
                    <Clock className="w-5 h-5 shrink-0" />
                    {timeExpired ? "Time expired" : `${formatCountdown(secondsLeft)} left`}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400/90">
                    <Banknote className="w-3.5 h-3.5" />
                    {formatKes(prompt.reward_kes)} KES reward
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    {cost} tokens to submit
                  </span>
                  {prompt.word_limit != null ? (
                    <span className="text-xs text-zinc-400">Max {prompt.word_limit} words</span>
                  ) : null}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300 whitespace-pre-wrap">
                {prompt.instructions}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Your answer
                </label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  rows={8}
                  placeholder="Type your response…"
                  disabled={timeExpired || submitting}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y min-h-[160px] disabled:opacity-60"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs">
                  <span
                    className={cn(
                      overLimit ? "text-red-400 font-medium" : "text-zinc-500"
                    )}
                  >
                    {wc} word{wc === 1 ? "" : "s"}
                    {prompt.word_limit != null ? ` / ${prompt.word_limit} max` : ""}
                  </span>
                  <span className="text-zinc-600">
                    Balance: {tokenBalance} tokens
                  </span>
                </div>
              </div>

              {timeExpired ? (
                <p className="text-sm text-red-400">
                  The 30-minute time limit has passed. Cancel to close — you can open this prompt again
                  to start a new attempt.
                </p>
              ) : null}

              {expired ? (
                <p className="text-sm text-amber-500">
                  Your tokens have expired. Top up to submit answers.
                </p>
              ) : tokenBalance < cost ? (
                <p className="text-sm text-amber-500">
                  You need {cost} tokens to submit this answer ({tokenBalance} available).
                </p>
              ) : null}

              <div className="flex items-start gap-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] px-4 py-3 text-sm text-cyan-300/90">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                <span>
                  Review of your answer can take up to <strong className="text-cyan-200">24 hours</strong> depending on traffic. You will receive an email once the review is complete.
                </span>
              </div>

              <div className="flex flex-wrap gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-white/5 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    `Submit (${cost} tokens)`
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
