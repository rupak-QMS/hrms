import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { payrollRecords, employees } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET /api/tenant/payroll/[id]
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  try {
    const guard = await apiGuard('payroll:read')
    if (guard.error) return guard.error
    const { session } = guard

    const [record] = await db
      .select({
        id:                payrollRecords.id,
        employeeId:        payrollRecords.employeeId,
        periodStart:       payrollRecords.periodStart,
        periodEnd:         payrollRecords.periodEnd,
        hoursWorked:       payrollRecords.hoursWorked,
        hourlyRate:        payrollRecords.hourlyRate,
        grossPay:          payrollRecords.grossPay,
        paygWithholding:   payrollRecords.paygWithholding,
        medicareLevy:      payrollRecords.medicareLevy,
        superContribution: payrollRecords.superContribution,
        netPay:            payrollRecords.netPay,
        payslipData:       payrollRecords.payslipData,
        status:            payrollRecords.status,
        exportedToXero:    payrollRecords.exportedToXero,
        exportedAt:        payrollRecords.exportedAt,
        createdAt:         payrollRecords.createdAt,
        employeeFirstName: employees.firstName,
        employeeLastName:  employees.lastName,
        employeeEmail:     employees.email,
        employeeEntityName: employees.entityName,
      })
      .from(payrollRecords)
      .leftJoin(employees, eq(payrollRecords.employeeId, employees.id))
      .where(and(eq(payrollRecords.id, id), eq(payrollRecords.tenantId, session.tenantId)))

    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ record })
  } catch (err) {
    console.error('GET /api/tenant/payroll/[id]', err)
    return NextResponse.json({ error: 'Failed to fetch record' }, { status: 500 })
  }
}

// DELETE /api/tenant/payroll/[id]
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const guard = await apiGuard('payroll:write')
  if (guard.error) return guard.error
  const { session } = guard

  const [existing] = await db
    .select({ id: payrollRecords.id, status: payrollRecords.status })
    .from(payrollRecords)
    .where(and(eq(payrollRecords.id, id), eq(payrollRecords.tenantId, session.tenantId)))

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending pay runs can be deleted' }, { status: 409 })
  }

  await db.delete(payrollRecords).where(and(eq(payrollRecords.id, id), eq(payrollRecords.tenantId, session.tenantId)))
  return NextResponse.json({ ok: true })
}
