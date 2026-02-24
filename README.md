# JobToken - Full Stack Job Board

This is a full-stack job board application built with React (Vite), Express, Supabase, and Resend.

## Project Structure

- `src/`: Frontend React application.
- `server/`: Backend Express server.
- `public/`: Static assets.

## Prerequisites

- Node.js (v18+)
- A Supabase project
- A Resend account for emails

## Setup Instructions

1. **Clone the repository** (or download and extract the source).
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   - Copy `.env.example` to `.env`.
   - Fill in your Supabase URL, Anon Key, and Service Role Key.
   - Fill in your Resend API Key.
   - Set `APP_URL` to `http://localhost:3000` for local development.

4. **Database Setup**:
   Ensure your Supabase project has the following tables:
   - `profiles` (id, full_name, email, role)
   - `jobs` (id, title, description, job_type, token_cost, posted_by, created_at)
   - `applications` (id, job_id, user_id, status, created_at)
   - `wallets` (id, user_id, token_balance, expires_at)
   - `transactions` (id, wallet_id, tokens_added, type, reference_id, created_at)

5. **Run the application**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Deployment

### Vercel

This project is configured for easy deployment on Vercel:

1. **Connect your repository** to Vercel.
2. **Environment Variables**: Add the following variables in the Vercel Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `APP_URL` (Set to your Vercel deployment URL)
3. **Build Settings**: Vercel should automatically detect the settings from `vercel.json`.
   - Build Command: `npm run build`
   - Output Directory: `dist`

## Troubleshooting

### "Cannot find package 'cors'" Error
If you see this error in VS Code or when running the app:
1. **Run `npm install`**: Ensure all new dependencies are downloaded.
2. **Restart VS Code**: Sometimes the TypeScript server needs a refresh.
3. **Check `node_modules`**: Verify that `node_modules/cors` exists.
