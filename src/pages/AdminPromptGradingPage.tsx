import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Loader2, PenLine, CheckCircle, XCircle, ArrowLeft, Eye, X } from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";

type SubmissionRow = {
  id: string;
  user_id: string;
  prompt_id: string;
  answer_text: string;
  word_count: number;
  tokens_charged: number;
  grade_status: string;
  submitted_at: string;
  prompt_headline: string | null;
  reward_kes: number | string | null;
  series_title: string | null;
  seeker_email: string | null;
  seeker_name: string | null;
};

export function AdminPromptGradingPage({
  user: _user,
  showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubmissionRow | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/admin/prompt-submissions?status=pending&page=${page}&pageSize=${pageSize}`
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed to load");
      setRows((j.submissions ?? []) as SubmissionRow[]);
      setTotalPages(Math.max(1, Number(j.totalPages) || 1));
    } catch (e: any) {
      showToast(e.message || "Could not load submissions", "error");
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const grade = async (submissionId: string, gradeVal: "pass" | "fail") => {
    setGradingId(submissionId);
    try {
      const res = await apiFetch(`/api/admin/prompt-submissions/${submissionId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: gradeVal }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Grade failed");
      if (j.duplicateReward) {
        showToast("Already credited (duplicate guard).", "success");
      } else {
        showToast(
          gradeVal === "pass"
            ? "Marked as pass — seeker credited to earnings (KES)."
            : "Marked as fail.",
          "success"
        );
      }
      if (detail?.id === submissionId) setDetail(null);
      load();
    } catch (e: any) {
      showToast(e.message || "Could not grade", "error");
    } finally {
      setGradingId(null);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black">
            <PenLine className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Prompt grading queue</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Open each submission to read the full answer, then pass or fail. List stays compact.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30"
            >
              Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30"
            >
              Next
            </button>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
            Admin home
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center text-zinc-500 py-16 rounded-2xl border border-dashed border-white/10">
          No pending submissions.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/90">
                  {s.series_title || "Series"}
                </p>
                <h2 className="font-bold text-base mt-0.5 truncate">{s.prompt_headline || "Prompt"}</h2>
                <p className="text-sm text-zinc-500 mt-1 truncate">
                  {s.seeker_name || "—"} · {s.seeker_email || s.user_id}
                </p>
                <p className="text-xs text-zinc-600 mt-2">
                  {s.word_count} words · {s.tokens_charged} tokens ·{" "}
                  {new Date(s.submitted_at).toLocaleString()}
                  {s.reward_kes != null ? (
                    <span className="text-amber-400/90">
                      {" "}
                      · Reward {Number(s.reward_kes).toLocaleString("en-KE")} KES on pass
                    </span>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(s)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm shrink-0 bg-white/10 hover:bg-white/15 border border-white/10"
              >
                <Eye className="w-4 h-4" />
                View answer
              </button>
            </motion.li>
          ))}
        </ul>
      )}

      {detail ? (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="grading-detail-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={() => setDetail(null)}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-3xl max-h-[min(90vh,720px)] rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-white/10 shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/90">
                  {detail.series_title || "Series"}
                </p>
                <h2 id="grading-detail-title" className="font-bold text-lg mt-1 text-white">
                  {detail.prompt_headline || "Prompt"}
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {detail.seeker_name || "—"} · {detail.seeker_email || detail.user_id}
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  {detail.word_count} words · {detail.tokens_charged} tokens charged · Submitted{" "}
                  {new Date(detail.submitted_at).toLocaleString()}
                </p>
                {detail.reward_kes != null ? (
                  <p className="text-xs text-amber-400/90 mt-2">
                    Reward on pass: {Number(detail.reward_kes).toLocaleString("en-KE")} KES (credited to seeker
                    earnings)
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 border-b border-white/10">
              <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{detail.answer_text}</p>
            </div>

            <div className="p-5 flex flex-wrap gap-3 justify-end shrink-0 bg-black/30">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/10"
              >
                Close
              </button>
              <button
                type="button"
                disabled={gradingId === detail.id}
                onClick={() => grade(detail.id, "fail")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              >
                <XCircle className="w-4 h-4" />
                Fail
              </button>
              <button
                type="button"
                disabled={gradingId === detail.id}
                onClick={() => grade(detail.id, "pass")}
                className={cn(
                  "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm",
                  "bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-40"
                )}
              >
                {gradingId === detail.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Pass
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </main>
  );
}
