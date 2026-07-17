import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Loader2, Lock } from "lucide-react";
import { cn } from "../lib/utils";
import {
  PROMPT_TIER_BATCH_SIZE,
  attemptCostKes,
  filterAndOrderByTier,
  formatPromptKes,
  getPromptTier,
  type PromptTierId,
} from "../lib/promptTier";
import { PromptTierBadge } from "./PromptTierBadge";

export type TieredPrompt = {
  id: string;
  headline: string;
  instructions: string;
  reward_kes: number | string;
  submit_cost_tokens: number;
  series_id: string;
  series_title: string | null;
};

const FILTERS: { id: "all" | PromptTierId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "starter", label: "Starter" },
  { id: "core", label: "Core" },
  { id: "premium", label: "Premium" },
];

type Props = {
  /** Guest mode blurs question text and hides open links. */
  user?: any | null;
  /** Fetch full catalog (dashboard /prompts). Home uses first round only. */
  fullCatalog?: boolean;
  /** Cap how many cards to show after filter/order (compact dashboard). */
  maxVisible?: number;
  /** Show link to /dashboard/prompts under the grid. */
  showViewAllLink?: boolean;
  className?: string;
  hideEmptySection?: boolean;
};

export function PromptTieredBrowse({
  user = null,
  fullCatalog = false,
  maxVisible,
  showViewAllLink = false,
  className,
  hideEmptySection = false,
}: Props) {
  const [prompts, setPrompts] = useState<TieredPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<"all" | PromptTierId>("all");

  const isGuest = !user;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = fullCatalog
          ? "/api/prompts/home-preview?full=1"
          : "/api/prompts/home-preview";
        const res = await fetch(url);
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
  }, [fullCatalog]);

  const ordered = useMemo(
    () => filterAndOrderByTier(prompts, tierFilter, PROMPT_TIER_BATCH_SIZE),
    [prompts, tierFilter]
  );

  const visible = maxVisible != null ? ordered.slice(0, maxVisible) : ordered;

  /** For All view, insert a heading whenever the tier batch changes. */
  const rows = useMemo(() => {
    if (tierFilter !== "all") {
      return visible.map((p) => ({ type: "prompt" as const, prompt: p }));
    }
    const out: Array<
      | { type: "heading"; tier: PromptTierId }
      | { type: "prompt"; prompt: TieredPrompt }
    > = [];
    let lastTier: PromptTierId | null = null;
    for (const p of visible) {
      const tier = getPromptTier(p.submit_cost_tokens).id;
      if (tier !== lastTier) {
        out.push({ type: "heading", tier });
        lastTier = tier;
      }
      out.push({ type: "prompt", prompt: p });
    }
    return out;
  }, [visible, tierFilter]);

  if (loading) {
    return (
      <div className={cn("flex justify-center py-10", className)}>
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error || prompts.length === 0) {
    if (hideEmptySection) return null;
    return (
      <p className={cn("text-sm text-zinc-500 text-center py-8", className)}>
        {error || "No prompt tasks are published yet. Check back later."}
      </p>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-2 sticky top-0 z-10 py-1 bg-zinc-950/80 backdrop-blur-sm">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTierFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors",
              tierFilter === f.id
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                : "bg-white/5 text-zinc-400 border-white/10 hover:border-white/20 hover:text-zinc-200"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {tierFilter === "all" ? (
        <p className="text-[11px] text-zinc-500">
          All view: batches of {PROMPT_TIER_BATCH_SIZE} — Starter, then Core, then Premium.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500 py-6 text-center border border-dashed border-white/10 rounded-2xl">
          No {tierFilter} tasks right now. Try another filter.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row, i) => {
            if (row.type === "heading") {
              const tierMeta = getPromptTier(
                row.tier === "starter" ? 1 : row.tier === "core" ? 10 : 50
              );
              return (
                <div
                  key={`h-${row.tier}-${i}`}
                  className="flex items-center gap-2 pt-2 first:pt-0"
                >
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest border",
                      tierMeta.className
                    )}
                  >
                    {tierMeta.label} · up to {PROMPT_TIER_BATCH_SIZE}
                  </span>
                  <span className="text-[11px] text-zinc-500">{tierMeta.hint}</span>
                </div>
              );
            }

            const p = row.prompt;
            const costKes = attemptCostKes(p.submit_cost_tokens);
            return (
              <motion.article
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/25 to-zinc-900/50 overflow-hidden flex flex-col"
              >
                <div className="px-4 pt-4 pb-2 flex flex-wrap items-center gap-2 justify-between border-b border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <PromptTierBadge submitCostTokens={p.submit_cost_tokens} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 truncate">
                      {p.series_title || "Series"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold tabular-nums shrink-0">
                    <span className="px-2 py-0.5 rounded-lg bg-white/10 text-emerald-300 border border-emerald-500/20">
                      {Number(p.submit_cost_tokens)} tokens · {formatPromptKes(costKes)} KES
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-200 border border-amber-500/25">
                      Earn {formatPromptKes(p.reward_kes)} KES
                    </span>
                  </div>
                </div>

                <div className={cn("px-4 py-4 flex-1 min-h-[5rem]", isGuest && "select-none")}>
                  <div
                    className={cn(
                      "space-y-2 text-sm leading-relaxed",
                      isGuest && "blur-[8px] opacity-[0.85]"
                    )}
                  >
                    <p className="font-semibold text-white">{p.headline}</p>
                    <p className="text-zinc-400 line-clamp-3">{p.instructions}</p>
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
            );
          })}
        </div>
      )}

      {showViewAllLink ? (
        <div className="text-center pt-2">
          {isGuest ? (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300"
            >
              <Lock className="w-4 h-4" />
              Sign in to browse all tasks
            </Link>
          ) : (
            <Link
              to="/dashboard/prompts"
              className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300"
            >
              View all prompt tasks
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
