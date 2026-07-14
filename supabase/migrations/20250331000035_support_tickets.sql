-- Support ticket system: tables, enums, triggers, indexes, RLS.

DO $$ BEGIN
  CREATE TYPE support_ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE support_ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE support_ticket_category AS ENUM (
    'account_issue',
    'payment_billing',
    'token_wallet',
    'prompt_submissions',
    'job_applications',
    'technical_bug',
    'feature_request',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   text NOT NULL UNIQUE,
  email           text NOT NULL,
  name            text,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category        support_ticket_category NOT NULL DEFAULT 'other',
  subject         text NOT NULL CHECK (char_length(subject) BETWEEN 5 AND 200),
  description     text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 5000),
  status          support_ticket_status NOT NULL DEFAULT 'open',
  priority        support_ticket_priority NOT NULL DEFAULT 'medium',
  assigned_to     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role     text NOT NULL DEFAULT 'admin' CHECK (author_role IN ('admin', 'user', 'system')),
  body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  is_internal     boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Ticket number generator: JT-YYYYMMDD-NNNN
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  today_str text;
  seq int;
BEGIN
  today_str := to_char(now(), 'YYYYMMDD');
  SELECT count(*) + 1 INTO seq
    FROM public.support_tickets
   WHERE ticket_number LIKE 'JT-' || today_str || '-%';
  RETURN 'JT-' || today_str || '-' || lpad(seq::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION support_ticket_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_number ON public.support_tickets;
CREATE TRIGGER trg_support_ticket_number
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION support_ticket_before_insert();

CREATE OR REPLACE FUNCTION support_ticket_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_ticket_updated ON public.support_tickets;
CREATE TRIGGER trg_support_ticket_updated
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION support_ticket_updated_at();

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_email ON public.support_tickets(email);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_number ON public.support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket ON public.support_ticket_replies(ticket_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_all_tickets ON public.support_tickets;
CREATE POLICY admin_all_tickets ON public.support_tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS admin_all_replies ON public.support_ticket_replies;
CREATE POLICY admin_all_replies ON public.support_ticket_replies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE public.support_tickets IS 'User-submitted support tickets for admin resolution.';
COMMENT ON TABLE public.support_ticket_replies IS 'Threaded replies on support tickets (admin, user, or system).';
