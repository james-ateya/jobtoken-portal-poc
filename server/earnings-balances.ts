import type { SupabaseClient } from "@supabase/supabase-js";

const EARNINGS_BALANCE_VIEW = "earnings_balances_by_user";

export function isEarningsBalanceViewMissing(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("earnings_balances_by_user") ||
    msg.includes("does not exist") ||
    msg.includes("could not find")
  );
}

function roundKes(value: number): number {
  return Math.round(value * 100) / 100;
}

async function sumLedgerBalanceFallback(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("earnings_ledger")
    .select("amount_kes")
    .eq("user_id", userId);
  if (error) throw error;
  return roundKes((data ?? []).reduce((acc, row) => acc + Number(row.amount_kes || 0), 0));
}

/** Load all non-zero earnings balances from the aggregated view (fallback: scan ledger). */
export async function loadEarningsBalancesMap(
  supabaseAdmin: SupabaseClient
): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  const { data, error } = await supabaseAdmin
    .from(EARNINGS_BALANCE_VIEW)
    .select("user_id, balance_kes");

  if (error && isEarningsBalanceViewMissing(error)) {
    console.warn(
      "earnings_balances_by_user view missing — apply migration 20250331000029_earnings_balances_view.sql"
    );
    const { data: ledgerRows, error: ledErr } = await supabaseAdmin
      .from("earnings_ledger")
      .select("user_id, amount_kes");
    if (ledErr) throw ledErr;
    for (const row of ledgerRows ?? []) {
      const uid = row.user_id as string;
      map.set(uid, roundKes((map.get(uid) ?? 0) + Number(row.amount_kes || 0)));
    }
    return map;
  }
  if (error) throw error;

  for (const row of data ?? []) {
    const balance = roundKes(Number(row.balance_kes || 0));
    if (balance !== 0) {
      map.set(row.user_id as string, balance);
    }
  }
  return map;
}

export async function getEarningsBalanceKes(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from(EARNINGS_BALANCE_VIEW)
    .select("balance_kes")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isEarningsBalanceViewMissing(error)) {
    return sumLedgerBalanceFallback(supabaseAdmin, userId);
  }
  if (error) throw error;
  if (!data) return 0;
  return roundKes(Number(data.balance_kes || 0));
}

export async function sumPassedPromptRewardsKes(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("sum_passed_prompt_rewards", {
    p_user_id: userId,
  });
  if (error) {
    if (isRpcMissing(error, "sum_passed_prompt_rewards")) {
      return sumPassedPromptRewardsFallback(supabaseAdmin, userId);
    }
    throw error;
  }
  return roundKes(Number(data || 0));
}

export async function sumPromptSubmissionCreditsKes(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("sum_prompt_submission_credits", {
    p_user_id: userId,
  });
  if (error) {
    if (isRpcMissing(error, "sum_prompt_submission_credits")) {
      return sumPromptCreditsFallback(supabaseAdmin, userId);
    }
    throw error;
  }
  return roundKes(Number(data || 0));
}

function isRpcMissing(
  error: { code?: string; message?: string },
  name: string
): boolean {
  const msg = String(error.message || "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    msg.includes(name.toLowerCase()) ||
    msg.includes("could not find the function")
  );
}

async function sumPassedPromptRewardsFallback(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data: subs, error: subErr } = await supabaseAdmin
    .from("prompt_submissions")
    .select("prompt_id")
    .eq("user_id", userId)
    .eq("grade_status", "pass");
  if (subErr) throw subErr;
  const promptIds = [...new Set((subs ?? []).map((s) => s.prompt_id))];
  if (promptIds.length === 0) return 0;

  const { data: prompts, error: pErr } = await supabaseAdmin
    .from("prompts")
    .select("reward_kes")
    .in("id", promptIds);
  if (pErr) throw pErr;
  return roundKes((prompts ?? []).reduce((sum, p) => sum + Number(p.reward_kes || 0), 0));
}

async function sumPromptCreditsFallback(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("earnings_ledger")
    .select("amount_kes")
    .eq("user_id", userId)
    .eq("reference_type", "prompt_submission");
  if (error) throw error;
  return roundKes((data ?? []).reduce((sum, row) => sum + Number(row.amount_kes || 0), 0));
}

export type WalletTransactionSummary = {
  total_topup_kes: number;
  application_tokens_spent: number;
  employer_fees_tokens: number;
};

export async function loadWalletTransactionSummary(
  supabaseAdmin: SupabaseClient,
  walletId: string
): Promise<WalletTransactionSummary> {
  const { data, error } = await supabaseAdmin.rpc("wallet_transaction_summary", {
    p_wallet_id: walletId,
  });

  if (error) {
    if (isRpcMissing(error, "wallet_transaction_summary")) {
      return loadWalletTransactionSummaryFallback(supabaseAdmin, walletId);
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    total_topup_kes: roundKes(Number(row?.total_topup_kes || 0)),
    application_tokens_spent: roundKes(Number(row?.application_tokens_spent || 0)),
    employer_fees_tokens: roundKes(Number(row?.employer_fees_tokens || 0)),
  };
}

async function loadWalletTransactionSummaryFallback(
  supabaseAdmin: SupabaseClient,
  walletId: string
): Promise<WalletTransactionSummary> {
  const { data: aggTx, error } = await supabaseAdmin
    .from("transactions")
    .select("tokens_added, type, amount_kes, status")
    .eq("wallet_id", walletId);
  if (error) throw error;

  let total_topup_kes = 0;
  let application_tokens_spent = 0;
  let employer_fees_tokens = 0;
  for (const t of aggTx ?? []) {
    if (t.type === "topup" && t.status === "completed") {
      total_topup_kes += Number(t.amount_kes ?? 0);
    }
    if (t.type === "application" && t.status === "completed") {
      application_tokens_spent += Math.abs(Number(t.tokens_added) || 0);
    }
    if (
      (t.type === "employer_fee" || t.type === "employer_feature_fee") &&
      t.status === "completed"
    ) {
      employer_fees_tokens += Math.abs(Number(t.tokens_added) || 0);
    }
  }
  return {
    total_topup_kes: roundKes(total_topup_kes),
    application_tokens_spent: roundKes(application_tokens_spent),
    employer_fees_tokens: roundKes(employer_fees_tokens),
  };
}
