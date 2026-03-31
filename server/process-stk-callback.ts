import type { SupabaseClient } from "@supabase/supabase-js";
import type { StkCallbackParsed } from "./mpesa.js";
import { resolveTokensForTopupKes } from "./mpesa.js";

export type StkProcessResult =
  | { outcome: "ignored" }
  | { outcome: "failed_callback" }
  | { outcome: "unknown_checkout" }
  | { outcome: "already_completed" }
  | { outcome: "duplicate_receipt" }
  | { outcome: "amount_too_small"; paidKes: number }
  | { outcome: "credited"; tokens: number; newBalance: number }
  | { outcome: "error"; message: string };

/**
 * Shared logic for Safaricom STK callback and local simulation.
 * Always safe to call; duplicates and unknown IDs are handled.
 */
export async function processStkCallback(
  supabaseAdmin: SupabaseClient,
  parsed: StkCallbackParsed
): Promise<StkProcessResult> {
  if (!parsed.checkoutRequestId) {
    return { outcome: "ignored" };
  }

  if (parsed.resultCode !== 0) {
    await supabaseAdmin
      .from("transactions")
      .update({ status: "failed" })
      .eq("checkout_request_id", parsed.checkoutRequestId)
      .eq("status", "pending");
    return { outcome: "failed_callback" };
  }

  const { data: txRows, error: txErr } = await supabaseAdmin
    .from("transactions")
    .select("id, wallet_id, amount_kes, status, mpesa_receipt_number")
    .eq("checkout_request_id", parsed.checkoutRequestId)
    .limit(1);

  if (txErr || !txRows?.length) {
    console.warn("STK callback: unknown checkout", parsed.checkoutRequestId);
    return { outcome: "unknown_checkout" };
  }

  const tx = txRows[0];
  if (tx.status === "completed") {
    return { outcome: "already_completed" };
  }

  if (parsed.mpesaReceiptNumber) {
    const { data: dup } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("mpesa_receipt_number", parsed.mpesaReceiptNumber)
      .limit(1);
    if (dup?.length) {
      return { outcome: "duplicate_receipt" };
    }
  }

  const paidKes = Math.round(parsed.amountKes ?? Number(tx.amount_kes));
  const tokensToCredit = resolveTokensForTopupKes(paidKes);
  if (tokensToCredit < 1) {
    console.error("STK callback: paid amount too small for tokens", paidKes);
    await supabaseAdmin
      .from("transactions")
      .update({ status: "failed", mpesa_receipt_number: parsed.mpesaReceiptNumber })
      .eq("id", tx.id);
    return { outcome: "amount_too_small", paidKes };
  }

  const { data: wallet, error: wErr } = await supabaseAdmin
    .from("wallets")
    .select("id, token_balance")
    .eq("id", tx.wallet_id)
    .single();

  if (wErr || !wallet) {
    return { outcome: "error", message: wErr?.message || "Wallet missing" };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const newBalance = wallet.token_balance + tokensToCredit;

  const { error: upWallet } = await supabaseAdmin
    .from("wallets")
    .update({
      token_balance: newBalance,
      expires_at: expiresAt.toISOString(),
    })
    .eq("id", wallet.id);

  if (upWallet) {
    return { outcome: "error", message: upWallet.message };
  }

  const { error: upTx } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "completed",
      tokens_added: tokensToCredit,
      amount_kes: paidKes,
      mpesa_receipt_number: parsed.mpesaReceiptNumber,
      reference_id: parsed.mpesaReceiptNumber || `MPESA-${tx.id}`,
    })
    .eq("id", tx.id);

  if (upTx) {
    return { outcome: "error", message: upTx.message };
  }

  return { outcome: "credited", tokens: tokensToCredit, newBalance };
}
