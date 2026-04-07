import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { LayoutDashboard, PenLine } from "lucide-react";
import { PromptSeriesCards } from "../components/PromptSeriesCards";

export function PromptSeriesBrowsePage({
  user: _user,
  showToast: _showToast,
}: {
  user: any;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
              <PenLine className="w-8 h-8 text-emerald-400" />
              Prompt tasks
            </h1>
            <p className="text-zinc-500 mt-1 text-sm sm:text-base max-w-xl">
              Complete short written tasks. Each submission costs tokens; if your answer passes review,
              you earn KES credited to your earnings balance.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm font-medium transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 sm:p-8 rounded-3xl border border-white/10 bg-white/[0.02]"
        >
          <PromptSeriesCards compact={false} />
        </motion.div>
      </div>
    </div>
  );
}
