-- Migration 0065: Add version column to hrms_employees for optimistic locking
-- hrms_documents already has a version column (migration 0064 did not change it).

ALTER TABLE hrms_employees
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
