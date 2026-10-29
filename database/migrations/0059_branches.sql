-- Migration 0059: Work locations / branches for organisation structure
-- Supports multi-site NDIS providers (e.g. Yahweh Care has multiple service locations)

CREATE TABLE IF NOT EXISTS hrms_branches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES hrms_tenants(id) ON DELETE CASCADE,
  name         varchar(200) NOT NULL,
  code         varchar(20),           -- short code e.g. 'SYD', 'MEL'
  address      text,
  suburb       varchar(100),
  state        varchar(50),
  postcode     varchar(10),
  country      varchar(100) DEFAULT 'Australia',
  phone        varchar(20),
  email        varchar(255),
  manager_id   uuid REFERENCES hrms_employees(id),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS branches_code_tenant
  ON hrms_branches (tenant_id, code)
  WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS branches_tenant_idx ON hrms_branches (tenant_id);

-- Add branch_id to employees (optional FK — employee may not be branch-based)
ALTER TABLE hrms_employees
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES hrms_branches(id);

-- RLS
ALTER TABLE hrms_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branches_tenant_isolation ON hrms_branches;
CREATE POLICY branches_tenant_isolation ON hrms_branches
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Audit trigger
DROP TRIGGER IF EXISTS audit_hrms_branches ON hrms_branches;
CREATE TRIGGER audit_hrms_branches
  AFTER INSERT OR UPDATE OR DELETE ON hrms_branches
  FOR EACH ROW EXECUTE FUNCTION hrms_write_audit_log();

COMMENT ON TABLE hrms_branches IS
  'Work locations / branches for multi-site organisations. '
  'Each employee can optionally belong to a branch.';
