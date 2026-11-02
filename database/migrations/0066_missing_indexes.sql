-- Migration 0066: Add missing indexes for performance
-- hrms_training_records: indexes for common filter/join columns
CREATE INDEX IF NOT EXISTS idx_training_records_tenant ON hrms_training_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_records_employee ON hrms_training_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_records_status ON hrms_training_records(status);
CREATE INDEX IF NOT EXISTS idx_training_records_expiry ON hrms_training_records(expiry_date);

-- hrms_timesheets: missing status index
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON hrms_timesheets(status);
CREATE INDEX IF NOT EXISTS idx_timesheets_tenant_status ON hrms_timesheets(tenant_id, status);

-- hrms_competencies: no indexes at all
CREATE INDEX IF NOT EXISTS idx_competencies_tenant ON hrms_competencies(tenant_id);

-- hrms_competency_assessments: no indexes
CREATE INDEX IF NOT EXISTS idx_competency_assessments_tenant ON hrms_competency_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_competency_assessments_employee ON hrms_competency_assessments(employee_id);

-- hrms_documents: missing status index
CREATE INDEX IF NOT EXISTS idx_documents_status ON hrms_documents(status);
