-- JobToken: extensions for payments, notifications, messaging, featured jobs.
-- Run after existing core tables (profiles, jobs, applications, wallets, transactions).

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_kes numeric;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS checkout_request_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mpesa_receipt_number text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_checkout_request
  ON transactions (checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_mpesa_receipt
  ON transactions (mpesa_receipt_number)
  WHERE mpesa_receipt_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_application_created
  ON messages (application_id, created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "messages_select_participants" ON messages;
CREATE POLICY "messages_select_participants"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.id = messages.application_id
        AND (a.user_id = auth.uid() OR j.posted_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "messages_insert_participants" ON messages;
CREATE POLICY "messages_insert_participants"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM applications a
      JOIN jobs j ON j.id = a.job_id
      WHERE a.id = application_id
        AND (a.user_id = auth.uid() OR j.posted_by = auth.uid())
    )
  );
