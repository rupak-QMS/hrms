/**
 * GET /api/tenant/leave/balance
 *
 * Returns computed leave balances for an employee. No extra table required —
 * everything is derived from `employees.startDate`, `employees.ordinaryHoursPerWeek`,
 * and approved `leaveRequests` in the current leave year.
 *
 * Leave year is anniversary-based (e.g. startDate = 2023-03-15 → leave year
 * runs 2025-03-15 → 2026-03-15 for an employee still in service in Jul 2026).
 *
 * Query params:
 *   employeeId — required for managers; omit to get own balance (employee role)
 *
 * Response:
 *   {
 *     employeeId, firstName, lastName,
 *     leaveYearStart, leaveYearEnd,
 *     annual:   { entitlement, accrued, used, remaining, pending },
 *     personal: { entitlement, accrued, used, remaining, pending },
 *     longService: { yearsOfService, eligible },
 *   }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { employees, leaveRequests } from '@/lib/db/schema'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { hasPermission } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

// Full-time annual entitlement (days/year) — NES minimum
const ANNUAL_DAYS_FT   = 20   // 4 weeks × 5 days
// Personal/carer's/sick leave entitlement (days/year) — NES minimum
const PERSONAL_DAYS_FT = 10

/** Return the start of the leave year that contains `today`, anchored on the
 *  employee's work anniversary. */
function leaveYearStartFor(startDate: Date, today: Date): Date {
  const anniversary = new Date(startDate)
  anniversary.setFullYear(today.getFullYear())
  // If this year's anniversary hasn't happened yet, use last year's
  if (anniversary > today) anniversary.setFullYear(today.getFullYear() - 1)
  return anniversary
}

function addOneYear(d: Date): Date {
  const x = new Date(d)
  x.setFullYear(x.getFullYear() + 1)
  return x
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const guard = await apiGuard('leave:read')
  if (guard.error) return guard.error
  const { session } = guard

  const canManage = hasPermission(session.userRole, 'leave:approve')
  const paramEmpId = req.nextUrl.searchParams.get('employeeId')

  try {
    let empId: string

    if (canManage && paramEmpId) {
      empId = paramEmpId
    } else {
      // Resolve the current user's own employee record
      const [emp] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.tenantId, session.tenantId), eq(employees.userId, session.sub)))
        .limit(1)

      if (!emp) {
        return NextResponse.json({ error: 'No employee record linked to your account' }, { status: 404 })
      }
      empId = emp.id
    }

    // Fetch employee
    const [emp] = await db
      .select({
        id:                   employees.id,
        firstName:            employees.firstName,
        lastName:             employees.lastName,
        startDate:            employees.startDate,
        ordinaryHoursPerWeek: employees.ordinaryHoursPerWeek,
        employmentType:       employees.employmentType,
      })
      .from(employees)
      .where(and(eq(employees.id, empId), eq(employees.tenantId, session.tenantId)))
      .limit(1)

    if (!emp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    if (!emp.startDate) {
      return NextResponse.json({ error: 'Employee has no start date recorded' }, { status: 422 })
    }

    const today      = new Date()
    const startDate  = new Date(emp.startDate + 'T00:00:00')
    const lyStart    = leaveYearStartFor(startDate, today)
    const lyEnd      = addOneYear(lyStart)

    // Days elapsed in the current leave year (capped at 365)
    const daysInYear  = daysBetween(lyStart, lyEnd)         // usually 365 or 366
    const daysElapsed = Math.min(daysBetween(lyStart, today), daysInYear)

    // Pro-rate fraction for part-time based on ordinary hours
    const hoursPerWeek  = Number(emp.ordinaryHoursPerWeek ?? 38)
    const fteRatio      = Math.min(hoursPerWeek / 38, 1)    // cap at 1.0

    // Entitlements (full year)
    const annualEntitlement   = +(ANNUAL_DAYS_FT   * fteRatio).toFixed(2)
    const personalEntitlement = +(PERSONAL_DAYS_FT * fteRatio).toFixed(2)

    // Accrued so far in leave year (pro-rata to days elapsed)
    const annualAccrued   = +(annualEntitlement   * (daysElapsed / daysInYear)).toFixed(2)
    const personalAccrued = +(personalEntitlement * (daysElapsed / daysInYear)).toFixed(2)

    // Fetch approved + pending leave requests in current leave year
    const lyStartStr = isoDate(lyStart)
    const lyEndStr   = isoDate(lyEnd)

    const requests = await db
      .select({
        leaveType:  leaveRequests.leaveType,
        totalDays:  leaveRequests.totalDays,
        status:     leaveRequests.status,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.tenantId, session.tenantId),
          eq(leaveRequests.employeeId, empId),
          inArray(leaveRequests.status, ['approved', 'pending']),
          gte(leaveRequests.startDate, lyStartStr),
          lte(leaveRequests.startDate, lyEndStr),
        )
      )

    // Annual leave types
    const ANNUAL_TYPES   = ['annual', 'long_service']
    // Personal leave types (NES groups these together)
    const PERSONAL_TYPES = ['sick', 'personal', 'carer', 'compassionate']

    let annualUsed = 0, annualPending = 0
    let personalUsed = 0, personalPending = 0

    for (const r of requests) {
      const days = Number(r.totalDays ?? 0)
      if (ANNUAL_TYPES.includes(r.leaveType)) {
        if (r.status === 'approved') annualUsed    += days
        else                         annualPending += days
      } else if (PERSONAL_TYPES.includes(r.leaveType)) {
        if (r.status === 'approved') personalUsed    += days
        else                         personalPending += days
      }
    }

    // Years of service for long service leave eligibility (typically 7–10 years in AU)
    const yearsOfService = +(daysBetween(startDate, today) / 365.25).toFixed(2)

    return NextResponse.json({
      employeeId:    empId,
      firstName:     emp.firstName,
      lastName:      emp.lastName,
      employmentType: emp.employmentType,
      fteRatio,
      leaveYearStart: lyStartStr,
      leaveYearEnd:   isoDate(new Date(lyEnd.getTime() - 86_400_000)), // inclusive end
      annual: {
        entitlement: annualEntitlement,
        accrued:     annualAccrued,
        used:        +annualUsed.toFixed(2),
        pending:     +annualPending.toFixed(2),
        remaining:   +(annualAccrued - annualUsed).toFixed(2),
      },
      personal: {
        entitlement: personalEntitlement,
        accrued:     personalAccrued,
        used:        +personalUsed.toFixed(2),
        pending:     +personalPending.toFixed(2),
        remaining:   +(personalAccrued - personalUsed).toFixed(2),
      },
      longService: {
        yearsOfService,
        eligible: yearsOfService >= 7,
      },
    })
  } catch (err: any) {
    console.error('[leave/balance GET]', err)
    return NextResponse.json({ error: err?.message ?? String(err), cause: err?.cause?.message ?? null }, { status: 500 })
  }
}
