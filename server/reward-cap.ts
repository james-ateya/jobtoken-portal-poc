import { getKesPerToken } from "./mpesa.js";

const STARTER_MAX_TOKENS = 6;
const CORE_MAX_TOKENS = 20;

/** Premium defaults (env can override Premium only). */
const DEFAULT_PREMIUM_MARGIN = 0.4;
const DEFAULT_PREMIUM_PASS_RATE = 0.5;

type TierId = "starter" | "core" | "premium";

type TierEconomics = {
  id: TierId;
  margin: number;
  targetPassRate: number;
};

function getPremiumMargin(): number {
  const n = parseFloat(process.env.PLATFORM_MARGIN || String(DEFAULT_PREMIUM_MARGIN));
  return Number.isFinite(n) && n > 0 && n < 1 ? n : DEFAULT_PREMIUM_MARGIN;
}

function getPremiumPassRate(): number {
  const n = parseFloat(process.env.TARGET_PASS_RATE || String(DEFAULT_PREMIUM_PASS_RATE));
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_PREMIUM_PASS_RATE;
}

export function getPromptTierId(submitCostTokens: number): TierId {
  const cost = Number(submitCostTokens) || 0;
  if (cost <= STARTER_MAX_TOKENS) return "starter";
  if (cost <= CORE_MAX_TOKENS) return "core";
  return "premium";
}

export function getTierEconomics(submitCostTokens: number): TierEconomics {
  const id = getPromptTierId(submitCostTokens);
  if (id === "starter") return { id, margin: 0.2, targetPassRate: 0.45 };
  if (id === "core") return { id, margin: 0.3, targetPassRate: 0.5 };
  return { id, margin: getPremiumMargin(), targetPassRate: getPremiumPassRate() };
}

/** @deprecated Prefer getTierEconomics — returns Premium margin for backwards compat. */
export function getPlatformMargin(): number {
  return getPremiumMargin();
}

/** @deprecated Prefer getTierEconomics — returns Premium pass rate for backwards compat. */
export function getTargetPassRate(): number {
  return getPremiumPassRate();
}

/** R_max = (C * KES_PER_TOKEN * (1 - M_tier)) / P_tier */
export function getMaxRewardKes(submitCostTokens: number): number {
  const C = Math.max(0, Number(submitCostTokens) || 0);
  const T = getKesPerToken();
  const { margin, targetPassRate } = getTierEconomics(C);
  return (C * T * (1 - margin)) / targetPassRate;
}

/** Min tokens for a reward using the tier that cost would fall into after rounding up. */
export function getMinSubmitCostTokens(rewardKes: number): number {
  const R = Number(rewardKes) || 0;
  if (R <= 0) return 1;
  const T = getKesPerToken();
  // Search upward until reward is safe under tiered cap.
  for (let c = 1; c <= 500; c++) {
    if (R <= getMaxRewardKes(c)) return c;
  }
  const { margin, targetPassRate } = getTierEconomics(500);
  return Math.ceil((R * targetPassRate) / (T * (1 - margin)));
}

export function isRewardSafe(rewardKes: number, submitCostTokens: number): boolean {
  if (rewardKes <= 0) return true;
  return rewardKes <= getMaxRewardKes(submitCostTokens);
}

export function getRewardCapConfig() {
  return {
    kes_per_token: getKesPerToken(),
    tiers: {
      starter: { max_tokens: STARTER_MAX_TOKENS, margin: 0.2, target_pass_rate: 0.45 },
      core: { max_tokens: CORE_MAX_TOKENS, margin: 0.3, target_pass_rate: 0.5 },
      premium: {
        max_tokens: null as null,
        margin: getPremiumMargin(),
        target_pass_rate: getPremiumPassRate(),
      },
    },
    /** Premium defaults (legacy fields for older clients). */
    margin: getPremiumMargin(),
    target_pass_rate: getPremiumPassRate(),
  };
}
