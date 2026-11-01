-- Migration 0061: Soft delete (deleted_at) on core business tables
-- Audit gap 2.11

ALTER TABLE hrms_employees       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE hrms_documents       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE hrms_courses         ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE hrms_training_records ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Indexes to make "WHERE deleted_at IS NULL" fast
CREATE INDEX IF NOT EXISTS employees_not_deleted_idx  ON hrms_employees       (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS documents_not_deleted_idx  ON hrms_documents       (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS courses_not_deleted_idx    ON hrms_courses         (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS training_not_deleted_idx   ON hrms_training_records (tenant_id) WHERE deleted_at IS NULL;
