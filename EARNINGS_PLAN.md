# Earnings & prompt series — execution plan

This document tracks the **KES earnings wallet** (ledger-based), **prompt series** (employer-authored tasks), **token cost to submit**, and **monthly withdrawal requests** settled by admin. Pass rewards are **credited to the seeker** from `earnings_ledger` with **no in-app escrow balance check** (commercial settlement is out of band). The **spend wallet** (tokens) remains separate from **earnings** (KES ledger).

## Principles

| Layer | Mechanism |
|-------|-----------|
| Spend (apply, submit answers) | Existing `wallets` + `transactions` (tokens) |
| Earn (pass grade) | `earnings_ledger` rows (`amount_kes` **+**) when admin grades pass (idempotent per submission) |
| Withdraw | User requests monthly → admin marks paid → `earnings_ledger` **−** debit |
| Balance | **Sum(`amount_kes`)** per user from `earnings_ledger` (canonical); optional cache later |

## Phases & status

| Phase | Scope | Status |
|-------|--------|--------|
| 1 | DB: `prompt_series`, `prompts`, `prompt_submissions`, `earnings_ledger`, `withdrawal_requests` + RLS | Done — `20250331000014_prompt_series_and_submissions.sql`, `20250331000015_earnings_ledger_and_withdrawals.sql` |
| 2 | API: submit prompt (token deduct + submission), grade pass → ledger credit | Done — see **API map** and `server/app.ts` |
| 3 | Seeker UI: home cards, prompt detail, earnings statement, withdrawal request | Done — dashboard prompt cards + `/dashboard/prompts` + `/dashboard/prompts/:seriesId` submit modal; `/dashboard/earnings` |
| 4 | Employer UI: series + prompts CRUD | Done — `/dashboard/employer/prompts`, `/dashboard/employer/prompts/:seriesId`; RLS + migration `20250331000016_prompt_series_delete_policy.sql` |
| 5 | Admin UI: grading queue, withdrawal settlement | Done — `/admin/prompt-grading`, `/admin/withdrawals`; APIs require `adminUserId` |
| 6 | Statements CSV, idempotency hardening | Done — admin `GET /api/admin/export-earnings-ledger`, seeker statement CSV on `/dashboard/earnings`; settle `idempotencyKey` + `admin_idempotency` migration |

## Schema (summary)

- **`prompt_series`**: Employer-owned container (`created_by` → `profiles.id`), `title`, `description`, `status` (`draft` \| `published`).
- **`prompts`**: `series_id`, `sort_order`, `headline`, `instructions`, `word_limit`, `reward_kes`, `submit_cost_tokens`, `is_published`.
- **`prompt_submissions`**: One row per `(prompt_id, user_id)`; `answer_text`, `tokens_charged`, `grade_status` (`pending` \| `pass` \| `fail`), `graded_at`, `graded_by`.
- **`earnings_ledger`**: `user_id`, signed `amount_kes`, `entry_type` (`reward_credit` \| `adjustment` \| `withdrawal_payout` \| `reversal`), `reference_type`, `reference_id`, `metadata`, `created_at`.
- **`withdrawal_requests`**: `user_id`, `amount_kes_requested`, `period_month`, `status`, `amount_paid_kes`, admin fields.

## Business rules

1. **Reward** is credited **only** when admin sets `grade_status = pass` (idempotent per submission).
2. **Withdrawals**: user-initiated in an allowed window (e.g. end of month); admin records full/partial payout and inserts **negative** ledger lines.
3. **Rewards**: Grading **pass** credits the seeker’s `earnings_ledger` by `prompts.reward_kes` (no escrow gate in the app).

## API map (target)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/prompts/series` | Public cards (published series + prompt summaries) |
| GET | `/api/prompts/series/:id` | Detail (full prompts require auth; or split public/private fields) |
| POST | `/api/prompts/submit` | Authenticated submit → token deduct + submission row |
| GET | `/api/earnings/summary` | Balance + recent ledger (seeker) |
| GET | `/api/earnings/ledger` | Paginated statement |
| POST | `/api/earnings/withdrawal-request` | Create request (rules enforced) |
| POST | `/api/admin/prompt-submissions/:id/grade` | Pass/fail → on pass, credit seeker `earnings_ledger` (RPC `grade_prompt_submission`) |
| GET | `/api/admin/prompt-submissions?status=pending` | Grading queue (admin) |
| GET | `/api/admin/withdrawal-requests?adminUserId=` | List requests (admin) |
| GET | `/api/admin/export-earnings-ledger?adminUserId=` | Full earnings ledger CSV (admin) |
| POST | `/api/admin/withdrawal-requests/:id/settle` | Body optional `idempotencyKey` for replay-safe settlement |

## Environment

| Variable | Purpose |
|----------|---------|
| `EARNINGS_WITHDRAWAL_DAY_MIN` | Calendar day (1–28) from which withdrawal requests are allowed until month end. Default **25**. Server-only (`server/app.ts`). |

## Build order (for implementers)

1. Apply migrations on Supabase (`supabase db push` or dashboard SQL).
2. ~~Express routes~~ — implemented; run `npx tsc --noEmit` after changes.
3. Seeker pages: discovery → detail → submit.
4. Employer pages: series CRUD.
5. Admin: grading + withdrawals.
6. Export & audits.

## Files

- Migrations: `20250331000014`–`17`, `19` (transactions types); `18` added escrow (superseded by `20_remove_reward_escrow` if applied)
- Server: `server/app.ts` (prompts + earnings routes; Vercel rewrites include `prompts` and `earnings`)
- Seeker UI: `src/components/PromptSeriesCards.tsx`, `PromptSubmitModal.tsx`, `src/pages/PromptSeriesBrowsePage.tsx`, `PromptSeriesDetailPage.tsx`, `SeekerEarningsPage.tsx` (statement CSV); dashboard strip in `src/pages/Dashboard.tsx`
- Employer prompts: `EmployerPromptSeriesListPage.tsx`, `EmployerPromptSeriesEditorPage.tsx`
- Admin: `AdminPromptGradingPage.tsx`, `AdminWithdrawalsPage.tsx`, `AdminDashboard.tsx` (ledger CSV + nav)
- This file: `EARNINGS_PLAN.md` (root)

---

*Last updated: Phases 1–6 complete.*
