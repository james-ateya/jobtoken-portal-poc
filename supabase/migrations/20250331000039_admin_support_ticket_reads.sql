-- Per-admin read state for support ticket inbox / bell notifications.

CREATE TABLE IF NOT EXISTS public.admin_support_ticket_reads (
  admin_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id  uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  read_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_support_ticket_reads_admin
  ON public.admin_support_ticket_reads (admin_id, read_at DESC);

ALTER TABLE public.admin_support_ticket_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_own_ticket_reads ON public.admin_support_ticket_reads;
CREATE POLICY admin_own_ticket_reads ON public.admin_support_ticket_reads
  FOR ALL USING (
    auth.uid() = admin_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE public.admin_support_ticket_reads IS
  'Tracks which support tickets each admin has marked as read in the inbox bell.';
