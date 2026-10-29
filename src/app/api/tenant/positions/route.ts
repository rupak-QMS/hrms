import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { positions, departments } from '@/lib/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const guard = await apiGuard('positions:read')
    if (guard.error) return guard.error
    const { session } = guard

    const { searchParams } = req.nextUrl
    const departmentId    = searchParams.get('departmentId')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const conditions = [eq(positions.tenantId, session.tenantId)]
    if (!includeInactive) conditions.push(eq(positions.isActive, true))
    if (departmentId)     conditions.push(eq(positions.departmentId, departmentId))

    const rows = await db
      .select({
        id:                  positions.id,
        title:               positions.title,
        description:         positions.description,
        departmentId:        positions.departmentId,
        departmentName:      departments.name,
        isParticipantFacing: positions.isParticipantFacing,
        isRiskAssessed:      positions.isRiskAssessed,
        isKeyPersonnel:      positions.isKeyPersonnel,
        isWhsSensitive:      positions.isWhsSensitive,
        isActive:            positions.isActive,
        headcount:           sql<number>`(
          SELECT COUNT(*)::int FROM hrms_employees e
          WHERE e.position_id = ${positions.id}
            AND e.tenant_id = ${positions.tenantId}
            AND e.is_active = true
        )`.as('headcount'),
      })
      .from(positions)
      .leftJoin(departments, eq(departments.id, positions.departmentId!))
      .where(and(...conditions))
      .orderBy(asc(positions.title))

    return NextResponse.json({ positions: rows })
  } catch (err) {
    console.error('[positions GET]', err)
    return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
  }
}

const PositionSchema = z.object({
  title:               z.string().min(1).max(200),
  description:         z.string().optional().nullable(),
  departmentId:        z.string().uuid().optional().nullable(),
  isParticipantFacing: z.boolean().default(false),
  isRiskAssessed:      z.boolean().default(false),
  isKeyPersonnel:      z.boolean().default(false),
  isWhsSensitive:      z.boolean().default(false),
  isActive:            z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('positions:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const parsed = PositionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const [row] = await db
      .insert(positions)
      .values({ tenantId: session.tenantId, ...data })
      .returning({ id: positions.id, title: positions.title, departmentId: positions.departmentId })

    return NextResponse.json({ position: row }, { status: 201 })
  } catch (err) {
    console.error('[positions POST]', err)
    return NextResponse.json({ error: 'Failed to create position' }, { status: 500 })
  }
}
