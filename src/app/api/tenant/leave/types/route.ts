import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { DEFAULT_LEAVE_TYPES, mergeLeaveTypes, type LeaveTypeConfig } from '@/lib/leave/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tenant/leave/types
 * Returns configured leave types for this tenant.
 * Merges tenant.settings.leaveTypes over system defaults.
 * Any authenticated tenant user can read this (used in the request form).
 */
export async function GET(req: NextRequest) {
  try {
  const guard = await apiGuard('leave:read')
  if (guard.error) return guard.error

  const [row] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, guard.session.tenantId))

  const showAll = req.nextUrl.searchParams.get('all') === '1'
  const saved   = ((row?.settings as Record<string, unknown> | null)?.leaveTypes ?? []) as Partial<LeaveTypeConfig>[]
  const merged  = mergeLeaveTypes(saved)
  const types   = showAll ? merged : merged.filter(t => t.isActive)

  return NextResponse.json({ types })
  } catch (err: any) {
    console.error('[leave/types GET]', err)
    return NextResponse.json({ error: 'Failed to fetch leave types', detail: err?.message ?? String(err), cause: err?.cause?.message ?? null }, { status: 500 })
  }
}

/**
 * PATCH /api/tenant/leave/types
 * HR managers update entitlement days, labels, and active status.
 * Body: { types: Partial<LeaveTypeConfig>[] }
 * Requires leave:approve permission.
 */
export async function PATCH(req: NextRequest) {
  try {
  const guard = await apiGuard('leave:approve')
  if (guard.error) return guard.error

  const body = await req.json()
  const incoming: Partial<LeaveTypeConfig>[] = body.types ?? []

  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: 'types must be an array' }, { status: 400 })
  }

  // Validate — only allow known keys
  const validKeys = new Set(DEFAULT_LEAVE_TYPES.map(t => t.key))
  for (const t of incoming) {
    if (t.key && !validKeys.has(t.key)) {
      return NextResponse.json({ error: `Unknown leave type key: ${t.key}` }, { status: 400 })
    }
  }

  const [current] = await db
    .select({ settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, guard.session.tenantId))

  const existing = (current?.settings ?? {}) as Record<string, unknown>

  await db.update(tenants)
    .set({ settings: { ...existing, leaveTypes: incoming }, updatedAt: new Date() })
    .where(eq(tenants.id, guard.session.tenantId))

  const merged = mergeLeaveTypes(incoming)
  return NextResponse.json({ types: merged })
  } catch (err: any) {
    console.error('[leave/types PATCH]', err)
    return NextResponse.json({ error: 'Failed to update leave types', detail: err?.message ?? String(err), cause: err?.cause?.message ?? null }, { status: 500 })
  }
}
