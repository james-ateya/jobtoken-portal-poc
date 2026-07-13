import type { SupabaseClient } from "@supabase/supabase-js";
import type { StkCallbackParsed } from "./mpesa.js";
import { resolveTokensForTopupKes } from "./mpesa.js";
import { fulfillCouponBonus, getCouponSettings } from "./coupon.js";
import { getWalletTokenExpiresAt, walletExpiryFields } from "./wallet-token-expiry.js";
import { notifyTokenWalletCredited } from "./token-wallet-email.js";
import { tryReactivateAccountOnTokenCredit } from "./reactivate-on-token-credit.js";

export type StkProcessResult =
  | { outcome: "ignored" }
  | { outcome: "failed_callback" }
  | { outcome: "unknown_checkout" }
  | { outcome: "already_completed" }
  | { outcome: "duplicate_receipt" }
  | { outcome: "amount_too_small"; paidKes: number }
  | { outcome: "credited"; tokens: number; newBalance: number; couponBonusTokens?: number }
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
    .select("id, wallet_id, amount_kes, status, mpesa_receipt_number, gift_recipient_user_id")
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

  const creditUserId = tx.gift_recipient_user_id as string | null;
  let targetWalletId = tx.wallet_id as string;
  let targetWalletBalance = 0;

  if (creditUserId) {
    const { data: existingRecipientWallet, error: recipientWalletErr } = await supabaseAdmin
      .from("wallets")
      .select("id, token_balance")
      .eq("user_id", creditUserId)
      .maybeSingle();

    if (recipientWalletErr) {
      return { outcome: "error", message: recipientWalletErr.message };
    }

    let recipientWallet = existingRecipientWallet;
    if (!recipientWallet) {
      const { data: createdWallet, error: createWalletErr } = await supabaseAdmin
        .from("wallets")
        .insert({ user_id: creditUserId, token_balance: 0 })
        .select("id, token_balance")
        .single();
      if (createWalletErr) {
        return { outcome: "error", message: createWalletErr.message };
      }
      recipientWallet = createdWallet;
    }

    if (!recipientWallet) {
      return { outcome: "error", message: "Recipient wallet missing" };
    }

    targetWalletId = recipientWallet.id;
    targetWalletBalance = Number(recipientWallet.token_balance) || 0;
  } else {
    const { data: wallet, error: wErr } = await supabaseAdmin
      .from("wallets")
      .select("id, token_balance")
      .eq("id", tx.wallet_id)
      .single();

    if (wErr || !wallet) {
      return { outcome: "error", message: wErr?.message || "Wallet missing" };
    }

    targetWalletId = wallet.id;
    targetWalletBalance = Number(wallet.token_balance) || 0;
  }

  const expiresAt = getWalletTokenExpiresAt();
  const newBalance = targetWalletBalance + tokensToCredit;

  const { error: upWallet } = await supabaseAdmin
    .from("wallets")
    .update({
      token_balance: newBalance,
      ...walletExpiryFields(expiresAt),
    })
    .eq("id", targetWalletId);

  if (upWallet) {
    return { outcome: "error", message: upWallet.message };
  }

  const completedType = creditUserId ? "token_gift" : "topup";
  const { error: upTx } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "completed",
      tokens_added: tokensToCredit,
      amount_kes: paidKes,
      mpesa_receipt_number: parsed.mpesaReceiptNumber,
      reference_id: parsed.mpesaReceiptNumber || `MPESA-${tx.id}`,
      type: completedType,
    })
    .eq("id", tx.id);

  if (upTx) {
    return { outcome: "error", message: upTx.message };
  }

  let couponBonusTokens: number | undefined;
  if (!creditUserId) {
    try {
      const { data: walletRow } = await supabaseAdmin
        .from("wallets")
        .select("user_id")
        .eq("id", targetWalletId)
        .single();

      if (walletRow?.user_id) {
        const settings = await getCouponSettings(supabaseAdmin);
        if (paidKes >= settings.minTopupKes) {
          const bonus = await fulfillCouponBonus(supabaseAdmin, walletRow.user_id, targetWalletId);
          if (bonus) {
            couponBonusTokens = bonus.tokensAwarded;
          }
        }
      }
    } catch (couponErr) {
      console.error("STK callback coupon bonus:", couponErr);
    }
  }

  try {
    const { data: targetWallet } = await supabaseAdmin
      .from("wallets")
      .select("user_id")
      .eq("id", targetWalletId)
      .maybeSingle();

    let giftedByUserId: string | null = null;
    if (creditUserId) {
      const { data: payerWallet } = await supabaseAdmin
        .from("wallets")
        .select("user_id")
        .eq("id", tx.wallet_id)
        .maybeSingle();
      giftedByUserId = payerWallet?.user_id ?? null;
    }

    const recipientUserId = creditUserId ?? targetWallet?.user_id;
    if (recipientUserId) {
      const reactivated = await tryReactivateAccountOnTokenCredit(
        supabaseAdmin,
        recipientUserId,
        tokensToCredit
      );
      await notifyTokenWalletCredited(supabaseAdmin, {
        recipientUserId,
        tokensAdded: tokensToCredit,
        newBalance,
        expiresAt: expiresAt.toISOString(),
        amountKes: paidKes,
        isGiftReceived: Boolean(creditUserId),
        giftedByUserId,
        purchaseSource: "mpesa",
        accountReactivated: reactivated,
      });
    }
  } catch (mailErr) {
    console.error("Token purchase email:", mailErr);
  }

  return { outcome: "credited", tokens: tokensToCredit, newBalance, couponBonusTokens };
}
