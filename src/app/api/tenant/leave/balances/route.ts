import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { leaveRequests, employees, tenants } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { hasPermission } from '@/lib/auth/permissions'
import { mergeLeaveTypes, entitlementDays, maxCarryForward, type LeaveTypeConfig } from '@/lib/leave/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tenant/leave/balances
 *
 * Returns leave balance per type for a specific employee and year,
 * including carry-forward from the previous year.
 *
 * Query params:
 *   employeeId  — required for managers; employees get their own automatically
 *   year        — defaults to current calendar year
 *
 * Response per leave type:
 *   {
 *     key, label, emoji, color, accrualNote,
 *     entitlement,      // base entitlement for the requested year
 *     carriedForward,   // days brought in from previous year (0 if none / not applicable)
 *     totalEntitlement, // entitlement + carriedForward
 *     taken,            // approved days used this year
 *     pending,          // pending days (eating into balance)
 *     remaining,        // totalEntitlement - taken - pending (floored at 0)
 *     maxCarryForwardDays, // null = unlimited, 0 = no carry-forward, N = cap
 *   }
 *
 * Carry-forward logic:
 *   prevYearRemaining = prevYearEntitlement - prevYearTaken  (floored at 0)
 *   carriedForward    = min(prevYearRemaining, maxCarryForwardDays)
 *   (maxCarryForwardDays null → no cap)
 */
export async function GET(req: NextRequest) {
  try {
  const guard = await apiGuard('leave:read')
  if (guard.error) return guard.error
  const { session } = guard

  const { searchParams } = req.nextUrl
  const year    = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const from    = `${year}-01-01`
  const to      = `${year}-12-31`
  const prevFrom = `${year - 1}-01-01`
  const prevTo   = `${year - 1}-12-31`

  const canApprove = hasPermission(session.userRole, 'leave:approve')

  // ── Resolve target employee ────────────────────────────────────────────────
  let targetEmployeeId = searchParams.get('employeeId')
  let employmentType   = 'full_time'

  if (!canApprove || !targetEmployeeId) {
    const [emp] = await db
      .select({ id: employees.id, employmentType: employees.employmentType })
      .from(employees)
      .where(and(
        eq(employees.tenantId, session.tenantId),
        eq(employees.userId,   session.sub as string),
      ))
    if (!emp) return NextResponse.json({ balances: [], employeeLinked: false })
    targetEmployeeId = emp.id
    employmentType   = emp.employmentType
  } else {
    const [emp] = await db
      .select({ id: employees.id, employmentType: employees.employmentType })
      .from(employees)
      .where(and(
        eq(employees.id,       targetEmployeeId),
        eq(employees.tenantId, session.tenantId),
      ))
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    employmentType = emp.employmentType
  }

  // ── Load leave type config ─────────────────────────────────────────────────
  const [tenantRow] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, session.tenantId))

  const saved   = ((tenantRow?.settings as Record<string, unknown> | null)?.leaveTypes ?? []) as Partial<LeaveTypeConfig>[]
  const configs = mergeLeaveTypes(saved).filter(t => t.isActive)

  // ── Fetch this year's requests ─────────────────────────────────────────────
  const thisYearRows = await db
    .select({
      leaveType: leaveRequests.leaveType,
      totalDays: leaveRequests.totalDays,
      status:    leaveRequests.status,
    })
    .from(leaveRequests)
    .where(and(
      eq(leaveRequests.tenantId,   session.tenantId),
      eq(leaveRequests.employeeId, targetEmployeeId),
      gte(leaveRequests.startDate, from),
      lte(leaveRequests.startDate, to),
    ))

  // ── Fetch previous year's approved requests (for carry-forward) ────────────
  const prevYearRows = await db
    .select({
      leaveType: leaveRequests.leaveType,
      totalDays: leaveRequests.totalDays,
      status:    leaveRequests.status,
    })
    .from(leaveRequests)
    .where(and(
      eq(leaveRequests.tenantId,   session.tenantId),
      eq(leaveRequests.employeeId, targetEmployeeId),
      gte(leaveRequests.startDate, prevFrom),
      lte(leaveRequests.startDate, prevTo),
      eq(leaveRequests.status,     'approved'),
    ))

  // ── Compute balances ───────────────────────────────────────────────────────
  const balances = configs.map(cfg => {
    const isUncapped = cfg.key === 'unpaid'  // no balance concept

    const baseEntitlement = isUncapped ? null : entitlementDays(cfg, employmentType)

    // Previous year carry-forward
    let carriedForward = 0
    if (baseEntitlement !== null) {
      const maxCF = maxCarryForward(cfg)
      if (maxCF > 0) {
        const prevTaken = prevYearRows
          .filter(r => r.leaveType === cfg.key)
          .reduce((s, r) => s + (r.totalDays ?? 0), 0)
        const prevRemaining = Math.max(0, baseEntitlement - prevTaken)
        carriedForward = maxCF === Infinity
          ? prevRemaining
          : Math.min(prevRemaining, maxCF)
      }
    }

    const totalEntitlement = baseEntitlement === null ? null : baseEntitlement + carriedForward

    const typeRows = thisYearRows.filter(r => r.leaveType === cfg.key)
    const taken    = typeRows.filter(r => r.status === 'approved').reduce((s, r) => s + (r.totalDays ?? 0), 0)
    const pending  = typeRows.filter(r => r.status === 'pending').reduce((s, r)  => s + (r.totalDays ?? 0), 0)
    const remaining = totalEntitlement === null ? null : Math.max(0, totalEntitlement - taken - pending)

    return {
      key:               cfg.key,
      label:             cfg.label,
      emoji:             cfg.emoji,
      color:             cfg.color,
      accrualNote:       cfg.accrualNote,
      maxCarryForwardDays: cfg.maxCarryForwardDays,
      entitlement:       baseEntitlement,
      carriedForward,
      totalEntitlement,
      taken,
      pending,
      remaining,
    }
  })

  return NextResponse.json({
    balances,
    employeeId: targetEmployeeId,
    employmentType,
    year,
    employeeLinked: true,
  })
  } catch (err: any) {
    console.error('[leave/balances GET]', err)
    return NextResponse.json({ error: 'Failed to fetch leave balances', detail: err?.message ?? String(err), cause: err?.cause?.message ?? null }, { status: 500 })
  }
}
