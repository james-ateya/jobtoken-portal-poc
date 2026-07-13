import { useCallback, useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  PiggyBank,
  XCircle,
} from "lucide-react";
import { cn } from "../lib/utils";
import { apiFetch } from "../lib/apiFetch";
import { AdminPagination } from "../components/AdminPagination";
import { AdminVirtualTableRows } from "../components/AdminVirtualList";
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
  graded_by: string | null;
  grader_email: string | null;
  grader_name: string | null;
  grading_note: string | null;
  credited_kes: number | null;
  credited_at: string | null;
  reward_payable_on_pass: number;
};

type UserDetailReport = {
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
    total_reward_on_passed_kes: number;
    total_credited_kes: number;
    earnings_balance_kes: number;
  };
  attempts: AttemptRow[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
};

function formatKes(value: number): string {
  return value.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function gradeBadge(status: string) {
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

function toReviewSubmission(attempt: AttemptRow, user: UserDetailReport["user"]): PromptReviewSubmission {
  return {
    id: attempt.submission_id,
    answer_text: attempt.answer_text,
    word_count: attempt.word_count,
    tokens_charged: attempt.tokens_charged,
    grade_status: attempt.grade_status,
    submitted_at: attempt.submitted_at,
    prompt_headline: attempt.prompt_headline,
    reward_kes: attempt.reward_kes,
    series_title: attempt.series_title,
    seeker_email: user.email,
    seeker_name: user.full_name,
    grading_note: attempt.grading_note,
  };
}

export function AdminPayoutUserDetailPage({
  showToast,
}: {
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const { userId } = useParams<{ userId: string }>();
  const [report, setReport] = useState<UserDetailReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<AttemptRow | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/admin/payout-planning/user/${userId}?page=${page}&pageSize=${pageSize}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load user payout analysis");
      setReport(json as UserDetailReport);
      setTotalPages(Math.max(1, Number(json.totalPages) || 1));
    } catch (error: any) {
      showToast(error.message || "Could not load user analysis", "error");
    } finally {
      setLoading(false);
    }
  }, [userId, page, pageSize, showToast]);

  useEffect(() => {
    load();
  }, [load]);

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

      const adjustment = Number(j.earningsAdjustmentKes || 0);
      let message = gradeVal === "pass" ? "Marked as pass." : "Marked as fail.";
      if (adjustment > 0) {
        message += ` ${adjustment.toLocaleString("en-KE")} KES credited.`;
      } else if (adjustment < 0) {
        message += ` ${Math.abs(adjustment).toLocaleString("en-KE")} KES reversed.`;
      }
      if (j.emailSent) message += " Feedback email sent.";
      showToast(message, "success");

      setReviewAttempt(null);
      await load();
    } catch (error: any) {
      showToast(error.message || "Could not grade", "error");
    } finally {
      setGradingId(null);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Payout analysis</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              Review answers, pass or fail, and adjust earnings with feedback emailed to the seeker.
            </p>
          </div>
        </div>
        <Link
          to="/admin/payout-planning"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to payout planning
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : report ? (
        <div className="space-y-8">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="font-semibold text-white text-lg">{report.user.full_name || "—"}</p>
            <p className="text-sm text-zinc-500">{report.user.email || report.user.id}</p>
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Earnings balance
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-300">
                {formatKes(report.summary.earnings_balance_kes)} KES
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Passed prompts
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {report.summary.passed_count}
                <span className="text-sm text-zinc-500 font-normal">
                  {" "}
                  / {report.summary.submissions_total}
                </span>
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Reward on passed
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-amber-200">
                {formatKes(report.summary.total_reward_on_passed_kes)} KES
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Credited to ledger
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {formatKes(report.summary.total_credited_kes)} KES
              </p>
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                Prompt attempts
              </h2>
              <label className="flex items-center gap-2 text-sm text-zinc-500">
                <span>Per page</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-white text-sm"
                >
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>
            {report.summary.submissions_total === 0 ? (
              <p className="text-zinc-500 py-10 text-center border border-dashed border-white/10 rounded-2xl">
                No prompt submissions yet.
              </p>
            ) : (
              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div ref={tableScrollRef} className="overflow-auto max-h-[560px]">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[24%]" />
                      <col className="w-[11%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[19%]" />
                      <col className="w-[10%]" />
                      <col className="w-[18%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
                      <tr className="border-b border-white/10 text-left text-zinc-500">
                        <th className="px-3 py-2.5 font-medium">Series / Prompt</th>
                        <th className="px-3 py-2.5 font-medium">Submitted</th>
                        <th className="px-3 py-2.5 font-medium">Reward</th>
                        <th className="px-3 py-2.5 font-medium">Grade</th>
                        <th className="px-3 py-2.5 font-medium">Grading</th>
                        <th className="px-3 py-2.5 font-medium">Credited</th>
                        <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AdminVirtualTableRows<AttemptRow>
                        items={report.attempts}
                        colSpan={7}
                        estimateRowHeight={88}
                        scrollRef={tableScrollRef}
                        getKey={(attempt) => attempt.submission_id}
                        getRowClassName={() => "border-b border-white/5"}
                        renderCells={(attempt) => {
                          const badge = gradeBadge(attempt.grade_status);
                          const BadgeIcon = badge.icon;
                          return (
                            <>
                              <td className="px-3 py-2.5 align-top">
                                <p
                                  className="font-medium text-white truncate"
                                  title={attempt.prompt_headline || undefined}
                                >
                                  {attempt.prompt_headline || "—"}
                                </p>
                                <p
                                  className="text-xs text-zinc-500 truncate"
                                  title={attempt.series_title || undefined}
                                >
                                  {attempt.series_title || "—"}
                                </p>
                                {attempt.grading_note ? (
                                  <p
                                    className="text-xs text-zinc-400 mt-1 line-clamp-1"
                                    title={attempt.grading_note}
                                  >
                                    Note: {attempt.grading_note}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 align-top whitespace-nowrap text-zinc-400 text-xs">
                                {formatShortDate(attempt.submitted_at)}
                              </td>
                              <td className="px-3 py-2.5 align-top tabular-nums text-xs">
                                {formatKes(attempt.reward_kes)}
                              </td>
                              <td className="px-3 py-2.5 align-top">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap",
                                    badge.className
                                  )}
                                >
                                  <BadgeIcon className="w-3 h-3 shrink-0" />
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 align-top text-xs">
                                {attempt.grader_name || attempt.grader_email ? (
                                  <>
                                    <p className="text-white truncate" title={attempt.grader_name || undefined}>
                                      {attempt.grader_name || "—"}
                                    </p>
                                    <p
                                      className="text-zinc-500 truncate"
                                      title={attempt.grader_email || undefined}
                                    >
                                      {attempt.grader_email}
                                    </p>
                                    <p className="text-zinc-500 mt-0.5">
                                      {formatShortDate(attempt.graded_at)}
                                    </p>
                                  </>
                                ) : (
                                  <span className="text-zinc-500">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 align-top tabular-nums text-xs">
                                {attempt.credited_kes != null ? formatKes(attempt.credited_kes) : "—"}
                              </td>
                              <td className="px-3 py-2.5 align-top text-right">
                                <button
                                  type="button"
                                  onClick={() => setReviewAttempt(attempt)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/15 border border-white/10 whitespace-nowrap"
                                >
                                  <Eye className="w-3.5 h-3.5 shrink-0" />
                                  Review
                                </button>
                              </td>
                            </>
                          );
                        }}
                      />
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <AdminPagination
              page={page}
              totalPages={totalPages}
              total={report.summary.submissions_total}
              loading={loading}
              onPageChange={setPage}
            />
          </section>
        </div>
      ) : null}

      {reviewAttempt && report ? (
        <PromptSubmissionReviewModal
          submission={toReviewSubmission(reviewAttempt, report.user)}
          gradingId={gradingId}
          onClose={() => setReviewAttempt(null)}
          onGrade={grade}
        />
      ) : null}
    </main>
  );
}
