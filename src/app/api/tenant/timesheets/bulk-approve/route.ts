/**
 * POST /api/tenant/timesheets/bulk-approve
 *
 * Approve multiple timesheets in a single request.
 * Managers only (timesheets:approve permission).
 *
 * Body: { ids: string[] }
 * Response: { approved: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { timesheets, employees } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { hasPermission } from '@/lib/auth/permissions'
import { notify } from '@/lib/notifications/notify'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await apiGuard('timesheets:approve')
  if (guard.error) return guard.error
  const { session } = guard

  if (!hasPermission(session.userRole, 'timesheets:approve')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === 'string') : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required and must not be empty' }, { status: 400 })
  }

  const now = new Date()

  // Only approve timesheets that are pending or submitted (not already approved/rejected)
  const toApprove = await db
    .select({ id: timesheets.id, employeeId: timesheets.employeeId })
    .from(timesheets)
    .where(and(
      eq(timesheets.tenantId, session.tenantId),
      inArray(timesheets.id, ids),
      inArray(timesheets.status, ['pending', 'submitted']),
    ))

  if (toApprove.length === 0) {
    return NextResponse.json({ approved: 0 })
  }

  // Bulk update
  await db
    .update(timesheets)
    .set({
      status:         'approved',
      approvedBy:     session.sub,
      approvedAt:     now,
      rejectedReason: null,
      updatedAt:      now,
    })
    .where(and(
      eq(timesheets.tenantId, session.tenantId),
      inArray(timesheets.id, toApprove.map(t => t.id)),
    ))

  // Fire-and-forget notifications per employee (batched — avoids N+1)
  ;(async () => {
    // Group by employeeId to send one notification per employee
    const empMap = new Map<string, number>()
    for (const t of toApprove) {
      empMap.set(t.employeeId, (empMap.get(t.employeeId) ?? 0) + 1)
    }
    // Single batch query instead of one query per employee
    const empRows = await db
      .select({ id: employees.id, userId: employees.userId })
      .from(employees)
      .where(inArray(employees.id, Array.from(empMap.keys())))
    const userIdByEmpId = new Map(empRows.map(e => [e.id, e.userId]))
    for (const [employeeId, count] of empMap) {
      const userId = userIdByEmpId.get(employeeId)
      if (userId) {
        notify(session.tenantId, userId, {
          type:  'payroll',
          title: `${count} timesheet${count > 1 ? 's' : ''} approved`,
          body:  `${count} of your timesheet${count > 1 ? 's have' : ' has'} been approved.`,
          link:  '/tenant/timesheets',
        })
      }
    }
  })().catch(() => {})

  return NextResponse.json({ approved: toApprove.length })
}
