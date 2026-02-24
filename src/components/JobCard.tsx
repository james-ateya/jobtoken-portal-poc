import { Briefcase, MapPin, Coins } from "lucide-react";
import { cn } from "../lib/utils";

interface Job {
  id: string;
  title: string;
  description: string;
  job_type: string;
  token_cost: number;
}

interface JobCardProps {
  key?: string | number;
  job: Job;
  onApply: (jobId: string) => void | Promise<void>;
  isApplying?: boolean;
  isGuest?: boolean;
  hasApplied?: boolean;
  hideApply?: boolean;
}

export function JobCard({ job, onApply, isApplying, isGuest, hasApplied, hideApply }: JobCardProps) {
  return (
    <div className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-all group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-white group-hover:text-emerald-400 transition-colors">
            {job.title}
          </h3>
          <div className="flex items-center gap-3 mt-2 text-zinc-400 text-sm">
            <span className="flex items-center gap-1">
              <Briefcase className="w-4 h-4" />
              {job.job_type}
            </span>
          </div>
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
        <button
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
          {hasApplied ? "Applied" : isApplying ? "Applying..." : isGuest ? "Sign in to Apply" : "Apply Now"}
        </button>
      )}
    </div>
  );
}
