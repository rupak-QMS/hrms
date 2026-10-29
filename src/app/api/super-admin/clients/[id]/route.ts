import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tenants, tenantModules, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { sendEmail, tenantEmailSettings } from '@/lib/email/resend'
import { tenantSuspendedEmail, tenantReactivatedEmail, tenantTierChangedEmail } from '@/lib/email/templates'
import { getSession } from '@/lib/auth/session'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/super-admin/clients/[id]
export async function GET(_: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id))
    if (!tenant) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const modules = await db.select().from(tenantModules).where(eq(tenantModules.tenantId, id))
    return NextResponse.json({ tenant, modules })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
  }
}

// PATCH /api/super-admin/clients/[id] — update tenant
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const body = await req.json()
    const { name, tier, isActive, logoUrl, primaryColor, settings } = body

    // Fetch existing settings so we can deep-merge instead of overwrite
    const [existing] = await db
      .select({ settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, id))

    const existingSettings = (existing?.settings ?? {}) as Record<string, unknown>

    // Only touch settings column when caller explicitly provides a settings object
    const newSettings = settings !== undefined
      ? { ...existingSettings, ...settings }
      : existingSettings

    const [updated] = await db
      .update(tenants)
      .set({
        ...(name         !== undefined && { name }),
        ...(tier         !== undefined && { tier }),
        ...(isActive     !== undefined && { isActive }),
        ...(logoUrl      !== undefined && { logoUrl }),
        ...(primaryColor !== undefined && { primaryColor }),
        settings: newSettings,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning()

    if (!updated) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Email notifications (fire-and-forget)
    try {
      const savedSettings = newSettings as Record<string, unknown>

      // Prefer the saved deploymentUrl, fall back to slug-based URL
      const loginUrl = (savedSettings.deploymentUrl as string | undefined)?.trim()
        || `https://${updated.slug}-hrmsapp.vercel.app`

      // Per-tenant email settings (Resend key, From address, Reply-To)
      const emailOpts = tenantEmailSettings(savedSettings)

      // Get tenant admin emails
      const admins = await db.select({ email: users.email })
        .from(users)
        .where(and(eq(users.tenantId, id), eq(users.isActive, true), eq(users.role, 'director')))
      const adminEmails = admins.map(a => a.email)

      if (adminEmails.length) {
        if (isActive === false) {
          const tmpl = tenantSuspendedEmail({ recipientName: 'Portal Admin', orgName: updated.name, loginUrl })
          sendEmail({ to: adminEmails, ...tmpl }, emailOpts).catch(console.error)
        } else if (isActive === true && existing) {
          const tmpl = tenantReactivatedEmail({ recipientName: 'Portal Admin', orgName: updated.name, loginUrl })
          sendEmail({ to: adminEmails, ...tmpl }, emailOpts).catch(console.error)
        }
        if (tier !== undefined && existing) {
          const prev = await db.select({ tier: tenants.tier }).from(tenants).where(eq(tenants.id, id))
          if (prev[0]?.tier && prev[0].tier !== tier) {
            const tmpl = tenantTierChangedEmail({ recipientName: 'Portal Admin', orgName: updated.name, oldTier: prev[0].tier, newTier: tier, loginUrl })
            sendEmail({ to: adminEmails, ...tmpl }, emailOpts).catch(console.error)
          }
        }
      }
    } catch (emailErr) { console.error('Tenant status email error:', emailErr) }

    return NextResponse.json({ tenant: updated })
  } catch (error) {
    console.error('PATCH client error:', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }
}

// DELETE /api/super-admin/clients/[id]
export async function DELETE(_: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    await db.delete(tenants).where(eq(tenants.id, id))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 })
  }
}
