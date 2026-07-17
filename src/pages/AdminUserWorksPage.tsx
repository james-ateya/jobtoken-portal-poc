import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  FileText,
  Loader2,
  MessageSquareText,
  XCircle,
} from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";
import { AdminPagination } from "../components/AdminPagination";
import {
  PromptSubmissionReviewModal,
  type PromptReviewSubmission,
} from "../components/PromptSubmissionReviewModal";

type AttemptRow = {
  submission_id: string;
  series_title: string | null;
  prompt_headline: string | null;
  answer_text: string;
  word_count: number;
  reward_kes: number;
  tokens_charged: number;
  grade_status: string;
  submitted_at: string;
  graded_at: string | null;
  grader_email: string | null;
  grader_name: string | null;
  grading_note: string | null;
  credited_kes: number | null;
};

type WorksReport = {
  user: {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string | null;
  };
  summary: {
    submissions_total: number;
    passed_count: number;
    failed_count: number;
    pending_count: number;
    earnings_balance_kes: number;
  };
  attempts: AttemptRow[];
  total?: number;
  totalPages?: number;
};

function formatKes(value: number): string {
  return value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function gradeMeta(status: string) {
  if (status === "pass") {
    return {
      label: "Pass",
      className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      icon: CheckCircle2,
    };
  }
  if (status === "fail") {
    return {
      label: "Fail",
      className: "bg-rose-500/15 text-rose-300 border-rose-500/30",
      icon: XCircle,
    };
  }
  return {
    label: "Pending",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: Clock3,
  };
}

export function AdminUserWorksPage({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const { userId } = useParams<{ userId: string }>();
  const [report, setReport] = useState<WorksReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "pass" | "fail" | "pending">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<AttemptRow | null>(null);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await apiFetch(`/api/admin/users/${userId}/works?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load user works");
      setReport(json as WorksReport);
      setTotalPages(Math.max(1, Number(json.totalPages) || 1));
    } catch (error: any) {
      showToast(error.message || "Could not load works", "error");
    } finally {
      setLoading(false);
    }
  }, [userId, page, statusFilter, showToast]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied`, "success");
    } catch {
      showToast("Could not copy", "error");
    }
  };

  const grade = async (submissionId: string, gradeVal: "pass" | "fail", gradingNote: string) => {
    setGradingId(submissionId);
    try {
      const res = await apiFetch(`/api/admin/prompt-submissions/${submissionId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: gradeVal,
          gradingNote: gradingNote.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Grade failed");
      showToast(
        gradeVal === "pass" ? "Marked as pass." : "Marked as fail.",
        "success"
      );
      setReviewAttempt(null);
      await load();
    } catch (error: any) {
      showToast(error.message || "Could not grade", "error");
    } finally {
      setGradingId(null);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Seeker works</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Prompt answers and admin pass/fail feedback — useful when users ask about a review.
            </p>
          </div>
        </div>
        <Link
          to="/admin/users?tab=seeker"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to users
        </Link>
      </div>

      {loading && !report ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : report ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-semibold text-lg">{report.user.full_name || "—"}</p>
            <p className="text-sm text-zinc-500">{report.user.email || report.user.id}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Total</p>
                <p className="text-xl font-bold tabular-nums">{report.summary.submissions_total}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-emerald-500/80 font-bold">
                  Passed
                </p>
                <p className="text-xl font-bold tabular-nums text-emerald-300">
                  {report.summary.passed_count}
                </p>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-rose-400/80 font-bold">
                  Failed
                </p>
                <p className="text-xl font-bold tabular-nums text-rose-300">
                  {report.summary.failed_count}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">
                  Earnings
                </p>
                <p className="text-xl font-bold tabular-nums text-amber-200">
                  {formatKes(report.summary.earnings_balance_kes)}
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["pass", "Pass"],
                ["fail", "Fail"],
                ["pending", "Pending"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors",
                  statusFilter === value
                    ? "bg-emerald-500 text-black border-emerald-400"
                    : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
            </div>
          ) : report.attempts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-zinc-500">
              No prompt works found for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {report.attempts.map((attempt) => {
                const badge = gradeMeta(attempt.grade_status);
                const BadgeIcon = badge.icon;
                const open = expandedId === attempt.submission_id;
                return (
                  <article
                    key={attempt.submission_id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId((id) =>
                          id === attempt.submission_id ? null : attempt.submission_id
                        )
                      }
                      className="w-full text-left px-4 py-4 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">
                            {attempt.series_title || "Series"}
                          </p>
                          <p className="font-semibold text-white mt-0.5">
                            {attempt.prompt_headline || "Prompt task"}
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            Submitted {formatDateTime(attempt.submitted_at)}
                            {" · "}
                            {attempt.tokens_charged} tokens
                            {" · "}
                            {formatKes(attempt.reward_kes)} KES reward
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border shrink-0",
                            badge.className
                          )}
                        >
                          <BadgeIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                      </div>
                      {attempt.grading_note ? (
                        <p className="text-xs text-zinc-400 mt-2 line-clamp-2 flex items-start gap-1.5">
                          <MessageSquareText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-500" />
                          <span>{attempt.grading_note}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-600 mt-2">No admin feedback note on file.</p>
                      )}
                    </button>

                    {open ? (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                              Seeker answer
                            </p>
                            <button
                              type="button"
                              onClick={() => copyText("Answer", attempt.answer_text || "")}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-white"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </button>
                          </div>
                          <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                            {attempt.answer_text || "—"}
                          </p>
                          <p className="text-[11px] text-zinc-600 mt-2">
                            {attempt.word_count} words
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                              Admin response
                            </p>
                            {attempt.grading_note ? (
                              <button
                                type="button"
                                onClick={() =>
                                  copyText("Admin note", attempt.grading_note || "")
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-white"
                              >
                                <Copy className="w-3 h-3" />
                                Copy note
                              </button>
                            ) : null}
                          </div>
                          <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
                            {attempt.grading_note?.trim() || "No grading note was saved."}
                          </p>
                          <div className="mt-3 text-xs text-zinc-500 space-y-0.5">
                            <p>
                              Graded by:{" "}
                              <span className="text-zinc-300">
                                {attempt.grader_name || attempt.grader_email || "—"}
                              </span>
                            </p>
                            <p>Graded at: {formatDateTime(attempt.graded_at)}</p>
                            {attempt.credited_kes != null ? (
                              <p>
                                Credited:{" "}
                                <span className="text-emerald-300">
                                  {formatKes(attempt.credited_kes)} KES
                                </span>
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setReviewAttempt(attempt)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/15 border border-white/10"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Open full review
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          <AdminPagination
            page={page}
            totalPages={totalPages}
            total={report.total ?? report.attempts.length}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <div className="text-center text-zinc-500 py-16">User works could not be loaded.</div>
      )}

      {reviewAttempt && report ? (
        <PromptSubmissionReviewModal
          onClose={() => setReviewAttempt(null)}
          submission={
            {
              id: reviewAttempt.submission_id,
              answer_text: reviewAttempt.answer_text,
              word_count: reviewAttempt.word_count,
              tokens_charged: reviewAttempt.tokens_charged,
              grade_status: reviewAttempt.grade_status,
              submitted_at: reviewAttempt.submitted_at,
              prompt_headline: reviewAttempt.prompt_headline,
              reward_kes: reviewAttempt.reward_kes,
              series_title: reviewAttempt.series_title,
              seeker_email: report.user.email,
              seeker_name: report.user.full_name,
              grading_note: reviewAttempt.grading_note,
            } satisfies PromptReviewSubmission
          }
          gradingId={gradingId}
          onGrade={grade}
        />
      ) : null}
    </main>
  );
}
