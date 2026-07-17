import { Link } from "react-router-dom";
import { PenLine, Lock, ArrowRight } from "lucide-react";
import { PromptTieredBrowse } from "./PromptTieredBrowse";

export type HomePreviewPrompt = {
  id: string;
  headline: string;
  instructions: string;
  reward_kes: number | string;
  submit_cost_tokens: number;
  series_id: string;
  series_title: string | null;
};

export function HomePromptTeasers({ user }: { user: any | null }) {
  const isGuest = !user;

  return (
    <section className="mb-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-500 mb-1">
            <PenLine className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Prompt tasks</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Start small, earn daily</h2>
          <p className="text-zinc-500 text-sm mt-1 max-w-xl">
            {isGuest ? (
              <>
                Starter first, then Core, then Premium — in batches of 10. Token cost and KES reward
                stay visible; the full question blurs until you sign in.
              </>
            ) : (
              <>
                Use All for a mixed ladder (10 Starter → 10 Core → 10 Premium). Or jump straight to a
                tier with the filters above the list.
              </>
            )}
          </p>
        </div>
        {isGuest ? (
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-bold hover:bg-emerald-400 shrink-0"
          >
            <Lock className="w-4 h-4" />
            Sign in to read &amp; submit
          </Link>
        ) : (
          <Link
            to="/dashboard/prompts"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-sm font-bold text-emerald-400 hover:bg-white/5 shrink-0"
          >
            View all prompts
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <PromptTieredBrowse user={user} fullCatalog={false} />
    </section>
  );
}
