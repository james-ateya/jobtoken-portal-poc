import { cn } from "../lib/utils";
import { getPromptTier } from "../lib/promptTier";

export function PromptTierBadge({
  submitCostTokens,
  showHint = false,
  className,
}: {
  submitCostTokens: number;
  showHint?: boolean;
  className?: string;
}) {
  const tier = getPromptTier(submitCostTokens);
  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)}>
      <span
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border",
          tier.className
        )}
        title={tier.hint}
      >
        {tier.label}
      </span>
      {showHint ? <span className="text-[10px] text-zinc-500 font-normal normal-case tracking-normal">{tier.hint}</span> : null}
    </span>
  );
}
