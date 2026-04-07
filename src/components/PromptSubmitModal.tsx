import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, Coins, Banknote } from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";

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

  useEffect(() => {
    if (open && prompt) setAnswer("");
  }, [open, prompt?.id]);

  const wc = useMemo(() => countWords(answer), [answer]);
  const cost = prompt ? Number(prompt.submit_cost_tokens) || 0 : 0;
  const overLimit =
    prompt?.word_limit != null && wc > Number(prompt.word_limit);
  const expired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const canSubmit =
    !!prompt &&
    answer.trim().length > 0 &&
    !overLimit &&
    !expired &&
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
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-start justify-between gap-4 p-5 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur z-10">
              <div>
                <h2 id="prompt-submit-title" className="text-lg font-bold text-white pr-8">
                  {prompt.headline}
                </h2>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1 text-emerald-400/90">
                    <Banknote className="w-3.5 h-3.5" />
                    {formatKes(prompt.reward_kes)} KES reward
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    {cost} tokens to submit
                  </span>
                  {prompt.word_limit != null ? (
                    <span>Max {prompt.word_limit} words</span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
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
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y min-h-[160px]"
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

              {expired ? (
                <p className="text-sm text-amber-500">
                  Your tokens have expired. Top up to submit answers.
                </p>
              ) : tokenBalance < cost ? (
                <p className="text-sm text-amber-500">
                  You need {cost} tokens to submit this answer ({tokenBalance} available).
                </p>
              ) : null}

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
