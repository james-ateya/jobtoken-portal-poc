import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import {
  Loader2,
  PenLine,
  Plus,
  ChevronRight,
  LayoutDashboard,
  Trash2,
} from "lucide-react";
import { cn } from "../lib/utils";

type SeriesRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  updated_at: string;
  promptCount?: number;
};

export function EmployerPromptSeriesListPage({
  user,
  showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: series, error } = await supabase
        .from("prompt_series")
        .select("id, title, description, status, updated_at")
        .eq("created_by", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const list = series ?? [];
      const ids = list.map((s) => s.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: prompts, error: pe } = await supabase
          .from("prompts")
          .select("series_id")
          .in("series_id", ids);
        if (pe) throw pe;
        for (const row of prompts ?? []) {
          const sid = (row as { series_id: string }).series_id;
          counts[sid] = (counts[sid] || 0) + 1;
        }
      }
      setRows(
        list.map((s) => ({
          ...s,
          promptCount: counts[s.id] ?? 0,
        }))
      );
    } catch (e: any) {
      showToast(e.message || "Could not load series", "error");
    } finally {
      setLoading(false);
    }
  }, [user.id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || "Untitled series";
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("prompt_series")
        .insert({
          created_by: user.id,
          title,
          description: newDescription.trim() || null,
          status: "draft",
        })
        .select("id")
        .single();
      if (error) throw error;
      showToast("Series created", "success");
      setModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      if (data?.id) {
        navigate(`/dashboard/employer/prompts/${data.id}`);
      } else {
        load();
      }
    } catch (e: any) {
      showToast(e.message || "Could not create series", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (s: SeriesRow) => {
    if (
      !confirm(
        `Delete “${s.title}” and all its prompts and submissions? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const { error } = await supabase.from("prompt_series").delete().eq("id", s.id);
      if (error) throw error;
      showToast("Series deleted", "success");
      load();
    } catch (e: any) {
      showToast(e.message || "Could not delete", "error");
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <PenLine className="w-8 h-8 text-emerald-400" />
            Prompt series
          </h1>
          <p className="text-zinc-500 mt-1">
            Create task series for job seekers. Publish when ready; KES rewards are funded by the
            platform when admins approve submissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/dashboard/employer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10"
          >
            <LayoutDashboard className="w-4 h-4" />
            Employer portal
          </Link>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
          >
            <Plus className="w-5 h-5" />
            New series
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border border-dashed border-white/15 bg-white/[0.02]">
          <p className="text-zinc-500 mb-6">You don&apos;t have any prompt series yet.</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-6 py-3 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400"
          >
            Create your first series
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-lg truncate">{s.title}</h2>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                      s.status === "published"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-zinc-500/15 text-zinc-400 border-zinc-500/25"
                    )}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {s.promptCount ?? 0} prompt{(s.promptCount ?? 0) === 1 ? "" : "s"} · Updated{" "}
                  {new Date(s.updated_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(s)}
                  className="p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                  title="Delete series"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <Link
                  to={`/dashboard/employer/prompts/${s.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 font-bold text-sm hover:bg-white/15"
                >
                  Edit
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-series-title"
          onClick={(e) => e.target === e.currentTarget && !creating && setModalOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-xl">
            <h2 id="new-series-title" className="text-xl font-bold mb-4">
              New prompt series
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Title
                </label>
                <input
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. March writing sprint"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Description (optional)
                </label>
                <textarea
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 min-h-[100px]"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What this series is about…"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-black font-bold disabled:opacity-50"
                >
                  {creating ? "Creating…" : "Create & edit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
