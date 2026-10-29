import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { departments } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  parentId:    z.string().uuid().optional().nullable(),
  isActive:    z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ deptId: string }> }
) {
  try {
    const guard = await apiGuard('departments:write')
    if (guard.error) return guard.error
    const { session } = guard
    const { deptId } = await params

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const [row] = await db
      .update(departments)
      .set({ ...data, ...(data.name ? { name: data.name } : {}) })
      .where(and(eq(departments.id, deptId), eq(departments.tenantId, session.tenantId)))
      .returning({ id: departments.id, name: departments.name, isActive: departments.isActive })

    if (!row) return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    return NextResponse.json({ department: row })
  } catch (err) {
    console.error('[departments PATCH]', err)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ deptId: string }> }
) {
  try {
    const guard = await apiGuard('departments:write')
    if (guard.error) return guard.error
    const { session } = guard
    const { deptId } = await params

    // Soft delete
    const [row] = await db
      .update(departments)
      .set({ isActive: false })
      .where(and(eq(departments.id, deptId), eq(departments.tenantId, session.tenantId)))
      .returning({ id: departments.id })

    if (!row) return NextResponse.json({ error: 'Department not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[departments DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
  }
}
