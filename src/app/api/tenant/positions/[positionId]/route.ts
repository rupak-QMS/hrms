import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { positions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  title:               z.string().min(1).max(200).optional(),
  description:         z.string().optional().nullable(),
  departmentId:        z.string().uuid().optional().nullable(),
  isParticipantFacing: z.boolean().optional(),
  isRiskAssessed:      z.boolean().optional(),
  isKeyPersonnel:      z.boolean().optional(),
  isWhsSensitive:      z.boolean().optional(),
  isActive:            z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ positionId: string }> }
) {
  try {
    const guard = await apiGuard('positions:write')
    if (guard.error) return guard.error
    const { session } = guard
    const { positionId } = await params

    const body = await req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const [row] = await db
      .update(positions)
      .set(parsed.data)
      .where(and(eq(positions.id, positionId), eq(positions.tenantId, session.tenantId)))
      .returning({ id: positions.id, title: positions.title })

    if (!row) return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    return NextResponse.json({ position: row })
  } catch (err) {
    console.error('[positions PATCH]', err)
    return NextResponse.json({ error: 'Failed to update position' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ positionId: string }> }
) {
  try {
    const guard = await apiGuard('positions:write')
    if (guard.error) return guard.error
    const { session } = guard
    const { positionId } = await params

    const [row] = await db
      .update(positions)
      .set({ isActive: false })
      .where(and(eq(positions.id, positionId), eq(positions.tenantId, session.tenantId)))
      .returning({ id: positions.id })

    if (!row) return NextResponse.json({ error: 'Position not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[positions DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete position' }, { status: 500 })
  }
}
