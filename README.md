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

## Scripts

- `npm run dev`: Starts the Express server with Vite middleware.
- `npm run build`: Builds the frontend for production.
- `npm run lint`: Runs TypeScript type checking.
