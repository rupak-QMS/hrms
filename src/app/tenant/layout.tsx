import { headers, cookies } from 'next/headers'
import TenantLayoutShell from '@/components/tenant/TenantLayoutShell'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { tenants, tenantModules } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { hasPermission, type Permission } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

/**
 * Required permission to see each nav route.
 * null = always shown (e.g. dashboard).
 * Routes not listed default to hidden.
 */
const NAV_PERMISSION: Record<string, Permission | null> = {
  'dashboard':          null,
  'employee-management':'employees:read',   // further restricted below (not for employee/contractor)
  'roles':              'roles:read',
  'audit-logs':         'audit_logs:read',
  'documents':          'documents:read',
  'compliance':         'compliance:read',
  'onboarding':         'onboarding:read',
  'training':           'training:read',
  'competencies':       'competencies:read',
  'supervision':        'supervision:read',
  'workforce-planning': 'workforce_planning:read',
  'recruitment':        'recruitment:read',
  'contracts':          'contracts:read',
  'performance':        'performance:read',
  'whs':                'whs:read',
  'grievances':         'grievances:read',
  'separation':         'separation:read',
  'analytics':          'analytics:read',
  'benefits':           'benefits:read',
  'recognition':        'recognition:read',
  'referrals':          'referrals:read',
  'dei':                'dei:read',
  'engagement':         'engagement:read',
  'assets':             'assets:read',
  'rostering':          'rostering:read',
  'payroll':            'payroll:read',
  'leave':              'leave:read',
  'public-holidays':    'leave:read',
  'crm':                'crm:read',
  'expenses':           'expenses:read',
  'ndis-audits':        'ndis_audits:read',
  'ndis-incidents':     'ndis_incidents:read',
  'participants':       'participant_mgmt:read',
  'medication-health':  'medication_health:read',
  'incident-behaviour': 'incident_behaviour:read',
  'roster-shifts':      'roster_shifts:read',
  'payroll-finance':    'payroll_finance:read',
  'self-service':       'self_service:read',
  'reports-analytics':  'reports_analytics:read',
  // Built-in routes (IDs 31+) — not controlled by tenant module toggles
  'timesheets':         'timesheets:read',
  'screening':          'compliance:read',
  'reports':            'analytics:read',
  'offer-letters':      'contracts:read',
  // New modules (46–52)
  'superannuation':     'superannuation:read',
  'salary-reviews':     'salary_review:read',
  'toil':               'toil:read',
  'schads':             'payroll:read',
  'promotions':         'employees:read',
  'ess-onboarding':     'self_service:read',
  'ess-onboarding-review': 'onboarding:read',
  'experience':         'employees:read',
  'ess-announcements':  'self_service:write',
  'helpdesk':           'helpdesk:read',
}

// Maps SOW module ID → { route slug, sidebar label }
const MODULE_ROUTES: Record<number, { key: string; label: string }> = {
  1:  { key: 'dashboard',             label: 'Dashboard' },
  2:  { key: 'employee-management',   label: 'Employees' },
  3:  { key: 'roles',                 label: 'Roles & Access' },
  4:  { key: 'audit-logs',            label: 'Audit Logs' },
  5:  { key: 'documents',             label: 'Documents' },
  6:  { key: 'compliance',            label: 'Compliance' },
  7:  { key: 'compliance',            label: 'Compliance' },
  8:  { key: 'compliance',            label: 'Compliance' },
  9:  { key: 'onboarding',            label: 'Onboarding' },
  10: { key: 'training',              label: 'Training' },
  11: { key: 'competencies',          label: 'Competencies' },
  12: { key: 'supervision',           label: 'Supervision' },
  13: { key: 'workforce-planning',    label: 'Workforce' },
  14: { key: 'recruitment',           label: 'Recruitment' },
  15: { key: 'contracts',             label: 'Contracts' },
  16: { key: 'performance',           label: 'Performance' },
  17: { key: 'whs',                   label: 'Safety (WHS)' },
  18: { key: 'grievances',            label: 'Grievances' },
  19: { key: 'separation',            label: 'Separation' },
  20: { key: 'analytics',             label: 'Analytics' },
  21: { key: 'benefits',              label: 'Benefits' },
  22: { key: 'recognition',           label: 'Recognition' },
  23: { key: 'referrals',             label: 'Referrals' },
  24: { key: 'dei',                   label: 'DEI' },
  25: { key: 'engagement',            label: 'Engagement' },
  26: { key: 'assets',                label: 'Assets' },
  27: { key: 'rostering',             label: 'Rostering' },
  28: { key: 'payroll',               label: 'Payroll' },
  29: { key: 'leave',                 label: 'Leave Management' },
  30: { key: 'public-holidays',       label: 'Public Holidays' },
  // IDs 31+ are built-in routes (always visible, not toggled by tenant module settings)
  31: { key: 'timesheets',            label: 'Timesheets' },
  32: { key: 'screening',             label: 'Screening' },
  33: { key: 'reports',               label: 'Reports' },
  34: { key: 'offer-letters',         label: 'Offer Letters' },
  35: { key: 'crm',                   label: 'CRM' },
  36: { key: 'expenses',              label: 'Expenses' },
  37: { key: 'ndis-audits',           label: 'NDIS Audits' },
  38: { key: 'ndis-incidents',        label: 'Reportable Incidents' },
  39: { key: 'participants',          label: 'Participants' },
  40: { key: 'medication-health',     label: 'Medication & Health' },
  41: { key: 'incident-behaviour',    label: 'Incidents & Behaviour' },
  42: { key: 'roster-shifts',         label: 'Roster & Shifts' },
  43: { key: 'payroll-finance',        label: 'Payroll & Finance' },
  44: { key: 'self-service',           label: 'Employee Self-Service' },
  45: { key: 'reports-analytics',      label: 'Reports & Analytics' },
  46: { key: 'superannuation',         label: 'Superannuation' },
  47: { key: 'salary-reviews',         label: 'Salary Reviews' },
  48: { key: 'toil',                   label: 'TOIL' },
  49: { key: 'schads',                 label: 'SCHADS Award' },
  50: { key: 'promotions',             label: 'Promotions' },
  51: { key: 'ess-onboarding',         label: 'ESS Onboarding' },
  52: { key: 'ess-onboarding-review',  label: 'Onboarding Review' },
  53: { key: 'experience',             label: 'Experience' },
  54: { key: 'contracting',            label: 'Contracting' },
  55: { key: 'workforce',              label: 'Workforce Summary' },
  56: { key: 'referral',               label: 'Referrals (ESS)' },
  57: { key: 'competency',             label: 'Competency Assessments' },
  58: { key: 'ess-announcements',      label: 'Announcements' },
  59: { key: 'organisation',             label: 'Organisation' },
  60: { key: 'helpdesk',                   label: 'Helpdesk' },
}

async function getTenantConfig(slug: string) {
  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug))
    if (!tenant || !tenant.isActive) return null
    const modules = await db
      .select()
      .from(tenantModules)
      .where(and(eq(tenantModules.tenantId, tenant.id), eq(tenantModules.isEnabled, true)))
    return {
      tenant: {
        id: tenant.id, name: tenant.name, slug: tenant.slug,
        logoUrl: tenant.logoUrl, primaryColor: tenant.primaryColor, settings: tenant.settings,
      },
      enabledModuleIds: modules.map(m => m.moduleId),
    }
  } catch { return null }
}

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const headersList  = await headers()
  const cookieStore  = await cookies()
  // Priority: request header (set by middleware) → cookie → deployment env var → 'default'
  const tenantSlug   =
    headersList.get('x-tenant-slug') ??
    cookieStore.get('tenant_slug')?.value ??
    process.env.NEXT_PUBLIC_TENANT_SLUG ??
    'default'

  const [config, session] = await Promise.all([
    getTenantConfig(tenantSlug),
    getSession(),
  ])

  const tenant  = config?.tenant
  const enabledModuleIds: number[] = config?.enabledModuleIds ?? []

  // Theme
  const primaryColor = tenant?.primaryColor ?? '#1a4fff'
  const logoUrl      = tenant?.logoUrl ?? ''
  const tenantName   = tenant?.name ?? 'HRMS'
  const settings     = tenant?.settings
    ? (typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings)
    : {}
  const fontFamily   = settings.fontFamily   ?? 'Inter'
  const borderRadius = settings.borderRadius ?? '8px'
  const sidebarDark  = settings.sidebarDark  !== false
  const accentColor  = settings.accentColor  ?? '#7c3aed'
  const sidebarBg    = sidebarDark ? '#111827' : primaryColor

  // Session
  const userEmail   = session?.email ?? ''
  const userInitial = userEmail[0]?.toUpperCase() ?? 'U'
  const userRole    = session?.userRole ?? 'employee'

  // Build nav items from enabled module IDs (skip Dashboard — always shown separately)
  // Deduplicate by key so sub-modules that share a route (e.g. compliance 6/7/8) appear once
  // Then filter by role permissions so each role only sees routes they can access
  const isRestrictedEmployee = userRole === 'employee' || userRole === 'contractor'
  const navItems = Object.entries(MODULE_ROUTES)
    .filter(([id]) => {
      const numId = Number(id)
      if (numId === 1) return false                      // Dashboard shown separately
      if (numId >= 31) {
        // NDIS-specific modules (37-45, 49) are only for disability care tenants — hide for YPC
        const NDIS_MODULE_IDS = new Set([37, 38, 39, 40, 41, 42, 43, 44, 45, 49])
        if (NDIS_MODULE_IDS.has(numId) && tenantSlug === 'yahwehpc') return false
        return true                                        // Built-in routes always included
      }
      return enabledModuleIds.includes(numId)            // Tenant-toggled modules
    })
    .map(([, { key, label }]) => ({ key, label }))
    .filter((item, idx, arr) => arr.findIndex(x => x.key === item.key) === idx)
    .filter(({ key }) => {
      const requiredPerm = NAV_PERMISSION[key]
      // Route not in our map — hide it
      if (requiredPerm === undefined) return false
      // No permission required — always show
      if (requiredPerm === null) return true
      // employee-management: never for employee/contractor roles
      if (key === 'employee-management' && isRestrictedEmployee) return false
      // rostering: employees use My Schedule instead
      if (key === 'rostering' && isRestrictedEmployee) return false
      return hasPermission(userRole, requiredPerm)
    })

  return (
    <>
      <style>{`
        :root {
          --primary:  ${primaryColor};
          --accent:   ${accentColor};
          --radius:   ${borderRadius};
          --font:     ${fontFamily}, system-ui, sans-serif;
        }
        body { font-family: var(--font); }
      `}</style>

      <TenantLayoutShell
        navItems={navItems}
        sidebarBg={sidebarBg}
        primaryColor={primaryColor}
        tenantName={tenantName}
        logoUrl={logoUrl}
        userEmail={userEmail}
        userInitial={userInitial}
        userRole={userRole}
        borderRadius={borderRadius}
      >
        {children}
      </TenantLayoutShell>
    </>
  )
}
