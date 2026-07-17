import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Loader2, PenLine, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import {
  PROMPT_KES_PER_TOKEN,
  attemptCostKes,
  formatPromptKes,
  getPromptTier,
  type PromptTierId,
} from "../lib/promptTier";

export type SeriesCard = {
  id: string;
  title: string;
  description: string | null;
  prompt_count?: number;
  min_submit_cost_tokens?: number | null;
  max_reward_kes?: number | null;
  entry_tier?: PromptTierId | null;
};

const TIER_BADGE: Record<PromptTierId, string> = {
  starter: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  core: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  premium: "bg-amber-500/15 text-amber-200 border-amber-500/30",
};

export function PromptSeriesCards({
  compact = false,
}: {
  /** When true, show at most four cards and emphasize link to full browse. */
  compact?: boolean;
}) {
  const [series, setSeries] = useState<SeriesCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/prompts/series");
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "Could not load prompt series");
        if (!cancelled) {
          const list: SeriesCard[] = j.series ?? [];
          // Student-friendly: series with lower entry cost first
          list.sort((a, b) => {
            const ta = a.min_submit_cost_tokens ?? 999;
            const tb = b.min_submit_cost_tokens ?? 999;
            if (ta !== tb) return ta - tb;
            return (a.title || "").localeCompare(b.title || "");
          });
          setSeries(list);
        }
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

  const shown = compact ? series.slice(0, 4) : series;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-400/90 text-center py-6">{error}</p>
    );
  }

  if (series.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8 rounded-2xl border border-dashed border-white/10">
        No prompt tasks are published yet. Check back later.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {shown.map((s, i) => {
          const minTokens = s.min_submit_cost_tokens ?? null;
          const entryTier =
            s.entry_tier || (minTokens != null ? getPromptTier(minTokens).id : null);
          const costKes = minTokens != null ? attemptCostKes(minTokens) : null;

          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={`/dashboard/prompts/${s.id}`}
                className="block h-full p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/30 to-zinc-900/40 hover:border-emerald-500/35 hover:bg-emerald-950/20 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <PenLine className="w-4 h-4 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          Prompt series
                        </span>
                      </div>
                      {entryTier ? (
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
                            TIER_BADGE[entryTier]
                          )}
                        >
                          From {entryTier}
                        </span>
                      ) : null}
                    </div>
                    <h4 className="font-bold text-white group-hover:text-emerald-200 transition-colors line-clamp-2">
                      {s.title}
                    </h4>
                    {s.description ? (
                      <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{s.description}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-zinc-400 tabular-nums">
                      {s.prompt_count != null ? (
                        <span>{s.prompt_count} task{s.prompt_count === 1 ? "" : "s"}</span>
                      ) : null}
                      {minTokens != null && costKes != null ? (
                        <span>
                          From {minTokens} tokens ({formatPromptKes(costKes)} KES)
                        </span>
                      ) : null}
                      {s.max_reward_kes != null ? (
                        <span className="text-amber-200/90">
                          Up to {formatPromptKes(s.max_reward_kes)} KES
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-2">
                      1 token = {PROMPT_KES_PER_TOKEN} KES top-up
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-400 shrink-0" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
      {!compact && series.length > 4 ? (
        <p className="text-xs text-zinc-500 text-center">
          Showing all {series.length} series · sorted by lowest entry cost first
        </p>
      ) : null}
      {compact ? (
        <div className="text-center pt-1">
          <Link
            to="/dashboard/prompts"
            className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300"
          >
            {series.length > 4 ? `View all ${series.length} series` : "Open prompt tasks page"}
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
