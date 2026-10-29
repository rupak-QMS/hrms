import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tenantModules } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

type RouteContext = { params: Promise<{ id: string }> }

// GET — list all modules for a tenant
export async function GET(_: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const modules = await db
      .select()
      .from(tenantModules)
      .where(eq(tenantModules.tenantId, id))
      .orderBy(tenantModules.moduleId)
    return NextResponse.json({ modules })
  } catch (err) {
    console.error('[client-modules] GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch modules', detail: String(err) }, { status: 500 })
  }
}

// PATCH — toggle a module on/off
// Body: { moduleId: number, isEnabled: boolean }
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const { moduleId, isEnabled } = await req.json()

    const [updated] = await db
      .update(tenantModules)
      .set({ isEnabled, updatedAt: new Date() })
      .where(
        and(
          eq(tenantModules.tenantId, id),
          eq(tenantModules.moduleId, moduleId)
        )
      )
      .returning()

    return NextResponse.json({ module: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 })
  }
}

// POST — bulk update modules
// Body: { modules: { moduleId: number, isEnabled: boolean }[] }
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const { modules } = await req.json()
    const results = []
    for (const mod of modules) {
      const [updated] = await db
        .update(tenantModules)
        .set({ isEnabled: mod.isEnabled, updatedAt: new Date() })
        .where(
          and(
            eq(tenantModules.tenantId, id),
            eq(tenantModules.moduleId, mod.moduleId)
          )
        )
        .returning()
      results.push(updated)
    }
    return NextResponse.json({ modules: results })
  } catch {
    return NextResponse.json({ error: 'Failed to update modules' }, { status: 500 })
  }
}
