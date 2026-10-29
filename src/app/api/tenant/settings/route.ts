import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tenants, tenantModules } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tenant/settings
 * Returns the tenant's settings JSONB blob + enabled modules.
 * Permission: settings:read (director / hr_officer / it_admin)
 */
export async function GET(_req: NextRequest) {
  try {
    const guard = await apiGuard('settings:read')
    if (guard.error) return guard.error
    const { session } = guard

    const [tenant] = await db
      .select({
        id:           tenants.id,
        name:         tenants.name,
        slug:         tenants.slug,
        tier:         tenants.tier,
        logoUrl:      tenants.logoUrl,
        primaryColor: tenants.primaryColor,
        isActive:     tenants.isActive,
        settings:     tenants.settings,
      })
      .from(tenants)
      .where(eq(tenants.id, session.tenantId))
      .limit(1)

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    const modules = await db
      .select()
      .from(tenantModules)
      .where(eq(tenantModules.tenantId, session.tenantId))
      .orderBy(tenantModules.moduleId)

    return NextResponse.json({ settings: tenant, modules })
  } catch (err) {
    console.error('[settings GET]', err)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

/**
 * PATCH /api/tenant/settings
 * Merges the request body into the tenant's settings JSONB and/or
 * updates top-level tenant fields (name, logoUrl, primaryColor).
 * Permission: settings:write (director / it_admin)
 */
export async function PATCH(req: NextRequest) {
  try {
    const guard = await apiGuard('settings:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const {
      name,
      logoUrl,
      primaryColor,
      settings: newSettings,
    } = body

    // Build update object — only include fields provided
    const updateFields: Record<string, any> = {
      updatedAt: new Date(),
    }
    if (name         !== undefined) updateFields.name         = name
    if (logoUrl      !== undefined) updateFields.logoUrl      = logoUrl
    if (primaryColor !== undefined) updateFields.primaryColor = primaryColor

    // Merge settings JSONB if provided
    if (newSettings !== undefined) {
      // Fetch current settings to merge
      const [current] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, session.tenantId))
        .limit(1)

      updateFields.settings = { ...(current?.settings as object ?? {}), ...newSettings }
    }

    const [updated] = await db
      .update(tenants)
      .set(updateFields)
      .where(eq(tenants.id, session.tenantId))
      .returning({
        id:           tenants.id,
        name:         tenants.name,
        logoUrl:      tenants.logoUrl,
        primaryColor: tenants.primaryColor,
        settings:     tenants.settings,
        updatedAt:    tenants.updatedAt,
      })

    return NextResponse.json({ settings: updated })
  } catch (err) {
    console.error('[settings PATCH]', err)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}

/**
 * PUT /api/tenant/settings/modules — toggle a module on/off
 * Body: { moduleId: number, moduleName: string, isEnabled: boolean }
 */
export async function PUT(req: NextRequest) {
  try {
    const guard = await apiGuard('settings:write')
    if (guard.error) return guard.error
    const { session } = guard

    const { moduleId, moduleName, isEnabled } = await req.json()
    if (moduleId === undefined || isEnabled === undefined) {
      return NextResponse.json({ error: 'moduleId and isEnabled are required' }, { status: 400 })
    }

    const existing = await db
      .select({ id: tenantModules.id })
      .from(tenantModules)
      .where(and(eq(tenantModules.tenantId, session.tenantId), eq(tenantModules.moduleId, moduleId)))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(tenantModules)
        .set({ isEnabled, updatedAt: new Date(), updatedBy: session.userId })
        .where(and(eq(tenantModules.tenantId, session.tenantId), eq(tenantModules.moduleId, moduleId)))
    } else {
      await db
        .insert(tenantModules)
        .values({
          tenantId:   session.tenantId,
          moduleId:   moduleId,
          moduleName: moduleName ?? `Module ${moduleId}`,
          isEnabled,
          updatedBy:  session.userId,
        })
    }

    return NextResponse.json({ success: true, moduleId, isEnabled })
  } catch (err) {
    console.error('[settings PUT modules]', err)
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 })
  }
}
