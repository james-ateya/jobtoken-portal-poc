import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Briefcase, Coins, Calendar, Sparkles, Building2 } from "lucide-react";
import { cn } from "../lib/utils";
import type { PublicEmployerCompany } from "./CompanyProfileSeekerModal";

export type JobDetail = {
  id: string;
  title: string;
  description: string;
  job_type: string;
  token_cost: number;
  is_featured?: boolean;
  created_at?: string;
  closes_at?: string | null;
  area_of_business?: string | null;
  employer?: PublicEmployerCompany | null;
};

type JobDetailModalProps = {
  job: JobDetail | null;
  onClose: () => void;
  onApply: (jobId: string) => void | Promise<void>;
  isApplying?: boolean;
  hasApplied?: boolean;
  hideApply?: boolean;
  onViewCompany?: () => void;
};

export function JobDetailModal({
  job,
  onClose,
  onApply,
  isApplying,
  hasApplied,
  hideApply,
  onViewCompany,
}: JobDetailModalProps) {
  const listingClosed =
    job?.closes_at != null && job.closes_at !== "" && new Date(job.closes_at) <= new Date();

  useEffect(() => {
    if (!job) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [job, onClose]);

  return (
    <AnimatePresence>
      {job && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-detail-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="overflow-y-auto max-h-[85vh] p-6 pt-14">
              <div className="flex flex-wrap items-start gap-2 mb-3">
                {job.is_featured && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Sparkles className="w-3 h-3" />
                    Featured
                  </span>
                )}
              </div>
              <h2
                id="job-detail-title"
                className="text-2xl font-bold text-white pr-10 leading-tight"
              >
                {job.title}
              </h2>

              <div className="flex flex-wrap gap-4 mt-4 text-sm text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  {job.job_type}
                </span>
                {job.area_of_business ? (
                  <span
                    className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0 text-emerald-400/90 text-sm"
                    title="Profession or field the employer is hiring for in this role"
                  >
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                      Profession
                    </span>
                    <span>{job.area_of_business}</span>
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  <Coins className="w-3.5 h-3.5" />
                  {job.token_cost} tokens to apply
                </span>
                {job.created_at && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-zinc-500" />
                    Posted {new Date(job.created_at).toLocaleDateString()}
                  </span>
                )}
                {job.closes_at && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs",
                      listingClosed ? "text-red-400" : "text-zinc-400"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    {listingClosed
                      ? "Listing closed"
                      : `Accepting applications until ${new Date(job.closes_at).toLocaleString()}`}
                  </span>
                )}
              </div>

              {onViewCompany ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                        Employer
                      </p>
                      <p className="text-sm font-semibold text-white truncate">
                        {job.employer?.company_name?.trim() || "Company profile"}
                      </p>
                      {job.employer?.office_location?.trim() ? (
                        <p className="text-xs text-zinc-500 mt-1 truncate">
                          {job.employer.office_location}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={onViewCompany}
                      className="inline-flex items-center justify-center gap-2 shrink-0 px-4 py-2.5 rounded-xl border border-emerald-500/35 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Building2 className="w-4 h-4" />
                      Company profile
                    </button>
                  </div>
                </div>
              ) : null}

              {listingClosed && (
                <p className="mt-4 text-sm text-red-400/90 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  This job is no longer accepting applications.
                </p>
              )}

              <div className="mt-6 border-t border-white/10 pt-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">
                  Full description
                </h3>
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {job.description}
                </p>
              </div>

              {!hideApply && (
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => onApply(job.id)}
                    disabled={isApplying || hasApplied || listingClosed}
                    className={cn(
                      "flex-1 py-3.5 rounded-xl font-bold transition-all",
                      hasApplied
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5"
                        : listingClosed
                          ? "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5"
                          : isApplying
                            ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                            : "bg-emerald-500 text-black hover:bg-emerald-400 active:scale-[0.98]"
                    )}
                  >
                    {hasApplied
                      ? "Applied"
                      : listingClosed
                        ? "Closed to applications"
                        : isApplying
                          ? "Applying…"
                          : "Apply now"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3.5 px-6 rounded-xl font-medium border border-white/15 text-zinc-300 hover:bg-white/5 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
              {hideApply && (
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-8 w-full py-3.5 rounded-xl font-medium border border-white/15 text-zinc-300 hover:bg-white/5 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
