-- Migration 0060: Helpdesk / Support Tickets with SLA tracking
-- Module 60 — Helpdesk

-- Enums
DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'pending', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ticket_category AS ENUM ('it', 'hr', 'payroll', 'facilities', 'compliance', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Support tickets table
CREATE TABLE IF NOT EXISTS hrms_support_tickets (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES hrms_tenants(id) ON DELETE CASCADE,
  ticket_number    varchar(30) NOT NULL,
  title            varchar(255) NOT NULL,
  description      text        NOT NULL,
  category         ticket_category NOT NULL DEFAULT 'other',
  priority         ticket_priority NOT NULL DEFAULT 'medium',
  status           ticket_status   NOT NULL DEFAULT 'open',
  submitted_by     uuid        REFERENCES hrms_employees(id),
  assigned_to      uuid        REFERENCES hrms_employees(id),
  sla_target_mins  integer     NOT NULL DEFAULT 1440,
  sla_breached     boolean     NOT NULL DEFAULT false,
  resolved_at      timestamptz,
  closed_at        timestamptz,
  first_response_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ticket_number)
);

-- Ticket comments
CREATE TABLE IF NOT EXISTS hrms_ticket_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES hrms_tenants(id) ON DELETE CASCADE,
  ticket_id   uuid        NOT NULL REFERENCES hrms_support_tickets(id) ON DELETE CASCADE,
  author_id   uuid        REFERENCES hrms_employees(id),
  body        text        NOT NULL,
  is_internal boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS support_tickets_tenant_idx   ON hrms_support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx   ON hrms_support_tickets(tenant_id, status);
CREATE INDEX IF NOT EXISTS support_tickets_priority_idx ON hrms_support_tickets(tenant_id, priority);
CREATE INDEX IF NOT EXISTS ticket_comments_ticket_idx   ON hrms_ticket_comments(ticket_id);

-- Row Level Security
ALTER TABLE hrms_support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrms_ticket_comments  ENABLE ROW LEVEL SECURITY;

-- RLS policies — tenant isolation
CREATE POLICY "tickets_tenant_isolation" ON hrms_support_tickets
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY "ticket_comments_tenant_isolation" ON hrms_ticket_comments
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Enable module 60 for all existing tenants
INSERT INTO hrms_tenant_modules (tenant_id, module_id, module_name, is_enabled, created_at, updated_at)
SELECT id, 60, 'helpdesk', true, now(), now()
FROM hrms_tenants
WHERE is_active = true
ON CONFLICT (tenant_id, module_id) DO NOTHING;

-- Seed a few sample tickets for Yahweh Care (for dashboard testing)
DO $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM hrms_tenants WHERE slug = 'yahwehcare' LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO hrms_support_tickets (tenant_id, ticket_number, title, description, category, priority, status, sla_target_mins, sla_breached, created_at) VALUES
      (v_tenant_id, 'TKT-202610-0001', 'Cannot access payroll module', 'Getting a 403 error when trying to view the payroll module.', 'it',         'high',     'open',        480,  false, now() - interval '9 hours'),
      (v_tenant_id, 'TKT-202610-0002', 'Leave balance incorrect',      'My annual leave balance shows 0 but I have 10 days accrued.',  'hr',         'medium',   'in_progress', 1440, false, now() - interval '6 hours'),
      (v_tenant_id, 'TKT-202610-0003', 'Payslip not generated',        'October payslip has not appeared in my self-service portal.',  'payroll',    'high',     'open',        480,  true,  now() - interval '20 hours'),
      (v_tenant_id, 'TKT-202610-0004', 'Printer in Room 3 offline',    'The shared printer in Room 3 has not connected since Tuesday.','facilities', 'low',      'pending',     4320, false, now() - interval '2 days'),
      (v_tenant_id, 'TKT-202610-0005', 'NDIS compliance doc expired',  'Participant 102 support plan document expired last week.',     'compliance', 'critical', 'open',        240,  true,  now() - interval '8 hours'),
      (v_tenant_id, 'TKT-202610-0006', 'Password reset request',       'Cannot reset password via email link — link expired.',        'it',         'medium',   'resolved',    1440, false, now() - interval '3 days')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
