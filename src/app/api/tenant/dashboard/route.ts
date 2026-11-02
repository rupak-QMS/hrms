import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  employees, payrollRecords, leaveRequests,
  publicHolidays, documents, whsIncidents,
} from '@/lib/db/schema'
import { eq, and, gte, lte, lt, gt, count, sum, sql } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tenant/dashboard
 *
 * Returns all data needed for the executive dashboard in one request.
 * Requires any manager-level permission; employees are redirected
 * by the page itself, but the API guards with payroll:read.
 *
 * Response shape:
 * {
 *   headcount: { total, active, byEntity, byEmploymentType, newThisMonth, leavingThisMonth }
 *   payroll:   { lastRunPeriod, lastRunGross, lastRunNet, lastRunSuper, ytdGross, ytdNet, ytdSuper, lastRunCount }
 *   leave:     { pendingCount, approvedDaysThisMonth, approvedDaysThisYear }
 *   holidays:  { upcoming: [{ name, date, country }] }
 *   documents: { expiringIn30Days, expiredActive }
 *   incidents: { open, openCritical }
 *   compliance:{ redCount, amberCount }
 *   generatedAt: ISO string
 * }
 */
export async function GET() {
  // employees:read is held by all manager-level roles (director, hr_officer,
  // compliance_manager, operations_manager, payroll_officer, auditor, etc.)
  // so the dashboard is accessible to any authenticated manager.
  const guard = await apiGuard('employees:read')
  if (guard.error) return guard.error
  const { session } = guard

  // employee and contractor roles see a personal dashboard in the UI.
  // They must not see org-wide payroll totals, headcount, or compliance data.
  if (session.userRole === 'employee' || session.userRole === 'contractor') {
    return NextResponse.json(
      { error: 'Personal dashboard — use /api/tenant/leave and /api/tenant/public-holidays.' },
      { status: 403 }
    )
  }
  const tid = session.tenantId

  const now   = new Date()
  const today = now.toISOString().slice(0, 10)

  // Date helpers
  const yearStart  = `${now.getFullYear()}-01-01`
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const monthEnd   = new Date(nextMonth.getTime() - 1).toISOString().slice(0, 10)
  const in30Days   = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)

  // ── 1. Headcount ──────────────────────────────────────────────────────────
  const allEmployees = await db
    .select({
      isActive:       employees.isActive,
      employmentType: employees.employmentType,
      entityName:     employees.entityName,
      startDate:      employees.startDate,
      endDate:        employees.endDate,
      complianceStatus: employees.complianceStatus,
    })
    .from(employees)
    .where(eq(employees.tenantId, tid))

  const activeEmps   = allEmployees.filter(e => e.isActive)
  const total        = allEmployees.length
  const active       = activeEmps.length

  // By entity
  const entityMap: Record<string, number> = {}
  for (const e of activeEmps) {
    const key = e.entityName ?? 'Unassigned'
    entityMap[key] = (entityMap[key] ?? 0) + 1
  }

  // By employment type
  const typeMap: Record<string, number> = {}
  for (const e of activeEmps) {
    typeMap[e.employmentType] = (typeMap[e.employmentType] ?? 0) + 1
  }

  // New starters this month
  const newThisMonth = activeEmps.filter(e => e.startDate >= monthStart && e.startDate <= monthEnd).length

  // Leaving this month (endDate set in current month)
  const leavingThisMonth = allEmployees.filter(e =>
    e.endDate && e.endDate >= monthStart && e.endDate <= monthEnd
  ).length

  // Compliance
  const redCount   = activeEmps.filter(e => e.complianceStatus === 'red').length
  const amberCount = activeEmps.filter(e => e.complianceStatus === 'amber').length

  // Attrition rate: employees whose endDate fell in the last 12 months / avg headcount
  const twelveMonthsAgo = new Date(now)
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().slice(0, 10)
  const separatedLast12 = allEmployees.filter(
    e => e.endDate && e.endDate >= twelveMonthsAgoStr && e.endDate <= today
  ).length
  const avgHeadcount = total > 0 ? (total + active) / 2 : 1
  const attritionRatePct = parseFloat(((separatedLast12 / avgHeadcount) * 100).toFixed(1))

  // Attendance rate: proportion of approved leave days this month vs expected working days
  // Expected = active employees × 22 business days per month (industry estimate)
  const expectedDaysThisMonth = active * 22
  const approvedLeaveDaysThisMonth = parseInt(String(approvedMonthRow?.days ?? '0')) || 0
  const attendanceRatePct = expectedDaysThisMonth > 0
    ? parseFloat((((expectedDaysThisMonth - approvedLeaveDaysThisMonth) / expectedDaysThisMonth) * 100).toFixed(1))
    : 100

  // ── 2. Payroll ────────────────────────────────────────────────────────────
  // YTD totals (approved/paid records)
  const [ytdRow] = await db
    .select({
      ytdGross: sum(payrollRecords.grossPay),
      ytdNet:   sum(payrollRecords.netPay),
      ytdSuper: sum(payrollRecords.superContribution),
    })
    .from(payrollRecords)
    .where(and(
      eq(payrollRecords.tenantId, tid),
      gte(payrollRecords.periodStart, yearStart),
    ))

  // Last pay run — find the most recent periodEnd
  const lastRunRows = await db
    .select({
      periodStart:       payrollRecords.periodStart,
      periodEnd:         payrollRecords.periodEnd,
      grossPay:          payrollRecords.grossPay,
      netPay:            payrollRecords.netPay,
      superContribution: payrollRecords.superContribution,
    })
    .from(payrollRecords)
    .where(eq(payrollRecords.tenantId, tid))
    .orderBy(sql`${payrollRecords.periodEnd} DESC`)
    .limit(500)    // grab enough to aggregate the last run

  // Group by periodEnd to find latest run
  let lastRunPeriodEnd: string | null = null
  if (lastRunRows.length > 0) lastRunPeriodEnd = lastRunRows[0].periodEnd

  const lastRunRecords = lastRunRows.filter(r => r.periodEnd === lastRunPeriodEnd)
  const lastRunGross = lastRunRecords.reduce((s, r) => s + parseFloat(r.grossPay ?? '0'), 0)
  const lastRunNet   = lastRunRecords.reduce((s, r) => s + parseFloat(r.netPay   ?? '0'), 0)
  const lastRunSuper = lastRunRecords.reduce((s, r) => s + parseFloat(r.superContribution ?? '0'), 0)
  const lastRunPeriodStart = lastRunRecords[0]?.periodStart ?? null

  // ── 3. Leave ─────────────────────────────────────────────────────────────
  const [pendingRow] = await db
    .select({ cnt: count() })
    .from(leaveRequests)
    .where(and(
      eq(leaveRequests.tenantId, tid),
      eq(leaveRequests.status, 'pending'),
    ))

  const [approvedMonthRow] = await db
    .select({ days: sum(leaveRequests.totalDays) })
    .from(leaveRequests)
    .where(and(
      eq(leaveRequests.tenantId, tid),
      eq(leaveRequests.status, 'approved'),
      gte(leaveRequests.startDate, monthStart),
      lte(leaveRequests.startDate, monthEnd),
    ))

  const [approvedYearRow] = await db
    .select({ days: sum(leaveRequests.totalDays) })
    .from(leaveRequests)
    .where(and(
      eq(leaveRequests.tenantId, tid),
      eq(leaveRequests.status, 'approved'),
      gte(leaveRequests.startDate, yearStart),
    ))

  // ── 4. Public Holidays ────────────────────────────────────────────────────
  const upcomingHolidays = await db
    .select({
      name:    publicHolidays.name,
      date:    publicHolidays.date,
      country: publicHolidays.country,
    })
    .from(publicHolidays)
    .where(and(
      eq(publicHolidays.tenantId, tid),
      gte(publicHolidays.date, today),
    ))
    .orderBy(publicHolidays.date)
    .limit(5)

  // ── 5. Documents ─────────────────────────────────────────────────────────
  const [expiring30Row] = await db
    .select({ cnt: count() })
    .from(documents)
    .where(and(
      eq(documents.tenantId, tid),
      eq(documents.status, 'active'),
      gte(documents.expiryDate, today),
      lte(documents.expiryDate, in30Days),
    ))

  const [expiredActiveRow] = await db
    .select({ cnt: count() })
    .from(documents)
    .where(and(
      eq(documents.tenantId, tid),
      eq(documents.status, 'active'),
      lt(documents.expiryDate, today),
    ))

  // ── 6. WHS Incidents ──────────────────────────────────────────────────────
  const [openIncidentsRow] = await db
    .select({ cnt: count() })
    .from(whsIncidents)
    .where(and(
      eq(whsIncidents.tenantId, tid),
      eq(whsIncidents.status, 'open'),
    ))

  const [criticalRow] = await db
    .select({ cnt: count() })
    .from(whsIncidents)
    .where(and(
      eq(whsIncidents.tenantId, tid),
      eq(whsIncidents.status, 'open'),
      eq(whsIncidents.severity, 'critical'),
    ))

  // ── Assemble ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    headcount: {
      total,
      active,
      byEntity:         Object.entries(entityMap).map(([name, count]) => ({ name, count })),
      byEmploymentType: Object.entries(typeMap).map(([type, count]) => ({ type, count })),
      newThisMonth,
      leavingThisMonth,
      attritionRatePct,
      attendanceRatePct,
    },
    payroll: {
      lastRunPeriodStart,
      lastRunPeriodEnd,
      lastRunCount:   lastRunRecords.length,
      lastRunGross:   lastRunGross.toFixed(2),
      lastRunNet:     lastRunNet.toFixed(2),
      lastRunSuper:   lastRunSuper.toFixed(2),
      ytdGross:       parseFloat(ytdRow?.ytdGross ?? '0').toFixed(2),
      ytdNet:         parseFloat(ytdRow?.ytdNet   ?? '0').toFixed(2),
      ytdSuper:       parseFloat(ytdRow?.ytdSuper ?? '0').toFixed(2),
    },
    leave: {
      pendingCount:          pendingRow?.cnt ?? 0,
      approvedDaysThisMonth: parseInt(approvedMonthRow?.days ?? '0') || 0,
      approvedDaysThisYear:  parseInt(approvedYearRow?.days  ?? '0') || 0,
    },
    holidays: {
      upcoming: upcomingHolidays,
    },
    documents: {
      expiringIn30Days: expiring30Row?.cnt ?? 0,
      expiredActive:    expiredActiveRow?.cnt ?? 0,
    },
    incidents: {
      open:         openIncidentsRow?.cnt ?? 0,
      openCritical: criticalRow?.cnt ?? 0,
    },
    compliance: {
      redCount,
      amberCount,
    },
    generatedAt: now.toISOString(),
  })
}
