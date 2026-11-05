import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { leaveRequests, employees, tenants } from '@/lib/db/schema'
import { eq, and, gte, lte, or } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { hasPermission } from '@/lib/auth/permissions'
import { mergeLeaveTypes, type LeaveTypeConfig } from '@/lib/leave/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tenant/leave/calendar
 *
 * Returns approved + pending leave events for a given month.
 * Managers see all employees; employees see only their own.
 *
 * Query params:
 *   year   — e.g. 2026 (defaults to current year)
 *   month  — 1-12 (defaults to current month)
 *
 * An event overlaps the month if:
 *   startDate <= lastDayOfMonth  AND  endDate >= firstDayOfMonth
 *
 * Response:
 *   events: [{ id, employeeId, employeeName, leaveType, label, emoji, color,
 *              startDate, endDate, totalDays, status }]
 *   year, month
 */
export async function GET(req: NextRequest) {
  try {
  const guard = await apiGuard('leave:read')
  if (guard.error) return guard.error
  const { session } = guard

  const { searchParams } = req.nextUrl
  const now   = new Date()
  const year  = parseInt(searchParams.get('year')  ?? String(now.getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))

  // Month window
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDayDate = new Date(year, month, 0)   // day 0 of next month = last day of this month
  const lastDay  = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`

  const canApprove = hasPermission(session.userRole, 'leave:approve')

  // If employee, scope to own record
  let scopedEmployeeId: string | null = null
  if (!canApprove) {
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(
        eq(employees.tenantId, session.tenantId),
        eq(employees.userId,   session.sub as string),
      ))
    if (!emp) return NextResponse.json({ events: [], year, month })
    scopedEmployeeId = emp.id
  }

  // Load leave type config for labels/colors
  const [tenantRow] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, session.tenantId))

  const saved   = ((tenantRow?.settings as Record<string, unknown> | null)?.leaveTypes ?? []) as Partial<LeaveTypeConfig>[]
  const configs = mergeLeaveTypes(saved)
  const cfgMap  = Object.fromEntries(configs.map(c => [c.key, c]))

  // Build conditions — events overlapping the month window
  const conditions = [
    eq(leaveRequests.tenantId, session.tenantId),
    // overlaps: startDate <= lastDay AND endDate >= firstDay
    lte(leaveRequests.startDate, lastDay),
    gte(leaveRequests.endDate,   firstDay),
    // only approved and pending
    or(
      eq(leaveRequests.status, 'approved'),
      eq(leaveRequests.status, 'pending'),
    )!,
  ]

  if (scopedEmployeeId) {
    conditions.push(eq(leaveRequests.employeeId, scopedEmployeeId))
  }

  const rows = await db
    .select({
      id:                leaveRequests.id,
      employeeId:        leaveRequests.employeeId,
      leaveType:         leaveRequests.leaveType,
      startDate:         leaveRequests.startDate,
      endDate:           leaveRequests.endDate,
      totalDays:         leaveRequests.totalDays,
      status:            leaveRequests.status,
      employeeFirstName: employees.firstName,
      employeeLastName:  employees.lastName,
    })
    .from(leaveRequests)
    .leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(leaveRequests.startDate)

  const events = rows.map(r => {
    const cfg = cfgMap[r.leaveType]
    return {
      id:           r.id,
      employeeId:   r.employeeId,
      employeeName: `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim(),
      leaveType:    r.leaveType,
      label:        cfg?.label ?? r.leaveType,
      emoji:        cfg?.emoji ?? '📅',
      color:        cfg?.color ?? '#0E3D52',
      startDate:    r.startDate,
      endDate:      r.endDate,
      totalDays:    r.totalDays,
      status:       r.status,
    }
  })

  return NextResponse.json({ events, year, month })
  } catch (err: any) {
    console.error('[leave/calendar GET]', err)
    return NextResponse.json({ error: 'Failed to fetch leave calendar', detail: err?.message ?? String(err), cause: err?.cause?.message ?? null }, { status: 500 })
  }
}
