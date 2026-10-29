import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { departments, employees } from '@/lib/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const guard = await apiGuard('departments:read')
    if (guard.error) return guard.error
    const { session } = guard

    const { searchParams } = req.nextUrl
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const parentId        = searchParams.get('parentId')  // null = top-level only, 'all' = all

    const conditions = [eq(departments.tenantId, session.tenantId)]
    if (!includeInactive) conditions.push(eq(departments.isActive, true))
    if (parentId && parentId !== 'all') {
      conditions.push(eq(departments.parentId, parentId))
    }

    const rows = await db
      .select({
        id:          departments.id,
        name:        departments.name,
        description: departments.description,
        parentId:    departments.parentId,
        isActive:    departments.isActive,
        // headcount
        headcount:   sql<number>`(
          SELECT COUNT(*)::int FROM hrms_employees e
          WHERE e.department_id = ${departments.id}
            AND e.tenant_id = ${departments.tenantId}
            AND e.is_active = true
        )`.as('headcount'),
      })
      .from(departments)
      .where(and(...conditions))
      .orderBy(asc(departments.name))

    return NextResponse.json({ departments: rows })
  } catch (err) {
    console.error('[departments GET]', err)
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 })
  }
}

const DepartmentSchema = z.object({
  name:        z.string().min(1).max(200),
  description: z.string().optional(),
  parentId:    z.string().uuid().optional().nullable(),
  isActive:    z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('departments:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const parsed = DepartmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const [row] = await db
      .insert(departments)
      .values({
        tenantId:    session.tenantId,
        name:        data.name,
        description: data.description ?? null,
        parentId:    data.parentId ?? null,
        isActive:    data.isActive,
      })
      .returning({
        id: departments.id, name: departments.name,
        parentId: departments.parentId, isActive: departments.isActive,
      })

    return NextResponse.json({ department: row }, { status: 201 })
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'A department with this name already exists' }, { status: 409 })
    }
    console.error('[departments POST]', err)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}
