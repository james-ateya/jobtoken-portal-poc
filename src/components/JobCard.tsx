import { Briefcase, Coins, Eye, Building2 } from "lucide-react";
import { cn } from "../lib/utils";
import type { PublicEmployerCompany } from "./CompanyProfileSeekerModal";

interface Job {
  id: string;
  title: string;
  description: string;
  job_type: string;
  token_cost: number;
  is_featured?: boolean;
  area_of_business?: string | null;
  employer?: PublicEmployerCompany | null;
}

interface JobCardProps {
  key?: string | number;
  job: Job;
  onApply: (jobId: string) => void | Promise<void>;
  onViewDetails?: (job: Job) => void;
  onViewCompany?: (job: Job) => void;
  isApplying?: boolean;
  isGuest?: boolean;
  hasApplied?: boolean;
  hideApply?: boolean;
}

export function JobCard({
  job,
  onApply,
  onViewDetails,
  onViewCompany,
  isApplying,
  isGuest,
  hasApplied,
  hideApply,
}: JobCardProps) {
  const employerLabel = job.employer?.company_name?.trim() || null;

  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-semibold text-white group-hover:text-emerald-400 transition-colors">
              {job.title}
            </h3>
            {job.is_featured && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Featured
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-zinc-400 text-sm">
            <span className="flex items-center gap-1">
              <Briefcase className="w-4 h-4" />
              {job.job_type}
            </span>
            {job.area_of_business ? (
              <span className="text-xs text-emerald-500/90" title="Profession sought for this role">
                {job.area_of_business}
              </span>
            ) : null}
          </div>
          {employerLabel ? (
            <p className="text-xs text-zinc-500 mt-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span className="text-zinc-400 truncate">{employerLabel}</span>
            </p>
          ) : onViewCompany ? (
            <p className="text-xs text-zinc-600 mt-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>Employer</span>
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20">
          <Coins className="w-4 h-4" />
          {job.token_cost} Tokens
        </div>
      </div>
      
      <div className={cn("relative", isGuest && "select-none")}>
        <p className={cn(
          "text-zinc-400 text-sm mb-6 leading-relaxed",
          isGuest ? "blur-[4px] opacity-50" : "line-clamp-3"
        )}>
          {job.description}
        </p>
        {isGuest && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-xs font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
              Locked Content
            </span>
          </div>
        )}
      </div>

      {!hideApply && (
        <div className="flex flex-col gap-2">
          {onViewCompany && (
            <button
              type="button"
              onClick={() => onViewCompany(job)}
              className="w-full py-2.5 rounded-xl font-medium border border-white/10 text-xs text-zinc-300 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4 text-emerald-500/90" />
              Company profile
            </button>
          )}
          {!isGuest && onViewDetails && (
            <button
              type="button"
              onClick={() => onViewDetails(job)}
              className="w-full py-3 rounded-xl font-medium border border-white/15 text-zinc-200 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View details
            </button>
          )}
          <button
            type="button"
            onClick={() => onApply(job.id)}
            disabled={isApplying || hasApplied}
            className={cn(
              "w-full py-3 rounded-xl font-medium transition-all duration-300",
              hasApplied
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5"
                : isApplying
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  : "bg-emerald-500 text-black hover:bg-emerald-400 active:scale-[0.98]"
            )}
          >
            {hasApplied
              ? "Applied"
              : isApplying
                ? "Applying..."
                : isGuest
                  ? "Sign in to Apply"
                  : "Apply now"}
          </button>
        </div>
      )}

      {hideApply && !isGuest && (
        <div className="flex flex-col gap-2">
          {onViewCompany && (
            <button
              type="button"
              onClick={() => onViewCompany(job)}
              className="w-full py-2.5 rounded-xl font-medium border border-white/10 text-xs text-zinc-300 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4 text-emerald-500/90" />
              Company profile
            </button>
          )}
          {onViewDetails && (
            <button
              type="button"
              onClick={() => onViewDetails(job)}
              className="w-full py-3 rounded-xl font-medium border border-white/15 text-zinc-200 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View details
            </button>
          )}
        </div>
      )}
    </div>
  );
}
