/**
 * RBAC Permission Matrix
 *
 * Defines what each role can do across all HRMS modules.
 * Used by API routes (requirePermission) and UI components (usePermissions).
 */

export type UserRole =
  | 'director'
  | 'hr_officer'
  | 'compliance_manager'
  | 'operations_manager'
  | 'team_leader'
  | 'payroll_officer'
  | 'employee'
  | 'contractor'
  | 'auditor'
  | 'it_admin'

/** Every permission key in the system */
export type Permission =
  // Employees
  | 'employees:read'
  | 'employees:write'
  | 'employees:delete'
  // Roles & Users
  | 'roles:read'
  | 'roles:write'
  // Payroll
  | 'payroll:read'
  | 'payroll:write'
  // Audit Logs
  | 'audit_logs:read'
  // Compliance
  | 'compliance:read'
  | 'compliance:write'
  // Documents
  | 'documents:read'
  | 'documents:write'
  // Onboarding
  | 'onboarding:read'
  | 'onboarding:write'
  // Training
  | 'training:read'
  | 'training:write'
  // Recruitment
  | 'recruitment:read'
  | 'recruitment:write'
  // Contracts
  | 'contracts:read'
  | 'contracts:write'
  // Performance
  | 'performance:read'
  | 'performance:write'
  // WHS (Safety)
  | 'whs:read'
  | 'whs:write'
  // Grievances
  | 'grievances:read'
  | 'grievances:write'
  // Separation
  | 'separation:read'
  | 'separation:write'
  // Supervision
  | 'supervision:read'
  | 'supervision:write'
  // Rostering
  | 'rostering:read'
  | 'rostering:write'
  // Timesheets
  | 'timesheets:read'
  | 'timesheets:write'
  | 'timesheets:approve'
  // Workforce Planning
  | 'workforce_planning:read'
  | 'workforce_planning:write'
  // Analytics & Reporting
  | 'analytics:read'
  // Benefits
  | 'benefits:read'
  | 'benefits:write'
  // Competencies
  | 'competencies:read'
  | 'competencies:write'
  // Assets
  | 'assets:read'
  | 'assets:write'
  // DEI
  | 'dei:read'
  | 'dei:write'
  // Engagement
  | 'engagement:read'
  | 'engagement:write'
  // Recognition
  | 'recognition:read'
  | 'recognition:write'
  // Referrals
  | 'referrals:read'
  | 'referrals:write'
  // Leave Management
  | 'leave:read'
  | 'leave:write'
  | 'leave:approve'
  // CRM
  | 'crm:read'
  | 'crm:write'
  // Expenses
  | 'expenses:read'
  | 'expenses:write'
  | 'expenses:approve'
  // NDIS Audits
  | 'ndis_audits:read'
  | 'ndis_audits:write'
  // NDIS Incidents
  | 'ndis_incidents:read'
  | 'ndis_incidents:write'
  // Participant Management CRM
  | 'participant_mgmt:read'
  | 'participant_mgmt:write'
  // Medication & Health Support
  | 'medication_health:read'
  | 'medication_health:write'
  // Incident & Behaviour Support
  | 'incident_behaviour:read'
  | 'incident_behaviour:write'
  // Roster & Shift Management
  | 'roster_shifts:read'
  | 'roster_shifts:write'
  // Payroll & Finance (enhanced)
  | 'payroll_finance:read'
  | 'payroll_finance:write'
  // Employee Self-Service
  | 'self_service:read'
  | 'self_service:write'
  // Reports & Analytics (enhanced)
  | 'reports_analytics:read'
  | 'reports_analytics:write'
  // Settings (tenant branding / config)
  | 'settings:read'
  | 'settings:write'
  // Superannuation Tracker
  | 'superannuation:read'
  | 'superannuation:write'
  // Salary Review & Increment Workflow
  | 'salary_review:read'
  | 'salary_review:write'
  // TOIL (Time Off In Lieu) Tracking
  | 'toil:read'
  | 'toil:write'
  // Org Structure (Departments / Positions / Branches)
  | 'departments:read'
  | 'departments:write'
  | 'positions:read'
  | 'positions:write'
  | 'branches:read'
  | 'branches:write'
  // Audit (alias used by audit-log routes)
  | 'audit:read'
  | 'audit:write'
  // Users
  | 'users:read'
  | 'users:write'

/** Permission matrix — every role mapped to its allowed permissions */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  director: [
    // Full access to everything
    'employees:read', 'employees:write', 'employees:delete',
    'roles:read', 'roles:write',
    'users:read', 'users:write',
    'departments:read', 'departments:write',
    'positions:read', 'positions:write',
    'branches:read', 'branches:write',
    'payroll:read', 'payroll:write',
    'audit_logs:read', 'audit:read', 'audit:write',
    'compliance:read', 'compliance:write',
    'documents:read', 'documents:write',
    'onboarding:read', 'onboarding:write',
    'training:read', 'training:write',
    'recruitment:read', 'recruitment:write',
    'contracts:read', 'contracts:write',
    'performance:read', 'performance:write',
    'whs:read', 'whs:write',
    'grievances:read', 'grievances:write',
    'separation:read', 'separation:write',
    'supervision:read', 'supervision:write',
    'rostering:read', 'rostering:write',
    'timesheets:read', 'timesheets:write', 'timesheets:approve',
    'workforce_planning:read', 'workforce_planning:write',
    'analytics:read',
    'benefits:read', 'benefits:write',
    'competencies:read', 'competencies:write',
    'assets:read', 'assets:write',
    'dei:read', 'dei:write',
    'engagement:read', 'engagement:write',
    'recognition:read', 'recognition:write',
    'referrals:read', 'referrals:write',
    'leave:read', 'leave:write', 'leave:approve',
    'crm:read', 'crm:write',
    'expenses:read', 'expenses:write', 'expenses:approve',
    'ndis_audits:read', 'ndis_audits:write',
    'ndis_incidents:read', 'ndis_incidents:write',
    'participant_mgmt:read', 'participant_mgmt:write',
    'medication_health:read', 'medication_health:write',
    'incident_behaviour:read', 'incident_behaviour:write',
    'roster_shifts:read', 'roster_shifts:write',
    'payroll_finance:read', 'payroll_finance:write',
    'self_service:read', 'self_service:write',
    'reports_analytics:read', 'reports_analytics:write',
    'settings:read', 'settings:write',
    'superannuation:read', 'superannuation:write',
    'salary_review:read', 'salary_review:write',
    'toil:read', 'toil:write',
  ],

  hr_officer: [
    'employees:read', 'employees:write',
    'roles:read', 'users:read',
    'departments:read', 'departments:write',
    'positions:read', 'positions:write',
    'branches:read', 'branches:write',
    'audit_logs:read', 'audit:read',
    'payroll:read', 'payroll:write',
    'compliance:read', 'compliance:write',
    'documents:read', 'documents:write',
    'onboarding:read', 'onboarding:write',
    'training:read', 'training:write',
    'recruitment:read', 'recruitment:write',
    'contracts:read', 'contracts:write',
    'performance:read', 'performance:write',
    'whs:read', 'whs:write',
    'grievances:read', 'grievances:write',
    'separation:read', 'separation:write',
    'supervision:read', 'supervision:write',
    'rostering:read', 'rostering:write',
    'timesheets:read', 'timesheets:write', 'timesheets:approve',
    'workforce_planning:read',
    'analytics:read',
    'benefits:read', 'benefits:write',
    'competencies:read', 'competencies:write',
    'dei:read', 'dei:write',
    'engagement:read', 'engagement:write',
    'recognition:read', 'recognition:write',
    'referrals:read',
    'leave:read', 'leave:write', 'leave:approve',
    'crm:read', 'crm:write',
    'expenses:read', 'expenses:write', 'expenses:approve',
    'ndis_audits:read', 'ndis_audits:write',
    'ndis_incidents:read', 'ndis_incidents:write',
    'participant_mgmt:read', 'participant_mgmt:write',
    'medication_health:read', 'medication_health:write',
    'incident_behaviour:read', 'incident_behaviour:write',
    'roster_shifts:read', 'roster_shifts:write',
    'payroll_finance:read', 'payroll_finance:write',
    'self_service:read', 'self_service:write',
    'reports_analytics:read', 'reports_analytics:write',
    'settings:read',
    'superannuation:read', 'superannuation:write',
    'salary_review:read', 'salary_review:write',
    'toil:read', 'toil:write',
  ],

  compliance_manager: [
    'employees:read',
    'departments:read', 'positions:read', 'branches:read',
    'audit_logs:read', 'audit:read',
    'compliance:read', 'compliance:write',
    'documents:read', 'documents:write',
    'whs:read', 'whs:write',
    'training:read',
    'performance:read',
    'analytics:read',
    'ndis_audits:read', 'ndis_audits:write',
    'ndis_incidents:read', 'ndis_incidents:write',
    'participant_mgmt:read', 'participant_mgmt:write',
    'medication_health:read', 'medication_health:write',
    'incident_behaviour:read', 'incident_behaviour:write',
    'roster_shifts:read',
    'payroll_finance:read',
    'reports_analytics:read',
    'settings:read',
    'superannuation:read',
    'salary_review:read',
    'toil:read',
  ],

  operations_manager: [
    'employees:read',
    'departments:read', 'positions:read', 'branches:read',
    'rostering:read', 'rostering:write',
    'timesheets:read', 'timesheets:write', 'timesheets:approve',
    'workforce_planning:read', 'workforce_planning:write',
    'assets:read', 'assets:write',
    'supervision:read', 'supervision:write',
    'training:read',
    'performance:read',
    'analytics:read',
    'whs:read',
    'documents:read',
    'leave:read', 'leave:approve',
    'crm:read',
    'expenses:read', 'expenses:approve',
    'participant_mgmt:read', 'participant_mgmt:write',
    'medication_health:read', 'medication_health:write',
    'incident_behaviour:read', 'incident_behaviour:write',
    'roster_shifts:read', 'roster_shifts:write',
    'payroll_finance:read', 'payroll_finance:write',
    'reports_analytics:read', 'reports_analytics:write',
    'toil:read', 'toil:write',
  ],

  team_leader: [
    'employees:read',
    'supervision:read', 'supervision:write',
    'performance:read', 'performance:write',
    'rostering:read', 'rostering:write',
    'roster_shifts:read', 'roster_shifts:write',
    'timesheets:read', 'timesheets:write', 'timesheets:approve',
    'training:read',
    'documents:read',
    'whs:read',
    'recognition:read', 'recognition:write',
    'engagement:read',
    'leave:read', 'leave:approve',
    'expenses:read', 'expenses:approve',
    'self_service:read',
    'reports_analytics:read',
    'toil:read', 'toil:write',
  ],

  payroll_officer: [
    'employees:read',
    'payroll:read', 'payroll:write',
    'timesheets:read', 'timesheets:approve',
    'benefits:read', 'benefits:write',
    'documents:read',
    'analytics:read',
    'leave:read',
    'payroll_finance:read', 'payroll_finance:write',
    'reports_analytics:read', 'reports_analytics:write',
    'superannuation:read', 'superannuation:write',
    'salary_review:read', 'salary_review:write',
    'toil:read', 'toil:write',
  ],

  auditor: [
    'audit_logs:read', 'audit:read',
    'compliance:read',
    'documents:read',
    'employees:read',
    'analytics:read',
    'whs:read',
    'training:read',
    'performance:read',
    'ndis_audits:read',
    'ndis_incidents:read',
    'participant_mgmt:read',
    'medication_health:read',
    'incident_behaviour:read',
    'roster_shifts:read',
    'payroll_finance:read',
    'reports_analytics:read',
    'superannuation:read',
    'salary_review:read',
    'toil:read',
  ],

  it_admin: [
    'roles:read', 'roles:write',
    'users:read', 'users:write',
    'audit_logs:read', 'audit:read',
    'employees:read',
    'departments:read', 'positions:read', 'branches:read',
    'assets:read', 'assets:write',
    'settings:read', 'settings:write',
  ],

  employee: [
    'employees:read',   // own profile only (enforced per-route)
    'training:read',
    'documents:read',   // own documents only
    'recognition:read', 'recognition:write',
    'referrals:read', 'referrals:write',
    'engagement:read', 'engagement:write',
    'whs:read',
    'benefits:read',
    'competencies:read',
    'leave:read', 'leave:write',
    'rostering:read',   // view own schedule
    'timesheets:read', 'timesheets:write',  // clock in/out, view own
    'expenses:read', 'expenses:write',      // submit and view own claims
    'self_service:read', 'self_service:write',
    'toil:read', 'toil:write',             // view own TOIL balance / request
  ],

  contractor: [
    'employees:read',   // own profile only
    'training:read',
    'documents:read',
    'whs:read',
    'rostering:read',
    'timesheets:read', 'timesheets:write',
  ],
}

/** Check if a role has a given permission */
export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as UserRole]
  if (!perms) return false
  return perms.includes(permission)
}

/** Check if a role has ALL of the given permissions */
export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p))
}

/** Check if a role has ANY of the given permissions */
export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p))
}

/** Get all permissions for a role (useful for UI) */
export function getRolePermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as UserRole] ?? []
}

/** All defined roles */
export const ALL_ROLES: UserRole[] = [
  'director', 'hr_officer', 'compliance_manager', 'operations_manager',
  'team_leader', 'payroll_officer', 'employee', 'contractor', 'auditor', 'it_admin',
]

export const ROLE_LABELS: Record<UserRole, string> = {
  director:           'Director',
  hr_officer:         'HR Officer',
  compliance_manager: 'Compliance Manager',
  operations_manager: 'Operations Manager',
  team_leader:        'Team Leader',
  payroll_officer:    'Payroll Officer',
  employee:           'Employee',
  contractor:         'Contractor',
  auditor:            'Auditor',
  it_admin:           'IT Admin',
}
