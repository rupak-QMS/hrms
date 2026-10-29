import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { branches } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  name:      z.string().min(1).max(200).optional(),
  code:      z.string().max(20).optional().nullable(),
  address:   z.string().optional().nullable(),
  suburb:    z.string().max(100).optional().nullable(),
  state:     z.string().max(50).optional().nullable(),
  postcode:  z.string().max(10).optional().nullable(),
  country:   z.string().max(100).optional(),
  phone:     z.string().max(20).optional().nullable(),
  email:     z.string().email().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  isActive:  z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const guard = await apiGuard('branches:write')
    if (guard.error) return guard.error
    const { session } = guard
    const { branchId } = await params

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [row] = await db
      .update(branches)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, session.tenantId)))
      .returning({ id: branches.id, name: branches.name })

    if (!row) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    return NextResponse.json({ branch: row })
  } catch (err) {
    console.error('[branches PATCH]', err)
    return NextResponse.json({ error: 'Failed to update branch' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const guard = await apiGuard('branches:write')
    if (guard.error) return guard.error
    const { session } = guard
    const { branchId } = await params

    const [row] = await db
      .update(branches)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, session.tenantId)))
      .returning({ id: branches.id })

    if (!row) return NextResponse.json({ error: 'Branch not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[branches DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete branch' }, { status: 500 })
  }
}
