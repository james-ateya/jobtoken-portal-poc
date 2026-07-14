import { getKesPerToken } from "./mpesa.js";

const DEFAULT_MARGIN = 0.40;
const DEFAULT_PASS_RATE = 0.50;

export function getPlatformMargin(): number {
  const n = parseFloat(process.env.PLATFORM_MARGIN || String(DEFAULT_MARGIN));
  return Number.isFinite(n) && n > 0 && n < 1 ? n : DEFAULT_MARGIN;
}

export function getTargetPassRate(): number {
  const n = parseFloat(process.env.TARGET_PASS_RATE || String(DEFAULT_PASS_RATE));
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : DEFAULT_PASS_RATE;
}

/** R_max = (C * KES_PER_TOKEN * (1 - M)) / P */
export function getMaxRewardKes(submitCostTokens: number): number {
  const T = getKesPerToken();
  const M = getPlatformMargin();
  const P = getTargetPassRate();
  return (submitCostTokens * T * (1 - M)) / P;
}

/** C_min = ceil((R * P) / (KES_PER_TOKEN * (1 - M))) */
export function getMinSubmitCostTokens(rewardKes: number): number {
  const T = getKesPerToken();
  const M = getPlatformMargin();
  const P = getTargetPassRate();
  return Math.ceil((rewardKes * P) / (T * (1 - M)));
}

export function isRewardSafe(rewardKes: number, submitCostTokens: number): boolean {
  if (rewardKes <= 0) return true;
  return rewardKes <= getMaxRewardKes(submitCostTokens);
}

export function getRewardCapConfig() {
  return {
    kes_per_token: getKesPerToken(),
    margin: getPlatformMargin(),
    target_pass_rate: getTargetPassRate(),
  };
}
