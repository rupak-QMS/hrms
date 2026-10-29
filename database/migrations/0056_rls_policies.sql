-- Migration 0056: Row Level Security for all HRMS tables
-- Enforces tenant isolation at the database level

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid, NULL);
$$;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid, NULL);
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', NULL);
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT current_user_role() = 'super_admin';
$$;

CREATE OR REPLACE FUNCTION has_permission(perm TEXT)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role text := current_user_role();
BEGIN
  IF v_role = 'super_admin' THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'role_permissions') THEN
    RETURN EXISTS (SELECT 1 FROM role_permissions WHERE role = v_role AND permission = perm);
  END IF;
  IF v_role IN ('director', 'hr_officer') THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$;

-- Enable RLS on all tables
ALTER TABLE IF EXISTS tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payroll_run_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS job_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS roster_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS roster_template_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shift_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS grievances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS whs_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS whs_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS competency_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pip_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS separation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS supervision_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS screening_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS diversity_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS investigation_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS compliance_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS compliance_lock_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ess_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ess_quick_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS headcount_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ndis_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ndis_audit_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ndis_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ndis_incident_actions ENABLE ROW LEVEL SECURITY;
-- HRMS_ prefixed tables
ALTER TABLE IF EXISTS hrms_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_participant_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_participant_support_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_participant_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_participant_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_payroll_run_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_expense_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_crm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_ndis_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_ndis_audit_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_ndis_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_ndis_incident_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_ess_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_ess_quick_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_saved_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_employee_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_offer_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_offer_letter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_offer_letter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_performance_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_promotion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_promotion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_salary_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_separation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_super_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_super_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_toil_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_toil_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_ess_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_headcount_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_employee_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS hrms_employee_experience ENABLE ROW LEVEL SECURITY;

-- === POLICIES ===

-- TENANTS
DROP POLICY IF EXISTS tenants_select ON tenants;
CREATE POLICY tenants_select ON tenants FOR SELECT USING (is_super_admin() OR id = current_tenant_id());
DROP POLICY IF EXISTS tenants_modify ON tenants;
CREATE POLICY tenants_modify ON tenants FOR ALL USING (is_super_admin());

-- USERS
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT USING (is_super_admin() OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS users_insert ON users;
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS users_update ON users;
CREATE POLICY users_update ON users FOR UPDATE USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('users:write')) OR id = current_user_id());
DROP POLICY IF EXISTS users_delete ON users;
CREATE POLICY users_delete ON users FOR DELETE USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('users:delete')));

-- EMPLOYEES
DROP POLICY IF EXISTS employees_select ON employees;
CREATE POLICY employees_select ON employees FOR SELECT USING (is_super_admin() OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS employees_write ON employees;
CREATE POLICY employees_write ON employees FOR INSERT WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS employees_update ON employees;
CREATE POLICY employees_update ON employees FOR UPDATE USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('employees:write')));
DROP POLICY IF EXISTS employees_delete ON employees;
CREATE POLICY employees_delete ON employees FOR DELETE USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('employees:delete')));

-- DEPARTMENTS
DROP POLICY IF EXISTS departments_select ON departments;
CREATE POLICY departments_select ON departments FOR SELECT USING (is_super_admin() OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS departments_write ON departments;
CREATE POLICY departments_write ON departments FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('departments:write'))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('departments:write')));

-- DOCUMENTS
DROP POLICY IF EXISTS documents_select ON documents;
CREATE POLICY documents_select ON documents FOR SELECT USING (is_super_admin() OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS documents_write ON documents;
CREATE POLICY documents_write ON documents FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('documents:write'))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('documents:write')));

-- AUDIT_LOGS
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('audit_logs:read')));
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- LEAVE_REQUESTS (own record or permission)
DROP POLICY IF EXISTS leave_requests_select ON leave_requests;
CREATE POLICY leave_requests_select ON leave_requests FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND (has_permission('leave:read') OR employee_id = current_user_id())));
DROP POLICY IF EXISTS leave_requests_write ON leave_requests;
CREATE POLICY leave_requests_write ON leave_requests FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id()) WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- TIMESHEETS (own record or permission)
DROP POLICY IF EXISTS timesheets_select ON timesheets;
CREATE POLICY timesheets_select ON timesheets FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND (has_permission('timesheets:read') OR employee_id = current_user_id())));
DROP POLICY IF EXISTS timesheets_write ON timesheets;
CREATE POLICY timesheets_write ON timesheets FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id()) WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- PAYROLL_RECORDS (own payslip or permission)
DROP POLICY IF EXISTS payroll_records_select ON payroll_records;
CREATE POLICY payroll_records_select ON payroll_records FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND (has_permission('payroll_finance:read') OR employee_id = current_user_id())));
DROP POLICY IF EXISTS payroll_records_write ON payroll_records;
CREATE POLICY payroll_records_write ON payroll_records FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write'))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write')));

-- PAYROLL_RUNS
DROP POLICY IF EXISTS payroll_runs_select ON payroll_runs;
CREATE POLICY payroll_runs_select ON payroll_runs FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:read')));
DROP POLICY IF EXISTS payroll_runs_write ON payroll_runs;
CREATE POLICY payroll_runs_write ON payroll_runs FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write'))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write')));
DROP POLICY IF EXISTS payroll_run_entries_select ON payroll_run_entries;
CREATE POLICY payroll_run_entries_select ON payroll_run_entries FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:read')));
DROP POLICY IF EXISTS payroll_run_entries_write ON payroll_run_entries;
CREATE POLICY payroll_run_entries_write ON payroll_run_entries FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write'))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write')));

-- NOTIFICATIONS (own or admin)
DROP POLICY IF EXISTS notifications_select ON notifications;
CREATE POLICY notifications_select ON notifications FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND (user_id = current_user_id() OR has_permission('notifications:read'))));
DROP POLICY IF EXISTS notifications_write ON notifications;
CREATE POLICY notifications_write ON notifications FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id()) WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- TENANT_MODULES
DROP POLICY IF EXISTS tenant_modules_select ON tenant_modules;
CREATE POLICY tenant_modules_select ON tenant_modules FOR SELECT USING (is_super_admin() OR tenant_id = current_tenant_id());
DROP POLICY IF EXISTS tenant_modules_write ON tenant_modules;
CREATE POLICY tenant_modules_write ON tenant_modules FOR ALL USING (is_super_admin());

-- HRMS_PAYROLL_RUNS + ENTRIES
DROP POLICY IF EXISTS hrms_payroll_runs_select ON hrms_payroll_runs;
CREATE POLICY hrms_payroll_runs_select ON hrms_payroll_runs FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:read')));
DROP POLICY IF EXISTS hrms_payroll_runs_write ON hrms_payroll_runs;
CREATE POLICY hrms_payroll_runs_write ON hrms_payroll_runs FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write'))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write')));
DROP POLICY IF EXISTS hrms_payroll_run_entries_select ON hrms_payroll_run_entries;
CREATE POLICY hrms_payroll_run_entries_select ON hrms_payroll_run_entries FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:read')));
DROP POLICY IF EXISTS hrms_payroll_run_entries_write ON hrms_payroll_run_entries;
CREATE POLICY hrms_payroll_run_entries_write ON hrms_payroll_run_entries FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write'))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission('payroll_finance:write')));

-- HRMS_EXPENSE_CLAIMS (own or finance permission)
DROP POLICY IF EXISTS hrms_expense_claims_select ON hrms_expense_claims;
CREATE POLICY hrms_expense_claims_select ON hrms_expense_claims FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND (has_permission('expense_claims:read') OR employee_id = current_user_id())));
DROP POLICY IF EXISTS hrms_expense_claims_write ON hrms_expense_claims;
CREATE POLICY hrms_expense_claims_write ON hrms_expense_claims FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id()) WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- HRMS_PLATFORM_ANNOUNCEMENTS (all read, super admin write)
DROP POLICY IF EXISTS hrms_platform_announcements_select ON hrms_platform_announcements;
CREATE POLICY hrms_platform_announcements_select ON hrms_platform_announcements FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS hrms_platform_announcements_write ON hrms_platform_announcements;
CREATE POLICY hrms_platform_announcements_write ON hrms_platform_announcements FOR ALL USING (is_super_admin());

-- HRMS_SAVED_REPORTS (own or reports:read)
DROP POLICY IF EXISTS hrms_saved_reports_select ON hrms_saved_reports;
CREATE POLICY hrms_saved_reports_select ON hrms_saved_reports FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND (created_by = current_user_id() OR has_permission('reports:read'))));
DROP POLICY IF EXISTS hrms_saved_reports_write ON hrms_saved_reports;
CREATE POLICY hrms_saved_reports_write ON hrms_saved_reports FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id()) WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- HRMS ESS ONBOARDING
DROP POLICY IF EXISTS hrms_ess_onboarding_select ON hrms_ess_onboarding;
CREATE POLICY hrms_ess_onboarding_select ON hrms_ess_onboarding FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND (employee_id = current_user_id() OR has_permission('ess:read'))));
DROP POLICY IF EXISTS hrms_ess_onboarding_write ON hrms_ess_onboarding;
CREATE POLICY hrms_ess_onboarding_write ON hrms_ess_onboarding FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id()) WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id());

-- DYNAMIC POLICIES for grouped tables
DO $$
DECLARE tbl text;
BEGIN
  -- NDIS tables
  FOREACH tbl IN ARRAY ARRAY['hrms_participants','hrms_participant_goals','hrms_participant_support_plans','hrms_participant_notes','hrms_participant_contacts','hrms_ndis_audits','hrms_ndis_audit_actions','hrms_ndis_incidents','hrms_ndis_incident_actions'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''ndis:read'')))', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_write ON %I FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''ndis:write''))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''ndis:write'')))', tbl, tbl);
    END IF;
  END LOOP;
  -- CRM tables
  FOREACH tbl IN ARRAY ARRAY['hrms_crm_leads','hrms_crm_contacts','hrms_crm_accounts','hrms_crm_deals','hrms_crm_activities'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''crm:read'')))', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_write ON %I FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''crm:write''))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''crm:write'')))', tbl, tbl);
    END IF;
  END LOOP;
  -- ESS tables
  FOREACH tbl IN ARRAY ARRAY['hrms_ess_announcements','hrms_ess_quick_links','ess_announcements','ess_quick_links'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (is_super_admin() OR tenant_id = current_tenant_id())', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_write ON %I FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''ess:write''))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''ess:write'')))', tbl, tbl);
    END IF;
  END LOOP;
  -- Offer letters / recruitment
  FOREACH tbl IN ARRAY ARRAY['hrms_offer_letters','hrms_offer_letter_events','hrms_offer_letter_templates'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''recruitment:read'')))', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_write ON %I FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''recruitment:write''))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''recruitment:write'')))', tbl, tbl);
    END IF;
  END LOOP;
  -- Employee lifecycle
  FOREACH tbl IN ARRAY ARRAY['hrms_employee_notes','hrms_performance_goals','hrms_promotion_requests','hrms_promotion_events','hrms_salary_reviews','hrms_separation_events','hrms_employee_availability','hrms_employee_experience','hrms_toil_balances','hrms_toil_entries','hrms_super_contributions','hrms_super_funds','hrms_headcount_plan','headcount_plan'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''employees:read'')))', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_write ON %I FOR ALL USING (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''employees:write''))) WITH CHECK (is_super_admin() OR (tenant_id = current_tenant_id() AND has_permission(''employees:write'')))', tbl, tbl);
    END IF;
  END LOOP;
  -- Standard tenant-isolated remaining tables
  FOREACH tbl IN ARRAY ARRAY['training_records','applications','candidates','job_requisitions','interviews','assets','asset_assignments','contracts','performance_reviews','surveys','survey_responses','recognitions','positions','emergency_contacts','public_holidays','roster_templates','roster_template_slots','shift_swap_requests','shifts','grievances','whs_incidents','whs_inspections','risk_assessments','courses','competencies','competency_assessments','pip_records','saved_reports','scheduled_reports','separation_records','referrals','supervision_records','screening_records','diversity_data','employee_benefits','investigation_evidence','compliance_tracking','compliance_lock_exceptions','ndis_audits','ndis_audit_actions','ndis_incidents','ndis_incident_actions','platform_announcements'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (is_super_admin() OR tenant_id = current_tenant_id())', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS %I_write ON %I', tbl, tbl);
      EXECUTE format('CREATE POLICY %I_write ON %I FOR ALL USING (is_super_admin() OR tenant_id = current_tenant_id()) WITH CHECK (is_super_admin() OR tenant_id = current_tenant_id())', tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- Grant helper functions to authenticated role
GRANT EXECUTE ON FUNCTION current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION has_permission(TEXT) TO authenticated;
