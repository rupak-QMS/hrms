-- Migration 0057: Rename remaining tables to hrms_ prefix
-- These tables exist in the DB without hrms_ prefix but Drizzle schema
-- references them with hrms_ prefix. This completes migration 0048.

ALTER TABLE IF EXISTS applications RENAME TO hrms_applications;
ALTER TABLE IF EXISTS asset_assignments RENAME TO hrms_asset_assignments;
ALTER TABLE IF EXISTS assets RENAME TO hrms_assets;
ALTER TABLE IF EXISTS audit_logs RENAME TO hrms_audit_logs;
ALTER TABLE IF EXISTS candidates RENAME TO hrms_candidates;
ALTER TABLE IF EXISTS competencies RENAME TO hrms_competencies;
ALTER TABLE IF EXISTS competency_assessments RENAME TO hrms_competency_assessments;
ALTER TABLE IF EXISTS compliance_lock_exceptions RENAME TO hrms_compliance_lock_exceptions;
ALTER TABLE IF EXISTS compliance_tracking RENAME TO hrms_compliance_tracking;
ALTER TABLE IF EXISTS contracts RENAME TO hrms_contracts;
ALTER TABLE IF EXISTS courses RENAME TO hrms_courses;
ALTER TABLE IF EXISTS departments RENAME TO hrms_departments;
ALTER TABLE IF EXISTS diversity_data RENAME TO hrms_diversity_data;
ALTER TABLE IF EXISTS documents RENAME TO hrms_documents;
ALTER TABLE IF EXISTS emergency_contacts RENAME TO hrms_emergency_contacts;
ALTER TABLE IF EXISTS employee_availability RENAME TO hrms_employee_availability;
ALTER TABLE IF EXISTS employee_benefits RENAME TO hrms_employee_benefits;
ALTER TABLE IF EXISTS employee_experience RENAME TO hrms_employee_experience;
ALTER TABLE IF EXISTS employee_notes RENAME TO hrms_employee_notes;
ALTER TABLE IF EXISTS employees RENAME TO hrms_employees;
ALTER TABLE IF EXISTS ess_onboarding RENAME TO hrms_ess_onboarding;
ALTER TABLE IF EXISTS grievances RENAME TO hrms_grievances;
ALTER TABLE IF EXISTS headcount_plan RENAME TO hrms_headcount_plan;
ALTER TABLE IF EXISTS job_requisitions RENAME TO hrms_job_requisitions;
ALTER TABLE IF EXISTS leave_requests RENAME TO hrms_leave_requests;
ALTER TABLE IF EXISTS notifications RENAME TO hrms_notifications;
ALTER TABLE IF EXISTS offer_letter_events RENAME TO hrms_offer_letter_events;
ALTER TABLE IF EXISTS offer_letter_templates RENAME TO hrms_offer_letter_templates;
ALTER TABLE IF EXISTS offer_letters RENAME TO hrms_offer_letters;
ALTER TABLE IF EXISTS onboarding_records RENAME TO hrms_onboarding_records;
ALTER TABLE IF EXISTS participant_behaviour_plans RENAME TO hrms_participant_behaviour_plans;
ALTER TABLE IF EXISTS participant_incidents RENAME TO hrms_participant_incidents;
ALTER TABLE IF EXISTS participant_restrictive_practices RENAME TO hrms_participant_restrictive_practices;
ALTER TABLE IF EXISTS payroll_records RENAME TO hrms_payroll_records;
ALTER TABLE IF EXISTS performance_goals RENAME TO hrms_performance_goals;
ALTER TABLE IF EXISTS performance_reviews RENAME TO hrms_performance_reviews;
ALTER TABLE IF EXISTS platform_announcements RENAME TO hrms_platform_announcements;
ALTER TABLE IF EXISTS positions RENAME TO hrms_positions;
ALTER TABLE IF EXISTS promotion_events RENAME TO hrms_promotion_events;
ALTER TABLE IF EXISTS promotion_requests RENAME TO hrms_promotion_requests;
ALTER TABLE IF EXISTS public_holidays RENAME TO hrms_public_holidays;
ALTER TABLE IF EXISTS recognitions RENAME TO hrms_recognitions;
ALTER TABLE IF EXISTS referrals RENAME TO hrms_referrals;
ALTER TABLE IF EXISTS roster_template_slots RENAME TO hrms_roster_template_slots;
ALTER TABLE IF EXISTS roster_templates RENAME TO hrms_roster_templates;
ALTER TABLE IF EXISTS salary_reviews RENAME TO hrms_salary_reviews;
ALTER TABLE IF EXISTS screening_records RENAME TO hrms_screening_records;
ALTER TABLE IF EXISTS separation_events RENAME TO hrms_separation_events;
ALTER TABLE IF EXISTS separation_records RENAME TO hrms_separation_records;
ALTER TABLE IF EXISTS shift_swap_requests RENAME TO hrms_shift_swap_requests;
ALTER TABLE IF EXISTS shifts RENAME TO hrms_shifts;
ALTER TABLE IF EXISTS super_admins RENAME TO hrms_super_admins;
ALTER TABLE IF EXISTS super_contributions RENAME TO hrms_super_contributions;
ALTER TABLE IF EXISTS super_funds RENAME TO hrms_super_funds;
ALTER TABLE IF EXISTS supervision_records RENAME TO hrms_supervision_records;
ALTER TABLE IF EXISTS survey_responses RENAME TO hrms_survey_responses;
ALTER TABLE IF EXISTS surveys RENAME TO hrms_surveys;
ALTER TABLE IF EXISTS tenant_modules RENAME TO hrms_tenant_modules;
ALTER TABLE IF EXISTS tenants RENAME TO hrms_tenants;
ALTER TABLE IF EXISTS timesheets RENAME TO hrms_timesheets;
ALTER TABLE IF EXISTS toil_balances RENAME TO hrms_toil_balances;
ALTER TABLE IF EXISTS toil_entries RENAME TO hrms_toil_entries;
ALTER TABLE IF EXISTS training_records RENAME TO hrms_training_records;
ALTER TABLE IF EXISTS users RENAME TO hrms_users;
ALTER TABLE IF EXISTS whs_incidents RENAME TO hrms_whs_incidents;

-- After rename, rebuild RLS policies for renamed tables
-- (0056 created policies on old names; after rename the policies carry over
-- but need the helper functions to reference the right table context)
-- The policies themselves are attached to the table object and survive rename.
-- Just re-enable RLS on the renamed tables to be safe:
ALTER TABLE IF EXISTS hrms_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_payroll_run_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_super_admins ENABLE ROW LEVEL SECURITY;
