-- Migration 0064: DB-backed RBAC tables (gap 2.5)
-- Creates hrms_permissions and hrms_role_permissions tables,
-- seeds all permissions and role grants from the existing permissions.ts matrix.

-- 1. Master permissions table
CREATE TABLE IF NOT EXISTS hrms_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         VARCHAR(100) NOT NULL UNIQUE,
  module      VARCHAR(60)  NOT NULL,
  action      VARCHAR(20)  NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hrms_permissions_key_idx ON hrms_permissions (key);

-- 2. Role → permission grants
CREATE TABLE IF NOT EXISTS hrms_role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role          VARCHAR(60)  NOT NULL,
  permission_id UUID NOT NULL REFERENCES hrms_permissions(id) ON DELETE CASCADE,
  granted_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  granted_by    VARCHAR(100),
  UNIQUE (role, permission_id)
);

CREATE INDEX IF NOT EXISTS hrms_role_permissions_role_idx ON hrms_role_permissions (role);

-- RLS
ALTER TABLE hrms_permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrms_role_permissions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_select" ON hrms_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_service_all" ON hrms_permissions
  FOR ALL TO service_role USING (true);
CREATE POLICY "role_permissions_select" ON hrms_role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_service_all" ON hrms_role_permissions
  FOR ALL TO service_role USING (true);

-- 3. Seed all permission keys
INSERT INTO hrms_permissions (key, module, action) VALUES
  ('employees:read','employees','read'),('employees:write','employees','write'),('employees:delete','employees','delete'),
  ('roles:read','roles','read'),('roles:write','roles','write'),
  ('users:read','users','read'),('users:write','users','write'),
  ('helpdesk:read','helpdesk','read'),('helpdesk:write','helpdesk','write'),
  ('departments:read','departments','read'),('departments:write','departments','write'),
  ('positions:read','positions','read'),('positions:write','positions','write'),
  ('branches:read','branches','read'),('branches:write','branches','write'),
  ('payroll:read','payroll','read'),('payroll:write','payroll','write'),
  ('audit_logs:read','audit_logs','read'),('audit:read','audit','read'),('audit:write','audit','write'),
  ('compliance:read','compliance','read'),('compliance:write','compliance','write'),
  ('documents:read','documents','read'),('documents:write','documents','write'),
  ('onboarding:read','onboarding','read'),('onboarding:write','onboarding','write'),
  ('training:read','training','read'),('training:write','training','write'),
  ('recruitment:read','recruitment','read'),('recruitment:write','recruitment','write'),
  ('contracts:read','contracts','read'),('contracts:write','contracts','write'),
  ('performance:read','performance','read'),('performance:write','performance','write'),
  ('whs:read','whs','read'),('whs:write','whs','write'),
  ('grievances:read','grievances','read'),('grievances:write','grievances','write'),
  ('separation:read','separation','read'),('separation:write','separation','write'),
  ('supervision:read','supervision','read'),('supervision:write','supervision','write'),
  ('rostering:read','rostering','read'),('rostering:write','rostering','write'),
  ('timesheets:read','timesheets','read'),('timesheets:write','timesheets','write'),('timesheets:approve','timesheets','approve'),
  ('workforce_planning:read','workforce_planning','read'),('workforce_planning:write','workforce_planning','write'),
  ('analytics:read','analytics','read'),
  ('benefits:read','benefits','read'),('benefits:write','benefits','write'),
  ('competencies:read','competencies','read'),('competencies:write','competencies','write'),
  ('assets:read','assets','read'),('assets:write','assets','write'),
  ('dei:read','dei','read'),('dei:write','dei','write'),
  ('engagement:read','engagement','read'),('engagement:write','engagement','write'),
  ('recognition:read','recognition','read'),('recognition:write','recognition','write'),
  ('referrals:read','referrals','read'),('referrals:write','referrals','write'),
  ('leave:read','leave','read'),('leave:create','leave','create'),('leave:write','leave','write'),('leave:approve','leave','approve'),
  ('crm:read','crm','read'),('crm:write','crm','write'),
  ('expenses:read','expenses','read'),('expenses:write','expenses','write'),('expenses:approve','expenses','approve'),
  ('ndis_audits:read','ndis_audits','read'),('ndis_audits:write','ndis_audits','write'),
  ('ndis_incidents:read','ndis_incidents','read'),('ndis_incidents:write','ndis_incidents','write'),
  ('participant_mgmt:read','participant_mgmt','read'),('participant_mgmt:write','participant_mgmt','write'),
  ('medication_health:read','medication_health','read'),('medication_health:write','medication_health','write'),
  ('incident_behaviour:read','incident_behaviour','read'),('incident_behaviour:write','incident_behaviour','write'),
  ('roster_shifts:read','roster_shifts','read'),('roster_shifts:write','roster_shifts','write'),
  ('payroll_finance:read','payroll_finance','read'),('payroll_finance:write','payroll_finance','write'),
  ('self_service:read','self_service','read'),('self_service:write','self_service','write'),
  ('reports_analytics:read','reports_analytics','read'),('reports_analytics:write','reports_analytics','write'),
  ('settings:read','settings','read'),('settings:write','settings','write'),
  ('superannuation:read','superannuation','read'),('superannuation:write','superannuation','write'),
  ('salary_review:read','salary_review','read'),('salary_review:write','salary_review','write'),
  ('toil:read','toil','read'),('toil:write','toil','write')
ON CONFLICT (key) DO NOTHING;

-- 4. Seed role grants
DO $$
DECLARE
  r_role TEXT;
  r_key  TEXT;
  r_pid  UUID;
  role_perms JSONB := '{
    "director":["employees:read","employees:write","employees:delete","roles:read","roles:write","users:read","users:write","helpdesk:read","helpdesk:write","departments:read","departments:write","positions:read","positions:write","branches:read","branches:write","payroll:read","payroll:write","audit_logs:read","audit:read","audit:write","compliance:read","compliance:write","documents:read","documents:write","onboarding:read","onboarding:write","training:read","training:write","recruitment:read","recruitment:write","contracts:read","contracts:write","performance:read","performance:write","whs:read","whs:write","grievances:read","grievances:write","separation:read","separation:write","supervision:read","supervision:write","rostering:read","rostering:write","timesheets:read","timesheets:write","timesheets:approve","workforce_planning:read","workforce_planning:write","analytics:read","benefits:read","benefits:write","competencies:read","competencies:write","assets:read","assets:write","dei:read","dei:write","engagement:read","engagement:write","recognition:read","recognition:write","referrals:read","referrals:write","leave:read","leave:write","leave:create","leave:approve","crm:read","crm:write","expenses:read","expenses:write","expenses:approve","ndis_audits:read","ndis_audits:write","ndis_incidents:read","ndis_incidents:write","participant_mgmt:read","participant_mgmt:write","medication_health:read","medication_health:write","incident_behaviour:read","incident_behaviour:write","roster_shifts:read","roster_shifts:write","payroll_finance:read","payroll_finance:write","self_service:read","self_service:write","reports_analytics:read","reports_analytics:write","settings:read","settings:write","superannuation:read","superannuation:write","salary_review:read","salary_review:write","toil:read","toil:write"],
    "hr_officer":["employees:read","employees:write","employees:delete","roles:read","users:read","users:write","departments:read","departments:write","positions:read","positions:write","branches:read","branches:write","audit_logs:read","audit:read","compliance:read","compliance:write","documents:read","documents:write","onboarding:read","onboarding:write","training:read","training:write","recruitment:read","recruitment:write","contracts:read","contracts:write","performance:read","performance:write","whs:read","whs:write","grievances:read","grievances:write","separation:read","separation:write","supervision:read","supervision:write","rostering:read","rostering:write","timesheets:read","timesheets:write","timesheets:approve","workforce_planning:read","workforce_planning:write","analytics:read","benefits:read","benefits:write","competencies:read","competencies:write","assets:read","assets:write","dei:read","dei:write","engagement:read","engagement:write","recognition:read","recognition:write","referrals:read","referrals:write","leave:read","leave:write","leave:create","leave:approve","crm:read","crm:write","expenses:read","expenses:write","expenses:approve","ndis_audits:read","ndis_audits:write","ndis_incidents:read","ndis_incidents:write","participant_mgmt:read","participant_mgmt:write","medication_health:read","medication_health:write","incident_behaviour:read","incident_behaviour:write","roster_shifts:read","roster_shifts:write","payroll_finance:read","payroll_finance:write","self_service:read","self_service:write","reports_analytics:read","reports_analytics:write","settings:read","superannuation:read","superannuation:write","salary_review:read","salary_review:write","toil:read","toil:write","helpdesk:read","helpdesk:write","payroll:read","payroll:write"],
    "compliance_manager":["employees:read","compliance:read","compliance:write","documents:read","documents:write","onboarding:read","training:read","training:write","whs:read","whs:write","grievances:read","audit_logs:read","audit:read","ndis_audits:read","ndis_audits:write","ndis_incidents:read","ndis_incidents:write","participant_mgmt:read","medication_health:read","medication_health:write","incident_behaviour:read","incident_behaviour:write","reports_analytics:read","analytics:read","helpdesk:read","helpdesk:write"],
    "operations_manager":["employees:read","employees:write","departments:read","departments:write","positions:read","positions:write","branches:read","branches:write","rostering:read","rostering:write","timesheets:read","timesheets:write","timesheets:approve","workforce_planning:read","workforce_planning:write","supervision:read","supervision:write","assets:read","assets:write","whs:read","whs:write","leave:read","leave:write","leave:approve","roster_shifts:read","roster_shifts:write","expenses:read","expenses:approve","analytics:read","reports_analytics:read","toil:read","toil:write","helpdesk:read","helpdesk:write"],
    "team_leader":["employees:read","timesheets:read","timesheets:approve","rostering:read","supervision:read","supervision:write","leave:read","leave:approve","whs:read","expenses:read","expenses:approve","analytics:read","helpdesk:read","helpdesk:write"],
    "payroll_officer":["employees:read","payroll:read","payroll:write","superannuation:read","superannuation:write","salary_review:read","salary_review:write","payroll_finance:read","payroll_finance:write","timesheets:read","timesheets:approve","expenses:read","expenses:approve","reports_analytics:read","analytics:read","audit_logs:read","helpdesk:read","helpdesk:write"],
    "auditor":["employees:read","audit_logs:read","audit:read","compliance:read","payroll:read","documents:read","ndis_audits:read","ndis_incidents:read","reports_analytics:read","analytics:read"],
    "it_admin":["roles:read","roles:write","users:read","users:write","audit_logs:read","audit:read","employees:read","departments:read","positions:read","branches:read","assets:read","assets:write","settings:read","settings:write"],
    "employee":["employees:read","training:read","documents:read","recognition:read","recognition:write","referrals:read","referrals:write","engagement:read","engagement:write","whs:read","benefits:read","competencies:read","leave:read","leave:write","leave:create","rostering:read","timesheets:read","timesheets:write","expenses:read","expenses:write","self_service:read","self_service:write","toil:read","toil:write","helpdesk:read","helpdesk:write"],
    "contractor":["employees:read","training:read","documents:read","whs:read","rostering:read","timesheets:read","timesheets:write","helpdesk:read","helpdesk:write"]
  }';
BEGIN
  FOR r_role IN SELECT jsonb_object_keys(role_perms)
  LOOP
    FOR r_key IN SELECT jsonb_array_elements_text(role_perms->r_role)
    LOOP
      SELECT id INTO r_pid FROM hrms_permissions WHERE key = r_key;
      IF r_pid IS NOT NULL THEN
        INSERT INTO hrms_role_permissions (role, permission_id, granted_by)
        VALUES (r_role, r_pid, 'system:seed')
        ON CONFLICT (role, permission_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
END $$;
