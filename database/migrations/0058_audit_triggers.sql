-- Migration 0058: Audit log triggers for key HRMS tables
-- Writes to hrms_audit_logs on INSERT/UPDATE/DELETE for compliance-critical tables
-- Reads actor identity from JWT claims via current_user_id() / current_tenant_id()

-- ── Helper: write one audit log row ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION hrms_write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_id   uuid;
  v_action    text;
  v_old_vals  jsonb;
  v_new_vals  jsonb;
  v_resource  text;
  v_res_id    uuid;
BEGIN
  -- Resolve identity from JWT; fall back to service-role (NULL) for migrations
  v_tenant_id := COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid,
    CASE TG_OP
      WHEN 'DELETE' THEN (OLD.tenant_id)
      ELSE              (NEW.tenant_id)
    END
  );
  v_user_id := (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid;

  -- Action
  v_action := TG_OP;  -- INSERT | UPDATE | DELETE

  -- Resource name = table without hrms_ prefix
  v_resource := REPLACE(TG_TABLE_NAME, 'hrms_', '');

  -- Row data
  CASE TG_OP
    WHEN 'INSERT' THEN
      v_new_vals := to_jsonb(NEW);
      v_old_vals := NULL;
      v_res_id   := (NEW.id)::uuid;
    WHEN 'UPDATE' THEN
      v_old_vals := to_jsonb(OLD);
      v_new_vals := to_jsonb(NEW);
      v_res_id   := (NEW.id)::uuid;
    WHEN 'DELETE' THEN
      v_old_vals := to_jsonb(OLD);
      v_new_vals := NULL;
      v_res_id   := (OLD.id)::uuid;
  END CASE;

  -- Strip sensitive fields before logging
  v_old_vals := v_old_vals - 'password_hash' - 'totp_secret' - 'refresh_token';
  v_new_vals := v_new_vals - 'password_hash' - 'totp_secret' - 'refresh_token';

  INSERT INTO hrms_audit_logs (
    tenant_id, user_id, action, resource, resource_id, old_values, new_values
  ) VALUES (
    v_tenant_id, v_user_id, v_action, v_resource, v_res_id, v_old_vals, v_new_vals
  );

  RETURN NULL;  -- AFTER trigger; return value ignored
EXCEPTION WHEN OTHERS THEN
  -- Never block the originating transaction due to audit failure
  RAISE WARNING 'hrms_write_audit_log failed for %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION hrms_write_audit_log() TO authenticated;

-- ── Macro: attach trigger to a table ────────────────────────────────────────
-- We create each trigger individually (no dynamic SQL needed in a migration)

-- Users (critical — role/password changes)
DROP TRIGGER IF EXISTS audit_hrms_users ON hrms_users;
CREATE TRIGGER audit_hrms_users
  AFTER INSERT OR UPDATE OR DELETE ON hrms_users
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

-- Employees
DROP TRIGGER IF EXISTS audit_hrms_employees ON hrms_employees;
CREATE TRIGGER audit_hrms_employees
  AFTER INSERT OR UPDATE OR DELETE ON hrms_employees
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

-- Tenants (tier/settings changes)
DROP TRIGGER IF EXISTS audit_hrms_tenants ON hrms_tenants;
CREATE TRIGGER audit_hrms_tenants
  AFTER INSERT OR UPDATE OR DELETE ON hrms_tenants
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

-- Payroll runs
DROP TRIGGER IF EXISTS audit_hrms_payroll_runs ON hrms_payroll_runs;
CREATE TRIGGER audit_hrms_payroll_runs
  AFTER INSERT OR UPDATE OR DELETE ON hrms_payroll_runs
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

-- Payroll records (individual payslips)
DROP TRIGGER IF EXISTS audit_hrms_payroll_records ON hrms_payroll_records;
CREATE TRIGGER audit_hrms_payroll_records
  AFTER INSERT OR UPDATE OR DELETE ON hrms_payroll_records
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

-- Leave requests
DROP TRIGGER IF EXISTS audit_hrms_leave_requests ON hrms_leave_requests;
CREATE TRIGGER audit_hrms_leave_requests
  AFTER INSERT OR UPDATE OR DELETE ON hrms_leave_requests
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

-- Role permissions
DROP TRIGGER IF EXISTS audit_hrms_role_permissions ON hrms_role_permissions;
CREATE TRIGGER audit_hrms_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON hrms_role_permissions
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

-- Documents
DROP TRIGGER IF EXISTS audit_hrms_documents ON hrms_documents;
CREATE TRIGGER audit_hrms_documents
  AFTER INSERT OR UPDATE OR DELETE ON hrms_documents
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

-- Expense claims
DROP TRIGGER IF EXISTS audit_hrms_expense_claims ON hrms_expense_claims;
CREATE TRIGGER audit_hrms_expense_claims
  AFTER INSERT OR UPDATE OR DELETE ON hrms_expense_claims
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

-- Compliance records (IF table exists — NDIS tables)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hrms_compliance_records') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS audit_hrms_compliance_records ON hrms_compliance_records';
    EXECUTE 'CREATE TRIGGER audit_hrms_compliance_records
      AFTER INSERT OR UPDATE OR DELETE ON hrms_compliance_records
      FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log()';
  END IF;
END;
$$;

-- Performance reviews
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hrms_performance_reviews') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS audit_hrms_performance_reviews ON hrms_performance_reviews';
    EXECUTE 'CREATE TRIGGER audit_hrms_performance_reviews
      AFTER INSERT OR UPDATE OR DELETE ON hrms_performance_reviews
      FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log()';
  END IF;
END;
$$;

-- ── Index: resource_id for fast entity lookups ────────────────────────────
CREATE INDEX IF NOT EXISTS audit_resource_id_idx
  ON hrms_audit_logs (tenant_id, resource, resource_id);

CREATE INDEX IF NOT EXISTS audit_user_id_idx
  ON hrms_audit_logs (tenant_id, user_id, created_at DESC);

COMMENT ON FUNCTION hrms_write_audit_log() IS
  'AFTER trigger: writes audit row to hrms_audit_logs. '
  'Strips password_hash/totp_secret. Never blocks originating transaction.';
