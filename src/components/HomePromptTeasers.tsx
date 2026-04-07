import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Loader2, PenLine, Lock, ArrowRight } from "lucide-react";
import { cn } from "../lib/utils";

export type HomePreviewPrompt = {
  id: string;
  headline: string;
  instructions: string;
  reward_kes: number | string;
  submit_cost_tokens: number;
  series_id: string;
  series_title: string | null;
};

export function HomePromptTeasers({ user }: { user: any | null }) {
  const [prompts, setPrompts] = useState<HomePreviewPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isGuest = !user;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/prompts/home-preview");
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "Could not load prompts");
        if (!cancelled) setPrompts(j.prompts ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-10 mb-10">
        <div className="flex justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      </section>
    );
  }

  if (error || prompts.length === 0) {
    return null;
  }

  return (
    <section className="mb-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <PenLine className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Prompt tasks</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Answer &amp; earn</h2>
          <p className="text-zinc-500 text-sm mt-1 max-w-xl">
            {isGuest ? (
              <>
                See what&apos;s live: token cost and KES reward are visible; the full question is blurred until you
                sign in.
              </>
            ) : (
              <>Published writing tasks from employers. Open a series on your dashboard to submit an answer.</>
            )}
          </p>
        </div>
        {isGuest ? (
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 shrink-0"
          >
            <Lock className="w-4 h-4" />
            Sign in to read &amp; submit
          </Link>
        ) : (
          <Link
            to="/dashboard/prompts"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-sm font-bold text-emerald-400 hover:bg-white/5 shrink-0"
          >
            Go to prompt dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prompts.map((p, i) => (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/25 to-zinc-900/50 overflow-hidden flex flex-col"
          >
            <div className="px-4 pt-4 pb-2 flex flex-wrap items-center gap-2 justify-between border-b border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 truncate max-w-[55%]">
                {p.series_title || "Series"}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold tabular-nums shrink-0">
                <span className="px-2 py-0.5 rounded-lg bg-white/10 text-emerald-300 border border-emerald-500/20">
                  {Number(p.submit_cost_tokens)} tokens
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/25">
                  {Number(p.reward_kes).toLocaleString("en-KE")} KES
                </span>
              </div>
            </div>

            <div className={cn("px-4 py-4 flex-1 min-h-[7rem]", isGuest && "select-none")}>
              <div
                className={cn(
                  "space-y-2 text-sm leading-relaxed",
                  isGuest && "blur-[8px] opacity-[0.85]"
                )}
              >
                <p className="font-semibold text-white">{p.headline}</p>
                <p className="text-zinc-400">{p.instructions}</p>
              </div>
            </div>

            {!isGuest ? (
              <div className="px-4 pb-4">
                <Link
                  to={`/dashboard/prompts/${p.series_id}`}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                >
                  Open series
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="h-2" aria-hidden />
            )}
          </motion.article>
        ))}
      </div>
    </section>
  );
}
