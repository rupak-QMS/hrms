import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { leaveRequests, employees } from '@/lib/db/schema'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { hasPermission } from '@/lib/auth/permissions'
import { getTenantEmailCtx, getTenantRoleEmails, fireEmail } from '@/lib/email/emailHelper'
import { genericNotificationEmail } from '@/lib/email/templates'
import { notify, notifyRole } from '@/lib/notifications/notify'

export const dynamic = 'force-dynamic'

// ── GET /api/tenant/leave ─────────────────────────────────────────────────────
// Managers (leave:approve) see all requests; employees see only their own.
// Query params: status, employeeId, leaveType, from (date), to (date)
export async function GET(req: NextRequest) {
  try {
  const guard = await apiGuard('leave:read')
  if (guard.error) return guard.error
  const { session } = guard

  const { searchParams } = req.nextUrl
  const filterStatus     = searchParams.get('status')
  const filterEmployeeId = searchParams.get('employeeId')
  const filterType       = searchParams.get('leaveType')
  const filterFrom       = searchParams.get('from')
  const filterTo         = searchParams.get('to')

  const canApprove = hasPermission(session.userRole, 'leave:approve')

  // If employee-only role, scope to their own employee record
  let scopedEmployeeId: string | null = null
  if (!canApprove) {
    // Find employee record linked to this user (by userId = session.sub)
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.tenantId, session.tenantId), eq(employees.userId, session.sub)))
    if (!emp) return NextResponse.json({ requests: [], stats: zeroStats() })
    scopedEmployeeId = emp.id
  }

  const conditions = [eq(leaveRequests.tenantId, session.tenantId)]

  if (scopedEmployeeId) {
    conditions.push(eq(leaveRequests.employeeId, scopedEmployeeId))
  } else if (filterEmployeeId) {
    conditions.push(eq(leaveRequests.employeeId, filterEmployeeId))
  }

  if (filterStatus) conditions.push(eq(leaveRequests.status, filterStatus as 'pending' | 'approved' | 'rejected' | 'cancelled'))
  if (filterType)   conditions.push(eq(leaveRequests.leaveType, filterType as 'annual' | 'sick' | 'personal' | 'unpaid' | 'long_service' | 'carer' | 'compassionate'))
  if (filterFrom)   conditions.push(gte(leaveRequests.startDate, filterFrom))
  if (filterTo)     conditions.push(lte(leaveRequests.endDate, filterTo))

  const rows = await db
    .select({
      id:             leaveRequests.id,
      employeeId:     leaveRequests.employeeId,
      leaveType:      leaveRequests.leaveType,
      startDate:      leaveRequests.startDate,
      endDate:        leaveRequests.endDate,
      totalDays:      leaveRequests.totalDays,
      reason:         leaveRequests.reason,
      status:         leaveRequests.status,
      reviewedBy:     leaveRequests.reviewedBy,
      reviewedAt:     leaveRequests.reviewedAt,
      reviewNote:     leaveRequests.reviewNote,
      createdAt:      leaveRequests.createdAt,
      updatedAt:      leaveRequests.updatedAt,
      employeeFirstName: employees.firstName,
      employeeLastName:  employees.lastName,
      employeeEmail:     employees.email,
    })
    .from(leaveRequests)
    .leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.createdAt))

  // Summary stats (scoped the same way)
  const all = await db
    .select({ status: leaveRequests.status, totalDays: leaveRequests.totalDays })
    .from(leaveRequests)
    .where(
      scopedEmployeeId
        ? and(eq(leaveRequests.tenantId, session.tenantId), eq(leaveRequests.employeeId, scopedEmployeeId))
        : eq(leaveRequests.tenantId, session.tenantId),
    )

  const stats = {
    total:     all.length,
    pending:   all.filter(r => r.status === 'pending').length,
    approved:  all.filter(r => r.status === 'approved').length,
    rejected:  all.filter(r => r.status === 'rejected').length,
    cancelled: all.filter(r => r.status === 'cancelled').length,
    totalDaysApproved: all.filter(r => r.status === 'approved').reduce((s, r) => s + (r.totalDays ?? 0), 0),
  }

  return NextResponse.json({ requests: rows, stats })
  } catch (err: any) {
    console.error('[leave GET]', err)
    return NextResponse.json({ error: 'Failed to fetch leave requests', detail: err?.message ?? String(err), cause: err?.cause?.message ?? null }, { status: 500 })
  }
}

// ── POST /api/tenant/leave ────────────────────────────────────────────────────
// Any authenticated tenant user can submit a leave request for themselves.
// Managers can submit on behalf of another employee by passing employeeId.
export async function POST(req: NextRequest) {
  try {
  const guard = await apiGuard('leave:write')
  if (guard.error) return guard.error
  const { session } = guard

  const body = await req.json()
  const { employeeId, leaveType, startDate, endDate, totalDays, reason } = body

  if (!leaveType || !startDate || !endDate || !totalDays) {
    return NextResponse.json({ error: 'leaveType, startDate, endDate, totalDays are required' }, { status: 400 })
  }

  const canApprove = hasPermission(session.userRole, 'leave:approve')

  let resolvedEmployeeId: string = employeeId

  if (!canApprove || !employeeId) {
    // Resolve to requesting user's own employee record
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.tenantId, session.tenantId), eq(employees.userId, session.sub)))
    if (!emp) return NextResponse.json({ error: 'No employee profile found for your account. Please ask an admin to create your employee record, or select a specific employee from the dropdown.' }, { status: 404 })
    resolvedEmployeeId = emp.id
  }

  const [created] = await db
    .insert(leaveRequests)
    .values({
      tenantId:   session.tenantId,
      employeeId: resolvedEmployeeId,
      leaveType,
      startDate,
      endDate,
      totalDays:  Number(totalDays),
      reason:     reason ?? null,
      status:     'pending',
    })
    .returning()

  // In-app notification → managers
  notifyRole(
    session.tenantId,
    ['director', 'hr_officer', 'operations_manager', 'team_leader'],
    {
      type:  'leave',
      title: 'New leave request pending approval',
      body:  `A ${created.leaveType} leave request (${created.startDate} → ${created.endDate}, ${created.totalDays} day${created.totalDays === 1 ? '' : 's'}) needs your review.`,
      link:  '/tenant/leave',
    },
  )

  // Email notification → managers with leave:approve
  ;(async () => {
    try {
      const ctx = await getTenantEmailCtx(session.tenantId)
      if (!ctx.notify.emailPayroll) return
      const [emp] = await db
        .select({ firstName: employees.firstName, lastName: employees.lastName })
        .from(employees)
        .where(eq(employees.id, created.employeeId))
      const managerEmails = await getTenantRoleEmails(session.tenantId, ['director', 'hr_officer', 'operations_manager', 'team_leader'])
      if (!managerEmails.length || !emp) return
      const tmpl = genericNotificationEmail({
        recipientName: 'HR Team',
        orgName:       ctx.orgName,
        logoUrl:       ctx.logoUrl,
        primaryColor:  ctx.primaryColor,
        title:         'New leave request pending approval',
        message:       `${emp.firstName} ${emp.lastName} has submitted a ${created.leaveType} leave request from ${created.startDate} to ${created.endDate} (${created.totalDays} day${created.totalDays === 1 ? '' : 's'}).${created.reason ? ` Reason: ${created.reason}` : ''}`,
        ctaLabel: 'Review leave request',
        ctaUrl:   `${ctx.loginUrl}/tenant/leave`,
      })
      fireEmail(ctx, { to: managerEmails, ...tmpl })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({ request: created }, { status: 201 })
  } catch (err: any) {
    console.error('[leave POST]', err)
    return NextResponse.json({ error: 'Failed to submit leave request', detail: err?.message ?? String(err), cause: err?.cause?.message ?? null }, { status: 500 })
  }
}

// ── PATCH /api/tenant/leave ───────────────────────────────────────────────────
// approve / reject — requires leave:approve
// cancel           — requires leave:write (own request only, if still pending)
export async function PATCH(req: NextRequest) {
  try {
  const guard = await apiGuard('leave:read')   // minimum read; further checked below
  if (guard.error) return guard.error
  const { session } = guard

  const body   = await req.json()
  const { id, action, reviewNote } = body   // action: 'approve' | 'reject' | 'cancel'

  if (!id || !action) return NextResponse.json({ error: 'id and action are required' }, { status: 400 })

  const [existing] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id, id), eq(leaveRequests.tenantId, session.tenantId)))

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canApprove = hasPermission(session.userRole, 'leave:approve')

  if (action === 'approve' || action === 'reject') {
    if (!canApprove) return NextResponse.json({ error: 'Forbidden — requires leave:approve' }, { status: 403 })
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: `Cannot ${action} a request that is already ${existing.status}` }, { status: 409 })
    }
    await db
      .update(leaveRequests)
      .set({
        status:     action === 'approve' ? 'approved' : 'rejected',
        reviewedBy: session.sub,
        reviewedAt: new Date(),
        reviewNote: reviewNote ?? null,
        updatedAt:  new Date(),
      })
      .where(eq(leaveRequests.id, id))

    const approved = action === 'approve'

    // In-app notification → employee (via employees.userId → users.id)
    ;(async () => {
      try {
        const [emp] = await db
          .select({ userId: employees.userId, firstName: employees.firstName, lastName: employees.lastName, email: employees.email })
          .from(employees)
          .where(eq(employees.id, existing.employeeId))
        if (!emp) return

        if (emp.userId) {
          notify(session.tenantId, emp.userId, {
            type:  'leave',
            title: approved ? 'Leave request approved' : 'Leave request not approved',
            body:  approved
              ? `Your ${existing.leaveType} leave (${existing.startDate} → ${existing.endDate}) has been approved.${reviewNote ? ` Note: ${reviewNote}` : ''}`
              : `Your ${existing.leaveType} leave (${existing.startDate} → ${existing.endDate}) was not approved.${reviewNote ? ` Reason: ${reviewNote}` : ''}`,
            link: '/tenant/leave',
          })
        }

        // Email notification
        if (!emp?.email) return
        const ctx = await getTenantEmailCtx(session.tenantId)
        if (!ctx.notify.emailPayroll) return
        const tmpl = genericNotificationEmail({
          recipientName: `${emp.firstName} ${emp.lastName}`,
          orgName:       ctx.orgName,
          logoUrl:       ctx.logoUrl,
          primaryColor:  ctx.primaryColor,
          title:         approved ? 'Leave request approved ✅' : 'Leave request not approved',
          message:       approved
            ? `Your leave request (${existing.leaveType}, ${existing.startDate} to ${existing.endDate}) has been approved.${reviewNote ? ` Note from manager: ${reviewNote}` : ''}`
            : `Your leave request (${existing.leaveType}, ${existing.startDate} to ${existing.endDate}) was not approved.${reviewNote ? ` Reason: ${reviewNote}` : ' Please contact HR for more information.'}`,
          ctaLabel: 'View leave portal',
          ctaUrl:   `${ctx.loginUrl}/tenant/leave`,
        })
        fireEmail(ctx, { to: emp.email, ...tmpl })
      } catch { /* non-blocking */ }
    })()

    return NextResponse.json({ ok: true })
  }

  if (action === 'cancel') {
    if (!hasPermission(session.userRole, 'leave:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 409 })
    }
    // Non-managers can only cancel their own requests
    if (!canApprove) {
      const [emp] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.tenantId, session.tenantId), eq(employees.userId, session.sub)))
      if (!emp || emp.id !== existing.employeeId) {
        return NextResponse.json({ error: 'Forbidden — can only cancel your own requests' }, { status: 403 })
      }
    }
    await db
      .update(leaveRequests)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(leaveRequests.id, id))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[leave PATCH]', err)
    return NextResponse.json({ error: 'Failed to update leave request', detail: err?.message ?? String(err), cause: err?.cause?.message ?? null }, { status: 500 })
  }
}

function zeroStats() {
  return { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0, totalDaysApproved: 0 }
}
