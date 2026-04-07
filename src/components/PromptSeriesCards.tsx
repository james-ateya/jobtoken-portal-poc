import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Loader2, PenLine, ChevronRight } from "lucide-react";

export type SeriesCard = {
  id: string;
  title: string;
  description: string | null;
  prompt_count: number;
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
        if (!cancelled) setSeries(j.series ?? []);
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
        {shown.map((s, i) => (
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
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <PenLine className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      Prompt series
                    </span>
                  </div>
                  <h4 className="font-bold text-white group-hover:text-emerald-200 transition-colors line-clamp-2">
                    {s.title}
                  </h4>
                  {s.description ? (
                    <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{s.description}</p>
                  ) : null}
                  <p className="text-xs text-zinc-600 mt-3">
                    {s.prompt_count} task{s.prompt_count === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-400 shrink-0" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      {!compact && series.length > 4 ? (
        <p className="text-xs text-zinc-500 text-center">
          Showing all {series.length} series.
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
