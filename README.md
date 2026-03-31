# JobToken - Full Stack Job Board

Full-stack job board: React (Vite), Express, Supabase (Postgres + Auth), M-Pesa STK Push (Daraja), and email via **Resend** (default when `RESEND_API_KEY` is set) or **SMTP (Nodemailer)** if you set `EMAIL_PROVIDER=smtp`.

## Project structure

- `src/`: React SPA
- `server/`: Express API (email, M-Pesa, employer job posting, admin)
- `supabase/migrations/`: SQL for schema extensions, `apply_to_job`, notifications, messages
- `public/`: static assets

## Prerequisites

- Node.js v18+
- Supabase project
- **Resend** API key (recommended; used by default), or SMTP if you opt in
- For production M-Pesa: Safaricom Daraja app (consumer key/secret, shortcode, passkey, callback URL)

## Setup

1. **Install**

   ```bash
   npm install
   ```

2. **Environment** — copy `.env.example` to `.env` and fill values (see comments in `.env.example`).

3. **Database** — in the Supabase SQL editor, run the migration files **in order**:

   - `supabase/migrations/20250331000001_schema_extensions.sql`
   - `supabase/migrations/20250331000002_apply_to_job.sql`
   - `supabase/migrations/20250331000003_applications_updated_at.sql`
   - `supabase/migrations/20250331000004_seeker_profile_fields.sql` (education, experience, skills, etc. + profile RLS)

   You should already have core tables (`profiles`, `jobs`, `applications`, `wallets`, `transactions`). Migrations add: `jobs.is_featured`, `applications.notes` / `updated_at`, payment columns on `transactions`, `notifications`, `messages`, RLS for the new tables, and the `apply_to_job` RPC.

4. **Realtime (optional)** — for live message threads in the UI, enable replication for `messages` (Supabase Dashboard → Database → Publications, or add `messages` to `supabase_realtime`).

5. **Run**

   ```bash
   npm run dev
   ```

   App: `http://localhost:3000`

## Email

- With **`RESEND_API_KEY`** in `.env`, all mail goes through Resend. Optional **`RESEND_FROM`** (or `EMAIL_FROM`) for a verified domain; otherwise the default `onboarding@resend.dev` sender works for testing.
- To use SMTP instead, set **`EMAIL_PROVIDER=smtp`** and configure `SMTP_*`. Nodemailer is only used in that mode.

## M-Pesa STK Push

1. Register a Daraja app and obtain consumer key/secret, Lipa Na M-Pesa Online shortcode and passkey.
2. Set `MPESA_CALLBACK_URL` to your **public** HTTPS URL ending in `/api/mpesa/callback` (e.g. Vercel deployment). If you omit it but **`APP_URL`** is a public `https://…` URL (not localhost), the server uses `APP_URL/api/mpesa/callback`.
3. Configure sandbox or production base URL (`MPESA_BASE_URL` or `MPESA_ENV`).
4. The API loads `.env` / `.env.local` from the project root (UTF-8 BOM is stripped). Restart the dev server after edits. Optional: duplicate keys as `VITE_MPESA_*` are also read by the Express server.

Token packs default to Ksh 100 → 5 tokens, 200 → 12, 500 → 35. Override with `TOKEN_PACKS_JSON` (JSON array of `{ "kes", "tokens" }`). Users can also type **any** top-up amount in the wallet; tokens use the same pack if the amount matches exactly, otherwise `floor(amount / MPESA_KES_PER_TOKEN)` (default Ksh 20 per token). Bounds: `MPESA_MIN_TOPUP_KES`, `MPESA_MAX_TOPUP_KES`.

## Local simulated top-up (no M-Pesa)

1. Server: `MPESA_SIMULATE=true`
2. Client: `VITE_ALLOW_SIMULATE_TOPUP=true`

The wallet UI shows a dev-only simulate button that calls `POST /api/topup`.

## Employer revenue controls

- `EMPLOYER_POSTING_FEE_TOKENS` — tokens deducted from the employer’s **wallet** when posting (default `0`).
- **Featured listing cost** — set in the **Admin** portal (stored in `platform_settings`). `FEATURE_JOB_TOKENS` in `.env` is only a fallback if that row is missing.
- Employers use the **same** `wallets` row as seekers: M-Pesa top-up from the employer dashboard wallet card, **30-day expiry** from the last successful top-up (same as `process-stk-callback`). Posting and featuring check balance and expiry before deducting.
- Turning **Featured** on when **editing** a job that was not featured charges the current featured price once; saving again while already featured does not re-charge.

## Deployment (Vercel)

Add the same variables as in `.env.example` (Supabase, **Resend** and/or SMTP, M-Pesa, `APP_URL` = production site URL). Routes under `/api/*` are handled by `api/index.ts` (Vercel serverless entry) and `server/app.ts` (Express app). Local dev uses `server/dev-server.ts`.

## Troubleshooting

- **“Cannot find package 'cors'”** — run `npm install` and restart the editor/TS server.
- **Job list empty after deploy** — run migrations; if `is_featured` is missing, the app falls back to ordering by `created_at` only.
- **M-Pesa callback never fires** — callback URL must be HTTPS and reachable; check Daraja app settings.
