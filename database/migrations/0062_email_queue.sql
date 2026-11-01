-- Migration 0062: Email queue for durable outbound email delivery
-- Queues emails in DB for retry/status tracking before sending via Resend.

CREATE TABLE IF NOT EXISTS hrms_email_queue (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID         REFERENCES hrms_tenants(id) ON DELETE CASCADE,
  "to"         TEXT         NOT NULL,
  "from"       TEXT,
  subject      TEXT         NOT NULL,
  html         TEXT         NOT NULL,
  status       TEXT         NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'sent', 'failed')),
  attempts     INTEGER      NOT NULL DEFAULT 0,
  last_error   TEXT,
  scheduled_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_queue_status_idx     ON hrms_email_queue (status, scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS email_queue_tenant_idx     ON hrms_email_queue (tenant_id);

-- RLS
ALTER TABLE hrms_email_queue ENABLE ROW LEVEL SECURITY;

-- Only service-role (server) should read/write this table
-- Authenticated users have no access; all operations go through server actions
CREATE POLICY "email_queue_service_only" ON hrms_email_queue
  FOR ALL
  USING (false)
  WITH CHECK (false);
