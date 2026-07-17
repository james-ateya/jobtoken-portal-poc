import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "./mail.js";
import { getEarningsBalanceKes } from "./earnings-balances.js";
import { getMinimumWithdrawalKes } from "./withdrawal-window.js";
import {
  buildAfterFailHtml,
  buildNearWithdrawHtml,
  buildNoTopupHtml,
  buildWeeklyDigestHtml,
  type DigestPrompt,
} from "./engagement-email-html.js";
import {
  ensureUnsubToken,
  hasEngagementSend,
  isMarketingAllowed,
  markEngagementSent,
  nairobiIsoWeekKey,
  portalUrl,
  promptsUrl,
  stableShuffle,
  unsubscribeUrl,
  walletUrl,
  type EngagementProfile,
} from "./engagement-prefs.js";

export type EngagementRunResult = {
  checked: number;
  sent: number;
  skipped: number;
  errors: string[];
};

const PAGE = 200;

async function loadPromptTeasers(
  supabaseAdmin: SupabaseClient,
  seed: string,
  limit = 4
): Promise<DigestPrompt[]> {
  const { data: series, error: se } = await supabaseAdmin
    .from("prompt_series")
    .select("id, title")
    .eq("status", "published");
  if (se) throw se;
  const seriesRows = series ?? [];
  if (!seriesRows.length) return [];

  const titleById = new Map(seriesRows.map((s) => [s.id as string, s.title as string]));
  const seriesIds = seriesRows.map((s) => s.id as string);

  // Pull a manageable sample of published prompts (ordered), then shuffle by seed.
  const { data: prompts, error: pe } = await supabaseAdmin
    .from("prompts")
    .select("id, headline, submit_cost_tokens, reward_kes, series_id")
    .in("series_id", seriesIds.slice(0, 40))
    .eq("is_published", true)
    .order("submit_cost_tokens", { ascending: true })
    .limit(80);

  if (pe) throw pe;
  const list = (prompts ?? []).map((p) => ({
    headline: String(p.headline || "Prompt task"),
    submit_cost_tokens: Number(p.submit_cost_tokens) || 0,
    reward_kes: Number(p.reward_kes) || 0,
    series_title: titleById.get(p.series_id as string) ?? null,
  }));

  return stableShuffle(list, seed).slice(0, limit);
}

async function loadSeekerPage(
  supabaseAdmin: SupabaseClient,
  from: number,
  to: number
): Promise<EngagementProfile[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, full_name, marketing_emails_opted_out_at, marketing_unsub_token, is_active, role, created_at"
    )
    .eq("role", "seeker")
    .order("created_at", { ascending: true })
    .range(from, to);
  if (error) throw error;
  return (data ?? []) as EngagementProfile[];
}

async function userHasTopup(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  const { data: wallet } = await supabaseAdmin
    .from("wallets")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!wallet?.id) return false;

  const { count } = await supabaseAdmin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("wallet_id", wallet.id)
    .in("type", ["topup", "admin_grant"]);

  return (count ?? 0) > 0;
}

async function userHasSubmission(supabaseAdmin: SupabaseClient, userId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("prompt_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return (count ?? 0) > 0;
}

async function classifySegment(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<"A" | "B" | null> {
  const hasSub = await userHasSubmission(supabaseAdmin, userId);
  if (hasSub) {
    const bal = await getEarningsBalanceKes(supabaseAdmin, userId);
    const min = getMinimumWithdrawalKes();
    if (bal < min) return "B";
    return null; // already at/above withdraw threshold — skip digest
  }
  const topped = await userHasTopup(supabaseAdmin, userId);
  if (!topped) return "A";
  // Topped up but never submitted — treat like A (activation nudge)
  return "A";
}

function emptyResult(): EngagementRunResult {
  return { checked: 0, sent: 0, skipped: 0, errors: [] };
}

function daysBetween(iso: string, now = new Date()): number {
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.floor((now.getTime() - created) / 86_400_000);
}

/** Weekly Monday digest for segments A (never activated) and B (earning toward withdraw). */
export async function processWeeklyDigest(
  supabaseAdmin: SupabaseClient
): Promise<EngagementRunResult> {
  const result = emptyResult();
  const weekKey = nairobiIsoWeekKey();
  const teasers = await loadPromptTeasers(supabaseAdmin, `digest-${weekKey}`, 4);
  const minWithdraw = getMinimumWithdrawalKes();

  let from = 0;
  for (;;) {
    const page = await loadSeekerPage(supabaseAdmin, from, from + PAGE - 1);
    if (!page.length) break;

    for (const profile of page) {
      result.checked += 1;
      try {
        if (!(await isMarketingAllowed(supabaseAdmin, profile))) {
          result.skipped += 1;
          continue;
        }

        const segment = await classifySegment(supabaseAdmin, profile.id);
        if (!segment) {
          result.skipped += 1;
          continue;
        }

        if (await hasEngagementSend(supabaseAdmin, profile.id, "weekly_digest", weekKey)) {
          result.skipped += 1;
          continue;
        }

        const token = await ensureUnsubToken(supabaseAdmin, profile);
        const earnings =
          segment === "B" ? await getEarningsBalanceKes(supabaseAdmin, profile.id) : 0;
        const { subject, html } = buildWeeklyDigestHtml({
          fullName: profile.full_name || "there",
          segment,
          prompts: teasers,
          earningsKes: earnings,
          minWithdrawKes: minWithdraw,
          ctaUrl: segment === "A" ? walletUrl() : promptsUrl(),
          unsubscribeUrl: unsubscribeUrl(token),
          portalUrl: portalUrl(),
        });

        await sendMail({ to: profile.email, subject, html });
        await markEngagementSent(supabaseAdmin, profile.id, "weekly_digest", weekKey, { segment });
        result.sent += 1;
      } catch (err: any) {
        result.errors.push(`${profile.email}: ${err?.message || String(err)}`);
      }
    }

    if (page.length < PAGE) break;
    from += PAGE;
  }

  return result;
}

/** Day-3 / day-10 nudge for seekers who never topped up (segment A). */
export async function processNoTopupTriggers(
  supabaseAdmin: SupabaseClient
): Promise<EngagementRunResult> {
  const result = emptyResult();
  const teasers = await loadPromptTeasers(supabaseAdmin, `no-topup-${nairobiIsoWeekKey()}`, 3);

  let from = 0;
  for (;;) {
    const page = await loadSeekerPage(supabaseAdmin, from, from + PAGE - 1);
    if (!page.length) break;

    for (const profile of page) {
      result.checked += 1;
      try {
        if (!(await isMarketingAllowed(supabaseAdmin, profile))) {
          result.skipped += 1;
          continue;
        }

        const days = daysBetween(profile.created_at);
        let stage: "d3" | "d10" | null = null;
        if (days >= 10) stage = "d10";
        else if (days >= 3) stage = "d3";
        if (!stage) {
          result.skipped += 1;
          continue;
        }

        if (await userHasTopup(supabaseAdmin, profile.id)) {
          result.skipped += 1;
          continue;
        }
        if (await userHasSubmission(supabaseAdmin, profile.id)) {
          result.skipped += 1;
          continue;
        }

        if (await hasEngagementSend(supabaseAdmin, profile.id, "no_topup", stage)) {
          result.skipped += 1;
          continue;
        }

        const token = await ensureUnsubToken(supabaseAdmin, profile);
        const { subject, html } = buildNoTopupHtml({
          fullName: profile.full_name || "there",
          prompts: teasers,
          daysSinceSignup: days,
          ctaUrl: walletUrl(),
          unsubscribeUrl: unsubscribeUrl(token),
          portalUrl: portalUrl(),
        });
        await sendMail({ to: profile.email, subject, html });
        await markEngagementSent(supabaseAdmin, profile.id, "no_topup", stage, { days });
        result.sent += 1;
      } catch (err: any) {
        result.errors.push(`${profile.email}: ${err?.message || String(err)}`);
      }
    }

    if (page.length < PAGE) break;
    from += PAGE;
  }

  return result;
}

/** Seekers with earnings between 50% and 100% of min withdrawal — biweekly nudge. */
export async function processNearWithdrawTriggers(
  supabaseAdmin: SupabaseClient
): Promise<EngagementRunResult> {
  const result = emptyResult();
  const min = getMinimumWithdrawalKes();
  const threshold = min * 0.5;
  const weekKey = nairobiIsoWeekKey();
  // Biweekly dedupe: even/odd ISO week → same key for 2 weeks
  const weekNum = Number(weekKey.split("-W")[1] || "0");
  const biKey = `${weekKey.split("-W")[0]}-B${Math.floor(weekNum / 2)}`;
  const teasers = await loadPromptTeasers(supabaseAdmin, `near-${biKey}`, 3);

  let from = 0;
  for (;;) {
    const page = await loadSeekerPage(supabaseAdmin, from, from + PAGE - 1);
    if (!page.length) break;

    for (const profile of page) {
      result.checked += 1;
      try {
        if (!(await isMarketingAllowed(supabaseAdmin, profile))) {
          result.skipped += 1;
          continue;
        }
        if (!(await userHasSubmission(supabaseAdmin, profile.id))) {
          result.skipped += 1;
          continue;
        }

        const bal = await getEarningsBalanceKes(supabaseAdmin, profile.id);
        if (bal < threshold || bal >= min) {
          result.skipped += 1;
          continue;
        }

        if (await hasEngagementSend(supabaseAdmin, profile.id, "near_withdraw", biKey)) {
          result.skipped += 1;
          continue;
        }

        const token = await ensureUnsubToken(supabaseAdmin, profile);
        const { subject, html } = buildNearWithdrawHtml({
          fullName: profile.full_name || "there",
          earningsKes: bal,
          minWithdrawKes: min,
          prompts: teasers,
          ctaUrl: promptsUrl(),
          unsubscribeUrl: unsubscribeUrl(token),
          portalUrl: portalUrl(),
        });
        await sendMail({ to: profile.email, subject, html });
        await markEngagementSent(supabaseAdmin, profile.id, "near_withdraw", biKey, {
          balance: bal,
          min,
        });
        result.sent += 1;
      } catch (err: any) {
        result.errors.push(`${profile.email}: ${err?.message || String(err)}`);
      }
    }

    if (page.length < PAGE) break;
    from += PAGE;
  }

  return result;
}

/**
 * Next-day nudge after a failed grade (looks for fails graded ~20–48h ago).
 * Also callable immediately via processAfterFailForSubmission.
 */
export async function processAfterFailTriggers(
  supabaseAdmin: SupabaseClient
): Promise<EngagementRunResult> {
  const result = emptyResult();
  const now = Date.now();
  const fromIso = new Date(now - 48 * 3600_000).toISOString();
  const toIso = new Date(now - 20 * 3600_000).toISOString();

  const { data: fails, error } = await supabaseAdmin
    .from("prompt_submissions")
    .select("id, user_id, prompt_id, graded_at")
    .eq("grade_status", "fail")
    .gte("graded_at", fromIso)
    .lte("graded_at", toIso)
    .order("graded_at", { ascending: true })
    .limit(300);

  if (error) throw error;

  const teasers = await loadPromptTeasers(supabaseAdmin, `fail-${nairobiIsoWeekKey()}`, 3);

  for (const row of fails ?? []) {
    result.checked += 1;
    const userId = row.user_id as string;
    const submissionId = row.id as string;
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select(
          "id, email, full_name, marketing_emails_opted_out_at, marketing_unsub_token, is_active, role, created_at"
        )
        .eq("id", userId)
        .maybeSingle();

      if (!profile || !(await isMarketingAllowed(supabaseAdmin, profile as EngagementProfile))) {
        result.skipped += 1;
        continue;
      }

      if (await hasEngagementSend(supabaseAdmin, userId, "after_fail", submissionId)) {
        result.skipped += 1;
        continue;
      }

      const { data: prompt } = await supabaseAdmin
        .from("prompts")
        .select("headline")
        .eq("id", row.prompt_id)
        .maybeSingle();

      const token = await ensureUnsubToken(supabaseAdmin, profile as EngagementProfile);
      const { subject, html } = buildAfterFailHtml({
        fullName: (profile as EngagementProfile).full_name || "there",
        promptHeadline: prompt?.headline || "your last prompt",
        prompts: teasers,
        ctaUrl: promptsUrl(),
        unsubscribeUrl: unsubscribeUrl(token),
        portalUrl: portalUrl(),
      });
      await sendMail({ to: (profile as EngagementProfile).email, subject, html });
      await markEngagementSent(supabaseAdmin, userId, "after_fail", submissionId, {});
      result.sent += 1;
    } catch (err: any) {
      result.errors.push(`${submissionId}: ${err?.message || String(err)}`);
    }
  }

  return result;
}

/** Daily bundle: no-topup + near-withdraw + after-fail. */
export async function processEngagementTriggers(
  supabaseAdmin: SupabaseClient
): Promise<{
  no_topup: EngagementRunResult;
  near_withdraw: EngagementRunResult;
  after_fail: EngagementRunResult;
}> {
  const no_topup = await processNoTopupTriggers(supabaseAdmin);
  const near_withdraw = await processNearWithdrawTriggers(supabaseAdmin);
  const after_fail = await processAfterFailTriggers(supabaseAdmin);
  return { no_topup, near_withdraw, after_fail };
}
