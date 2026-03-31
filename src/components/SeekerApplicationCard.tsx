import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  Briefcase,
  MessageSquareText,
  ExternalLink,
  Building2,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ApplicationThread } from "./ApplicationThread";
import {
  applicationStatusExplainer,
  applicationStatusLabel,
  applicationStatusTone,
} from "../lib/applicationStatus";

export type SeekerApplicationJob = {
  id: string;
  title: string;
  job_type: string | null;
  description: string | null;
  token_cost?: number | null;
  employer?: { full_name: string | null } | null;
};

export type SeekerApplicationRow = {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at?: string | null;
  job: SeekerApplicationJob | SeekerApplicationJob[] | null;
};

function normalizeJob(job: SeekerApplicationRow["job"]): SeekerApplicationJob | null {
  if (!job) return null;
  return Array.isArray(job) ? job[0] ?? null : job;
}

function seekerStatusVisual(status: string) {
  if (status === "rejected") {
    return { Icon: XCircle, box: "bg-red-500/15 text-red-400" };
  }
  if (status === "offer") {
    return { Icon: Sparkles, box: "bg-amber-500/15 text-amber-300" };
  }
  if (status === "shortlisted" || status === "qualified" || status === "interview") {
    return { Icon: CheckCircle, box: "bg-emerald-500/15 text-emerald-400" };
  }
  return { Icon: Clock, box: "bg-slate-500/15 text-slate-300" };
}

function seekerPillClass(status: string) {
  const tone = applicationStatusTone(status);
  if (tone === "negative") return "bg-red-500/10 text-red-400 border-red-500/25";
  if (tone === "positive") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
  if (status === "reviewing") return "bg-slate-500/10 text-slate-300 border-slate-500/25";
  return "bg-amber-500/10 text-amber-300 border-amber-500/25";
}

export function SeekerApplicationCard({
  row,
  userId,
  compact,
}: {
  row: SeekerApplicationRow;
  userId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const job = normalizeJob(row.job);
  const status = row.status || "pending";
  const notes = (row.notes || "").trim();
  const updatedAt = row.updated_at ? new Date(row.updated_at) : null;
  const createdAt = new Date(row.created_at);
  const showUpdated =
    updatedAt && Math.abs(updatedAt.getTime() - createdAt.getTime()) > 60_000;
  const { Icon, box } = seekerStatusVisual(status);
  const showNoNoteHint =
    !notes && !["pending", "reviewing"].includes(status);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-5">
        <div className="flex gap-4 min-w-0">
          <div
            className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", box)}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-lg leading-tight truncate">
              {job?.title ?? "Job"}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-zinc-500">
              {job?.job_type ? (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {job.job_type}
                </span>
              ) : null}
              {job?.employer?.full_name ? (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {job.employer.full_name}
                </span>
              ) : null}
              <span>Applied {createdAt.toLocaleDateString()}</span>
              {showUpdated ? (
                <span className="text-zinc-600">Updated {updatedAt!.toLocaleString()}</span>
              ) : null}
            </div>
            {!compact && job?.description ? (
              <p className="text-sm text-zinc-400 mt-3 line-clamp-2">{job.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border",
              seekerPillClass(status)
            )}
          >
            {applicationStatusLabel(status)}
          </span>
          {job?.id ? (
            <Link
              to="/"
              state={{ highlightJobId: job.id }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              View listing
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="px-5 pb-5 space-y-4">
        <p className="text-sm text-zinc-500 leading-relaxed border-l-2 border-white/10 pl-3">
          {applicationStatusExplainer(status)}
        </p>

        {notes ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/90 mb-2 flex items-center gap-2">
              <MessageSquareText className="w-4 h-4" />
              From the employer
            </p>
            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{notes}</p>
          </div>
        ) : showNoNoteHint ? (
          <p className="text-xs text-zinc-600 italic">
            No additional note was left. You can still use the message thread below.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 py-3 px-4 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-zinc-300 hover:bg-white/[0.07] transition-colors"
        >
          <span>Messages with employer</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {open ? (
          <div className="pt-1">
            <ApplicationThread applicationId={row.id} currentUserId={userId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
