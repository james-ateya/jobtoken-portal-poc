/** Fixed retail price used for seeker-facing cost display (KES per token). */
export const PROMPT_KES_PER_TOKEN = 20;

export type PromptTierId = "starter" | "core" | "premium";

export type PromptTier = {
  id: PromptTierId;
  label: string;
  /** Short line for students */
  hint: string;
  /** Tailwind classes for badge */
  className: string;
};

/** Token thresholds aimed at university students (KES 20 / token). */
export const STARTER_MAX_TOKENS = 6; // ≤ KSh 120 attempt cost
export const CORE_MAX_TOKENS = 20; // ≤ KSh 400 attempt cost

/** Tier economics: thinner margin on Starter so students see real value on pass. */
export type TierEconomics = {
  id: PromptTierId;
  margin: number;
  targetPassRate: number;
};

export const TIER_ECONOMICS: Record<PromptTierId, TierEconomics> = {
  starter: { id: "starter", margin: 0.2, targetPassRate: 0.45 },
  core: { id: "core", margin: 0.3, targetPassRate: 0.5 },
  premium: { id: "premium", margin: 0.4, targetPassRate: 0.5 },
};

export function getPromptTierId(submitCostTokens: number): PromptTierId {
  const cost = Number(submitCostTokens) || 0;
  if (cost <= STARTER_MAX_TOKENS) return "starter";
  if (cost <= CORE_MAX_TOKENS) return "core";
  return "premium";
}

export function getTierEconomics(submitCostTokens: number): TierEconomics {
  return TIER_ECONOMICS[getPromptTierId(submitCostTokens)];
}

/** R_max = (C * KES_PER_TOKEN * (1 - M_tier)) / P_tier */
export function getMaxRewardKesForTokens(
  submitCostTokens: number,
  kesPerToken = PROMPT_KES_PER_TOKEN
): number {
  const C = Math.max(0, Number(submitCostTokens) || 0);
  const { margin, targetPassRate } = getTierEconomics(C);
  return (C * kesPerToken * (1 - margin)) / targetPassRate;
}

export function getPromptTier(submitCostTokens: number): PromptTier {
  const id = getPromptTierId(submitCostTokens);
  if (id === "starter") {
    return {
      id: "starter",
      label: "Starter",
      hint: "Low token cost — good first try",
      className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    };
  }
  if (id === "core") {
    return {
      id: "core",
      label: "Core",
      hint: "Everyday tasks — main earner path",
      className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    };
  }
  return {
    id: "premium",
    label: "Premium",
    hint: "Higher tokens for a larger reward",
    className: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  };
}

export function attemptCostKes(submitCostTokens: number, kesPerToken = PROMPT_KES_PER_TOKEN): number {
  return Math.max(0, Math.round(Number(submitCostTokens) || 0) * kesPerToken);
}

export function formatPromptKes(n: number | string): string {
  const v = typeof n === "string" ? parseFloat(n) : Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("en-KE", { maximumFractionDigits: 0 });
}

export const PROMPT_TIER_ORDER: PromptTierId[] = ["starter", "core", "premium"];

export const PROMPT_TIER_BATCH_SIZE = 10;

const TIER_SORT: Record<PromptTierId, number> = {
  starter: 0,
  core: 1,
  premium: 2,
};

/** Prefer lower-cost (student-friendly) prompts first. */
export function compareByStudentFriendlyTier(
  a: { submit_cost_tokens: number },
  b: { submit_cost_tokens: number }
): number {
  const ta = getPromptTier(a.submit_cost_tokens).id;
  const tb = getPromptTier(b.submit_cost_tokens).id;
  if (TIER_SORT[ta] !== TIER_SORT[tb]) return TIER_SORT[ta] - TIER_SORT[tb];
  return (Number(a.submit_cost_tokens) || 0) - (Number(b.submit_cost_tokens) || 0);
}

export function seriesEntryTier(minTokens: number): PromptTier {
  return getPromptTier(minTokens);
}

/**
 * "All" ordering: mix tiers in batches of `batchSize`, starting with Starter → Core → Premium,
 * then the next batch of each, and so on.
 */
export function batchMixByTier<T extends { submit_cost_tokens: number }>(
  items: T[],
  batchSize = PROMPT_TIER_BATCH_SIZE
): T[] {
  const buckets: Record<PromptTierId, T[]> = {
    starter: [],
    core: [],
    premium: [],
  };
  for (const item of [...items].sort(compareByStudentFriendlyTier)) {
    buckets[getPromptTier(item.submit_cost_tokens).id].push(item);
  }

  const out: T[] = [];
  let offset = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const tier of PROMPT_TIER_ORDER) {
      const slice = buckets[tier].slice(offset, offset + batchSize);
      if (slice.length > 0) {
        out.push(...slice);
        progressed = true;
      }
    }
    offset += batchSize;
  }
  return out;
}

/** Filter to one tier (sorted low→high cost), or batch-mix when filter is `all`. */
export function filterAndOrderByTier<T extends { submit_cost_tokens: number }>(
  items: T[],
  filter: "all" | PromptTierId,
  batchSize = PROMPT_TIER_BATCH_SIZE
): T[] {
  if (filter === "all") return batchMixByTier(items, batchSize);
  return items
    .filter((p) => getPromptTier(p.submit_cost_tokens).id === filter)
    .sort(compareByStudentFriendlyTier);
}
