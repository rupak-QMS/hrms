-- ═══════════════════════════════════════════════════════════════════════════════
-- Yahweh HRMS — RLS Policy SQL Test Suite
-- Run in Supabase SQL Editor: project ukmosenqkuczgbirmrgn
--
-- Tests tenant isolation and cross-tenant write prevention for all hrms_* tables.
-- Results appear as RAISE NOTICE messages in the editor output.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_pass  INT := 0;
  v_fail  INT := 0;
  v_count INT;
  tenant_a UUID := 'c1000000-0000-0000-0000-000000000001'; -- Yahweh Care
  tenant_b UUID := '00000000-0000-0000-0000-000000000002'; -- Yahweh Property Care
  user_a   UUID;
  user_b   UUID;

BEGIN
  SELECT id INTO user_a FROM hrms_users WHERE tenant_id = tenant_a LIMIT 1;
  SELECT id INTO user_b FROM hrms_users WHERE tenant_id = tenant_b LIMIT 1;

  IF user_a IS NULL OR user_b IS NULL THEN
    RAISE NOTICE 'SKIP: seed users not found. Check tenant IDs.'; RETURN;
  END IF;

  RAISE NOTICE '════════════════════════════ Yahweh HRMS RLS Tests ════════════════════════════';

  -- ── Helper macro (repeated per table) ──────────────────────────────────────
  -- Pattern: set JWT claims → SET ROLE authenticated → query → RESET ROLE → check

  -- 1. hrms_employees — cross-tenant read
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','hr_officer')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM hrms_employees WHERE tenant_id = tenant_b;
  RESET ROLE;
  IF v_count = 0 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [1.1] hrms_employees: User A cannot read Tenant B rows';
  ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [1.1] hrms_employees: User A read % Tenant B rows',v_count; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','hr_officer')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM hrms_employees WHERE tenant_id = tenant_a;
  RESET ROLE;
  IF v_count > 0 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [1.2] hrms_employees: User A reads own tenant (% rows)',v_count;
  ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [1.2] hrms_employees: User A sees 0 own-tenant rows — too restrictive!'; END IF;

  -- 2. hrms_users — cross-tenant read
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','hr_officer')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM hrms_users WHERE tenant_id = tenant_b;
  RESET ROLE;
  IF v_count = 0 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [2.1] hrms_users: User A cannot read Tenant B rows';
  ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [2.1] hrms_users: User A read % Tenant B rows',v_count; END IF;

  -- 3. hrms_payroll_runs
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','payroll_officer')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM hrms_payroll_runs WHERE tenant_id = tenant_b;
  RESET ROLE;
  IF v_count = 0 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [3.1] hrms_payroll_runs: User A sees 0 Tenant B rows';
  ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [3.1] hrms_payroll_runs: User A read % Tenant B rows',v_count; END IF;

  -- 4. hrms_leave_requests
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','hr_officer')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM hrms_leave_requests WHERE tenant_id = tenant_b;
  RESET ROLE;
  IF v_count = 0 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [4.1] hrms_leave_requests: User A sees 0 Tenant B rows';
  ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [4.1] hrms_leave_requests: User A read % Tenant B rows',v_count; END IF;

  -- 5. hrms_audit_logs
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','auditor')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM hrms_audit_logs WHERE tenant_id = tenant_b;
  RESET ROLE;
  IF v_count = 0 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [5.1] hrms_audit_logs: Auditor A sees 0 Tenant B rows';
  ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [5.1] hrms_audit_logs: Auditor A read % Tenant B rows',v_count; END IF;

  -- 6. hrms_tenants visibility
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','employee')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM hrms_tenants WHERE id = tenant_b;
  RESET ROLE;
  IF v_count = 0 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [6.1] hrms_tenants: Employee A cannot see Tenant B row';
  ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [6.1] hrms_tenants: Employee A saw Tenant B row — breach!'; END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','employee')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM hrms_tenants WHERE id = tenant_a;
  RESET ROLE;
  IF v_count = 1 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [6.2] hrms_tenants: Employee A can see own tenant row';
  ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [6.2] hrms_tenants: Employee A sees 0 own-tenant rows — too restrictive!'; END IF;

  -- 7. Cross-tenant INSERT prevention
  BEGIN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','hr_officer')::text, true);
    SET LOCAL ROLE authenticated;
    INSERT INTO hrms_users (id, tenant_id, email, role, is_active)
    VALUES (gen_random_uuid(), tenant_b, 'rls_intruder@test.invalid', 'employee', false);
    RESET ROLE;
    v_fail:=v_fail+1; RAISE NOTICE 'FAIL [7.1] Cross-tenant INSERT into hrms_users was NOT blocked — RLS breach!';
    DELETE FROM hrms_users WHERE email = 'rls_intruder@test.invalid';
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_pass:=v_pass+1; RAISE NOTICE 'PASS [7.1] Cross-tenant INSERT into hrms_users blocked (%)' , SQLERRM;
  END;

  -- 8. hrms_approval_requests
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub',user_a,'role','authenticated','tenant_id',tenant_a,'user_role','hr_officer')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count FROM hrms_approval_requests WHERE tenant_id = tenant_b;
  RESET ROLE;
  IF v_count = 0 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [8.1] hrms_approval_requests: User A sees 0 Tenant B rows';
  ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [8.1] hrms_approval_requests: User A read % Tenant B rows',v_count; END IF;

  -- 9. anon role — no access
  BEGIN
    SET LOCAL ROLE anon;
    SELECT count(*) INTO v_count FROM hrms_employees;
    RESET ROLE;
    IF v_count = 0 THEN v_pass:=v_pass+1; RAISE NOTICE 'PASS [9.1] anon role sees 0 hrms_employees rows';
    ELSE v_fail:=v_fail+1; RAISE NOTICE 'FAIL [9.1] anon role read % hrms_employees rows — breach!',v_count; END IF;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    v_pass:=v_pass+1; RAISE NOTICE 'PASS [9.1] anon role has no access to hrms_employees (%)' , SQLERRM;
  END;

  RAISE NOTICE '════════════════════════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Results: % PASS, % FAIL', v_pass, v_fail;
  IF v_fail = 0 THEN RAISE NOTICE '✅  ALL TESTS PASSED';
  ELSE RAISE NOTICE '❌  % TESTS FAILED — see FAIL messages above', v_fail; END IF;
  RAISE NOTICE '════════════════════════════════════════════════════════════════════════════════';
END $$;
