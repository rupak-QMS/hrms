import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { branches, employees } from '@/lib/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const guard = await apiGuard('branches:read')
    if (guard.error) return guard.error
    const { session } = guard

    const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true'
    const conditions = [eq(branches.tenantId, session.tenantId)]
    if (!includeInactive) conditions.push(eq(branches.isActive, true))

    const rows = await db
      .select({
        id:        branches.id,
        name:      branches.name,
        code:      branches.code,
        address:   branches.address,
        suburb:    branches.suburb,
        state:     branches.state,
        postcode:  branches.postcode,
        country:   branches.country,
        phone:     branches.phone,
        email:     branches.email,
        managerId: branches.managerId,
        isActive:  branches.isActive,
        headcount: sql<number>`(
          SELECT COUNT(*)::int FROM hrms_employees e
          WHERE e.branch_id = ${branches.id}
            AND e.tenant_id = ${branches.tenantId}
            AND e.is_active = true
        )`.as('headcount'),
        managerName: sql<string | null>`(
          SELECT e.first_name || ' ' || e.last_name
          FROM hrms_employees e WHERE e.id = ${branches.managerId}
        )`.as('manager_name'),
      })
      .from(branches)
      .where(and(...conditions))
      .orderBy(asc(branches.name))

    return NextResponse.json({ branches: rows })
  } catch (err) {
    console.error('[branches GET]', err)
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 })
  }
}

const BranchSchema = z.object({
  name:      z.string().min(1).max(200),
  code:      z.string().max(20).optional().nullable(),
  address:   z.string().optional().nullable(),
  suburb:    z.string().max(100).optional().nullable(),
  state:     z.string().max(50).optional().nullable(),
  postcode:  z.string().max(10).optional().nullable(),
  country:   z.string().max(100).default('Australia'),
  phone:     z.string().max(20).optional().nullable(),
  email:     z.string().email().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  isActive:  z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('branches:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const parsed = BranchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const [row] = await db
      .insert(branches)
      .values({ tenantId: session.tenantId, ...data })
      .returning({ id: branches.id, name: branches.name, code: branches.code })

    return NextResponse.json({ branch: row }, { status: 201 })
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'A branch with this code already exists' }, { status: 409 })
    }
    console.error('[branches POST]', err)
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 })
  }
}
