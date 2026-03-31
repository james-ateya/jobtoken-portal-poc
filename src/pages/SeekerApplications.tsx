import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { SeekerApplicationCard, type SeekerApplicationRow } from "../components/SeekerApplicationCard";
import { motion } from "motion/react";
import { Loader2, ClipboardList, LayoutDashboard, Filter } from "lucide-react";
import { cn } from "../lib/utils";

const IN_FUNNEL = new Set(["pending", "reviewing", "qualified", "interview"]);

type FilterTab = "all" | "in_progress" | "shortlisted" | "offer" | "rejected";

function mapApplicationRows(data: any[] | null): SeekerApplicationRow[] {
  return (data || []).map((r: any) => {
    const j = r.jobs;
    return {
      id: r.id,
      status: r.status,
      notes: r.notes,
      created_at: r.created_at,
      updated_at: r.updated_at,
      job: j
        ? {
            id: j.id,
            title: j.title,
            job_type: j.job_type,
            description: j.description,
            token_cost: j.token_cost,
            employer: null,
          }
        : null,
    };
  });
}

export function SeekerApplicationsPage({
  user,
  showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [rows, setRows] = useState<SeekerApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("applications")
        .select(
          `
          id,
          status,
          notes,
          created_at,
          updated_at,
          jobs!inner (
            id,
            title,
            job_type,
            description,
            token_cost
          )
        `
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows(mapApplicationRows(data));
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Could not load applications", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "in_progress") {
      return rows.filter((r) => IN_FUNNEL.has(r.status || "pending"));
    }
    return rows.filter((r) => (r.status || "pending") === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      in_progress: 0,
      shortlisted: 0,
      offer: 0,
      rejected: 0,
    };
    for (const r of rows) {
      const s = r.status || "pending";
      if (IN_FUNNEL.has(s)) c.in_progress++;
      if (s === "shortlisted") c.shortlisted++;
      if (s === "offer") c.offer++;
      if (s === "rejected") c.rejected++;
    }
    return c;
  }, [rows]);

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "in_progress", label: "In progress", count: counts.in_progress },
    { id: "shortlisted", label: "Shortlisted", count: counts.shortlisted },
    { id: "offer", label: "Offer", count: counts.offer },
    { id: "rejected", label: "Not selected", count: counts.rejected },
  ];

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <ClipboardList className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Seeker</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Application history</h1>
          <p className="text-zinc-500 mt-2 max-w-xl">
            See every job you have applied for, your status, notes from employers, and message
            threads when they need more information.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-8">
        <span className="text-xs text-zinc-500 flex items-center gap-1.5 mr-2">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </span>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors",
              filter === t.id
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-white/5 text-zinc-500 border-white/10 hover:border-white/20"
            )}
          >
            {t.label}
            <span className="ml-1.5 text-zinc-600 tabular-nums">({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
          <ClipboardList className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 font-medium">
            {rows.length === 0
              ? "You have not applied to any jobs yet."
              : "No applications in this filter."}
          </p>
          <Link
            to="/"
            className="inline-block mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:bg-emerald-400"
          >
            Browse jobs
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((row, i) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.24) }}
            >
              <SeekerApplicationCard row={row} userId={user.id} />
            </motion.div>
          ))}
        </div>
      )}
    </main>
  );
}
