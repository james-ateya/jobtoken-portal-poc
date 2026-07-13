import type { SupabaseClient } from "@supabase/supabase-js";
import { getEarningsBalanceKes } from "./earnings-balances.js";
import { getKesPerToken } from "./mpesa.js";
import { getWalletTokenExpiresAt, walletExpiryFields } from "./wallet-token-expiry.js";
import { notifyTokenWalletCredited } from "./token-wallet-email.js";
import { tryReactivateAccountOnTokenCredit } from "./reactivate-on-token-credit.js";

export type EarningsTokenExchangeResult = {
  amountKesDebited: number;
  tokensCredited: number;
  recipientUserId: string;
  recipientEmail: string | null;
  newEarningsBalanceKes: number;
  newTokenBalance: number;
};

function roundKes(value: number): number {
  return Math.round(value * 100) / 100;
}

export function tokensForKesAmount(amountKes: number): {
  tokens: number;
  kesDebited: number;
} {
  const kesPerToken = getKesPerToken();
  const tokens = Math.floor(amountKes / kesPerToken);
  return {
    tokens,
    kesDebited: roundKes(tokens * kesPerToken),
  };
}

export async function exchangeEarningsForTokens(params: {
  supabaseAdmin: SupabaseClient;
  payerUserId: string;
  amountKes: number;
  recipientUserId: string;
  recipientEmail?: string | null;
  giftedByEmail?: string | null;
}): Promise<EarningsTokenExchangeResult> {
  const { supabaseAdmin, payerUserId, recipientUserId, recipientEmail, giftedByEmail } = params;
  const amountKes = roundKes(params.amountKes);

  if (!Number.isFinite(amountKes) || amountKes <= 0) {
    throw new Error("Positive amountKes required");
  }

  const { tokens, kesDebited } = tokensForKesAmount(amountKes);
  if (tokens < 1) {
    const kesPerToken = getKesPerToken();
    throw new Error(`Minimum redemption is ${kesPerToken} KES (1 token)`);
  }

  const balance = await getEarningsBalanceKes(supabaseAdmin, payerUserId);
  if (kesDebited > balance + 1e-9) {
    throw new Error(`Amount exceeds available earnings balance (${balance.toFixed(2)} KES)`);
  }

  const { data: recipientWallet, error: walletErr } = await supabaseAdmin
    .from("wallets")
    .select("id, token_balance")
    .eq("user_id", recipientUserId)
    .maybeSingle();

  let wallet = recipientWallet;
  if (!wallet) {
    const { data: created, error: createErr } = await supabaseAdmin
      .from("wallets")
      .insert({ user_id: recipientUserId, token_balance: 0 })
      .select("id, token_balance")
      .single();
    if (createErr) throw createErr;
    wallet = created;
  } else if (walletErr) {
    throw walletErr;
  }

  if (!wallet) throw new Error("Recipient wallet could not be initialized");

  const isGift = recipientUserId !== payerUserId;
  const ledgerMetadata = isGift
    ? {
        gifted_to_user_id: recipientUserId,
        gifted_to_email: recipientEmail ?? null,
        gifted_by_user_id: payerUserId,
        gifted_by_email: giftedByEmail ?? null,
        tokens_credited: tokens,
      }
    : {
        tokens_credited: tokens,
      };

  const { error: ledgerErr } = await supabaseAdmin.from("earnings_ledger").insert({
    user_id: payerUserId,
    amount_kes: -kesDebited,
    entry_type: "token_redemption",
    reference_type: isGift ? "token_gift" : "self_redemption",
    metadata: ledgerMetadata,
  });
  if (ledgerErr) throw ledgerErr;

  const expiresAt = getWalletTokenExpiresAt();
  const newTokenBalance = Number(wallet.token_balance || 0) + tokens;

  const { error: walletUpdateErr } = await supabaseAdmin
    .from("wallets")
    .update({
      token_balance: newTokenBalance,
      ...walletExpiryFields(expiresAt),
    })
    .eq("id", wallet.id);
  if (walletUpdateErr) throw walletUpdateErr;

  const txType = isGift ? "token_gift" : "earnings_token_redemption";
  const referenceId = isGift
    ? `GIFT-${recipientUserId.slice(0, 8)}-${Date.now()}`
    : `REDEEM-${payerUserId.slice(0, 8)}-${Date.now()}`;

  const { error: txErr } = await supabaseAdmin.from("transactions").insert({
    wallet_id: wallet.id,
    tokens_added: tokens,
    type: txType,
    reference_id: referenceId,
    amount_kes: kesDebited,
    status: "completed",
    gift_recipient_user_id: isGift ? recipientUserId : null,
  });
  if (txErr) throw txErr;

  const newEarningsBalanceKes = await getEarningsBalanceKes(supabaseAdmin, payerUserId);

  try {
    const reactivated = await tryReactivateAccountOnTokenCredit(
      supabaseAdmin,
      recipientUserId,
      tokens
    );
    await notifyTokenWalletCredited(supabaseAdmin, {
      recipientUserId,
      tokensAdded: tokens,
      newBalance: newTokenBalance,
      expiresAt: expiresAt.toISOString(),
      amountKes: kesDebited,
      isGiftReceived: isGift,
      giftedByUserId: isGift ? payerUserId : null,
      purchaseSource: "earnings",
      accountReactivated: reactivated,
    });
  } catch (mailErr) {
    console.error("Earnings token credit email:", mailErr);
  }

  return {
    amountKesDebited: kesDebited,
    tokensCredited: tokens,
    recipientUserId,
    recipientEmail: recipientEmail ?? null,
    newEarningsBalanceKes,
    newTokenBalance,
  };
}
