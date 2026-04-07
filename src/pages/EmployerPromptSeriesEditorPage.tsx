import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Loader2,
  PenLine,
  Plus,
  Pencil,
  Trash2,
  Save,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
type Series = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
};

type PromptRow = {
  id: string;
  series_id: string;
  sort_order: number;
  headline: string;
  instructions: string;
  word_limit: number | null;
  reward_kes: number | string;
  submit_cost_tokens: number;
  is_published: boolean;
};

const emptyPromptForm = {
  headline: "",
  instructions: "",
  word_limit: "",
  reward_kes: "0",
  submit_cost_tokens: "1",
  is_published: true,
};

export function EmployerPromptSeriesEditorPage({
  user,
  showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const { seriesId } = useParams<{ seriesId: string }>();
  const navigate = useNavigate();
  const [series, setSeries] = useState<Series | null>(null);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSeries, setSavingSeries] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [promptMode, setPromptMode] = useState<"create" | "edit">("create");
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptForm, setPromptForm] = useState(emptyPromptForm);
  const [savingPrompt, setSavingPrompt] = useState(false);

  const load = useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const { data: s, error: se } = await supabase
        .from("prompt_series")
        .select("id, title, description, status, created_by")
        .eq("id", seriesId)
        .maybeSingle();
      if (se) throw se;
      if (!s || s.created_by !== user.id) {
        setSeries(null);
        setPrompts([]);
        return;
      }
      setSeries(s as Series);
      setTitle(s.title);
      setDescription(s.description ?? "");
      setStatus(s.status as "draft" | "published");

      const { data: plist, error: pe } = await supabase
        .from("prompts")
        .select(
          "id, series_id, sort_order, headline, instructions, word_limit, reward_kes, submit_cost_tokens, is_published"
        )
        .eq("series_id", seriesId)
        .order("sort_order", { ascending: true });
      if (pe) throw pe;
      setPrompts((plist ?? []) as PromptRow[]);
    } catch (e: any) {
      showToast(e.message || "Could not load", "error");
      setSeries(null);
    } finally {
      setLoading(false);
    }
  }, [seriesId, user.id, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSeries = async (e: FormEvent) => {
    e.preventDefault();
    if (!seriesId || !series) return;
    const t = title.trim();
    if (!t) {
      showToast("Title is required", "error");
      return;
    }
    setSavingSeries(true);
    try {
      const { error } = await supabase
        .from("prompt_series")
        .update({
          title: t,
          description: description.trim() || null,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", seriesId);
      if (error) throw error;
      showToast("Series saved", "success");
      load();
    } catch (e: any) {
      showToast(e.message || "Save failed", "error");
    } finally {
      setSavingSeries(false);
    }
  };

  const openCreatePrompt = () => {
    setPromptMode("create");
    setEditingPromptId(null);
    setPromptForm(emptyPromptForm);
    setPromptModalOpen(true);
  };

  const openEditPrompt = (p: PromptRow) => {
    setPromptMode("edit");
    setEditingPromptId(p.id);
    setPromptForm({
      headline: p.headline,
      instructions: p.instructions,
      word_limit: p.word_limit != null ? String(p.word_limit) : "",
      reward_kes: String(p.reward_kes ?? 0),
      submit_cost_tokens: String(p.submit_cost_tokens ?? 1),
      is_published: p.is_published,
    });
    setPromptModalOpen(true);
  };

  const parseWordLimit = (): number | null => {
    const raw = String(promptForm.word_limit).trim();
    if (!raw) return null;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  };

  const savePrompt = async (e: FormEvent) => {
    e.preventDefault();
    if (!seriesId) return;
    const headline = promptForm.headline.trim();
    const instructions = promptForm.instructions.trim();
    if (!headline || !instructions) {
      showToast("Headline and instructions are required", "error");
      return;
    }
    const reward = parseFloat(String(promptForm.reward_kes));
    const cost = parseInt(String(promptForm.submit_cost_tokens), 10);
    if (!Number.isFinite(reward) || reward < 0) {
      showToast("Reward (KES) must be zero or positive", "error");
      return;
    }
    if (!Number.isFinite(cost) || cost < 1) {
      showToast("Submit cost must be at least 1 token", "error");
      return;
    }
    const wl = parseWordLimit();
    if (promptForm.word_limit !== "" && wl === null) {
      showToast("Word limit must be a positive integer or empty", "error");
      return;
    }

    setSavingPrompt(true);
    try {
      if (promptMode === "create") {
        const maxSort = prompts.reduce((m, p) => Math.max(m, p.sort_order), -1);
        const { error } = await supabase.from("prompts").insert({
          series_id: seriesId,
          sort_order: maxSort + 1,
          headline,
          instructions,
          word_limit: wl,
          reward_kes: Math.round(reward * 100) / 100,
          submit_cost_tokens: cost,
          is_published: promptForm.is_published,
        });
        if (error) throw error;
        showToast("Prompt added", "success");
      } else if (editingPromptId) {
        const { error } = await supabase
          .from("prompts")
          .update({
            headline,
            instructions,
            word_limit: wl,
            reward_kes: Math.round(reward * 100) / 100,
            submit_cost_tokens: cost,
            is_published: promptForm.is_published,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingPromptId);
        if (error) throw error;
        showToast("Prompt updated", "success");
      }
      setPromptModalOpen(false);
      load();
    } catch (e: any) {
      showToast(e.message || "Could not save prompt", "error");
    } finally {
      setSavingPrompt(false);
    }
  };

  const movePrompt = async (index: number, direction: -1 | 1) => {
    const j = index + direction;
    if (j < 0 || j >= prompts.length) return;
    const a = prompts[index];
    const b = prompts[j];
    const orderA = a.sort_order;
    const orderB = b.sort_order;
    try {
      const { error: e1 } = await supabase
        .from("prompts")
        .update({ sort_order: orderB, updated_at: new Date().toISOString() })
        .eq("id", a.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("prompts")
        .update({ sort_order: orderA, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      if (e2) throw e2;
      showToast("Order updated", "success");
      load();
    } catch (e: any) {
      showToast(e.message || "Could not reorder", "error");
    }
  };

  const deletePrompt = async (p: PromptRow) => {
    if (!confirm(`Delete prompt “${p.headline}” and its submissions?`)) return;
    try {
      const { error } = await supabase.from("prompts").delete().eq("id", p.id);
      if (error) throw error;
      showToast("Prompt deleted", "success");
      load();
    } catch (e: any) {
      showToast(e.message || "Could not delete", "error");
    }
  };

  const deleteSeries = async () => {
    if (!series) return;
    if (
      !confirm(
        `Delete series “${series.title}” and all prompts and submissions? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const { error } = await supabase.from("prompt_series").delete().eq("id", series.id);
      if (error) throw error;
      showToast("Series deleted", "success");
      navigate("/dashboard/employer/prompts");
    } catch (e: any) {
      showToast(e.message || "Could not delete series", "error");
    }
  };

  if (!seriesId) return null;

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!series) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-20 text-center text-white">
        <p className="text-zinc-500 mb-6">Series not found or you don&apos;t have access.</p>
        <Link
          to="/dashboard/employer/prompts"
          className="inline-flex items-center gap-2 text-emerald-400 font-bold hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to prompt series
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 text-white">
      <div className="mb-8">
        <Link
          to="/dashboard/employer/prompts"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-emerald-400 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          All series
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <PenLine className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <h1 className="text-2xl font-bold">Edit series</h1>
              <p className="text-zinc-500 text-sm mt-0.5">
                Draft series are only visible to you. Publish when prompts are ready.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={deleteSeries}
            className="text-sm text-red-400/90 hover:text-red-300 font-medium"
          >
            Delete series
          </button>
        </div>
      </div>

      <form
        onSubmit={saveSeries}
        className="p-6 rounded-2xl border border-white/10 bg-white/[0.03] space-y-4 mb-10"
      >
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-emerald-500/40"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 focus:outline-none focus:border-emerald-500/40 resize-y"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published")}
            className="select-themed mt-1 w-full max-w-xs"
          >
            <option value="draft">Draft (hidden from job seekers)</option>
            <option value="published">Published (visible on seeker dashboard)</option>
          </select>
        </div>
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingSeries}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold hover:bg-emerald-400 disabled:opacity-50"
          >
            {savingSeries ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save series
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold">Prompts in this series</h2>
        <button
          type="button"
          onClick={openCreatePrompt}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 font-bold text-sm hover:bg-white/15"
        >
          <Plus className="w-4 h-4" />
          Add prompt
        </button>
      </div>

      {prompts.length === 0 ? (
        <p className="text-zinc-500 text-center py-12 rounded-2xl border border-dashed border-white/10">
          No prompts yet. Add one so seekers can respond.
        </p>
      ) : (
        <ul className="space-y-3">
          {prompts.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold">{p.headline}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {Number(p.reward_kes).toLocaleString("en-KE")} KES · {p.submit_cost_tokens}{" "}
                  tokens · Sort {p.sort_order}
                  {!p.is_published ? " · Hidden" : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => movePrompt(i, -1)}
                  disabled={i === 0}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-25"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => movePrompt(i, 1)}
                  disabled={i === prompts.length - 1}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 disabled:opacity-25"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openEditPrompt(p)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deletePrompt(p)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      {promptModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && !savingPrompt && setPromptModalOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 my-8 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4">
              {promptMode === "create" ? "New prompt" : "Edit prompt"}
            </h3>
            <form onSubmit={savePrompt} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Headline</label>
                <input
                  required
                  value={promptForm.headline}
                  onChange={(e) => setPromptForm({ ...promptForm, headline: e.target.value })}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">Instructions</label>
                <textarea
                  required
                  rows={6}
                  value={promptForm.instructions}
                  onChange={(e) =>
                    setPromptForm({ ...promptForm, instructions: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 resize-y"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500">Reward (KES)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={promptForm.reward_kes}
                    onChange={(e) => setPromptForm({ ...promptForm, reward_kes: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-zinc-500">
                    Submit cost (tokens)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={promptForm.submit_cost_tokens}
                    onChange={(e) =>
                      setPromptForm({ ...promptForm, submit_cost_tokens: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-zinc-500">
                  Word limit (optional)
                </label>
                <input
                  type="number"
                  min={1}
                  placeholder="No limit"
                  value={promptForm.word_limit}
                  onChange={(e) =>
                    setPromptForm({ ...promptForm, word_limit: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promptForm.is_published}
                  onChange={(e) =>
                    setPromptForm({ ...promptForm, is_published: e.target.checked })
                  }
                  className="rounded border-zinc-600"
                />
                <span className="text-sm text-zinc-300">Prompt visible (when series is published)</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingPrompt}
                  onClick={() => setPromptModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrompt}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-black font-bold disabled:opacity-50"
                >
                  {savingPrompt ? "Saving…" : promptMode === "create" ? "Add prompt" : "Save prompt"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </main>
  );
}
