import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { employees, departments, positions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/tenant/employees/[id]
export async function GET(_: NextRequest, ctx: Ctx) {
  const guard = await apiGuard('employees:read')
  if (guard.error) return guard.error
  const { session } = guard

  const { id } = await ctx.params
  try {
    const [emp] = await db
      .select({
        id:                  employees.id,
        tenantId:            employees.tenantId,
        employeeNumber:      employees.employeeNumber,
        firstName:           employees.firstName,
        lastName:            employees.lastName,
        preferredName:       employees.preferredName,
        dateOfBirth:         employees.dateOfBirth,
        gender:              employees.gender,
        phone:               employees.phone,
        email:               employees.email,
        address:             employees.address,
        photoUrl:            employees.photoUrl,
        entityName:          employees.entityName,
        departmentId:        employees.departmentId,
        positionId:          employees.positionId,
        employmentType:      employees.employmentType,
        awardClassification: employees.awardClassification,
        payLevel:            employees.payLevel,
        startDate:           employees.startDate,
        probationEndDate:    employees.probationEndDate,
        endDate:             employees.endDate,
        isActive:            employees.isActive,
        complianceStatus:    employees.complianceStatus,
        ndisWorker:           employees.ndisWorker,
        annualSalary:         employees.annualSalary,
        ordinaryHoursPerWeek: employees.ordinaryHoursPerWeek,
        createdAt:            employees.createdAt,
        updatedAt:            employees.updatedAt,
        departmentName:       departments.name,
        positionTitle:        positions.title,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(positions,   eq(employees.positionId,   positions.id))
      .where(and(eq(employees.id, id), eq(employees.tenantId, session.tenantId!)))

    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    return NextResponse.json({ employee: emp })
  } catch (err) {
    console.error('GET /api/tenant/employees/[id]', err)
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 })
  }
}

// PATCH /api/tenant/employees/[id]
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const guard = await apiGuard('employees:write')
  if (guard.error) return guard.error
  const { session } = guard

  const { id } = await ctx.params
  try {
    const body = await req.json()
    const allowed = [
      'firstName','lastName','preferredName','dateOfBirth','gender',
      'phone','email','address','photoUrl',
      'entityName','departmentId','positionId',
      'employmentType','awardClassification','payLevel',
      'startDate','probationEndDate','endDate',
      'isActive','complianceStatus','ndisWorker',
      'annualSalary','ordinaryHoursPerWeek',
    ]
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const [updated] = await db
      .update(employees)
      .set(updates)
      .where(and(eq(employees.id, id), eq(employees.tenantId, session.tenantId!)))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    return NextResponse.json({ employee: updated })
  } catch (err) {
    console.error('PATCH /api/tenant/employees/[id]', err)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

// DELETE /api/tenant/employees/[id] — soft-delete (set isActive=false)
export async function DELETE(_: NextRequest, ctx: Ctx) {
  const guard = await apiGuard('employees:delete')
  if (guard.error) return guard.error
  const { session } = guard

  const { id } = await ctx.params
  try {
    await db
      .update(employees)
      .set({ isActive: false, endDate: new Date().toISOString().split('T')[0], updatedAt: new Date(), deletedAt: new Date() })
      .where(and(eq(employees.id, id), eq(employees.tenantId, session.tenantId!)))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to deactivate employee' }, { status: 500 })
  }
}
