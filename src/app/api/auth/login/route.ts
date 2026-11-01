import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { superAdmins, users, tenants, auditLogs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { signToken, signTempToken, verifyToken } from '@/lib/auth/jwt'
import { sessionCookieOptions } from '@/lib/auth/session'
import bcrypt from 'bcryptjs'

function logAuth(req: NextRequest, tenantId: string, userId: string, action: string, extra?: Record<string, unknown>) {
  const ipAddress = req.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers?.get('x-real-ip') ?? null
  const userAgent = req.headers?.get('user-agent') ?? null
  db.insert(auditLogs).values({ tenantId, userId, action, resource: 'auth', ipAddress, userAgent, newValues: extra ?? null })
    .catch(err => console.error('[audit] login', err?.message))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // ── Impersonation shortcut (super admin "Login as Tenant") ──
    if (body.__impersonateToken) {
      const payload = await verifyToken(body.__impersonateToken)
      if (!payload || payload.role !== 'tenant_user') {
        return NextResponse.json({ error: 'Invalid impersonation token' }, { status: 401 })
      }
      const res = NextResponse.json({ ok: true, role: 'tenant_user', redirectTo: '/tenant/dashboard' })
      res.cookies.set(sessionCookieOptions(body.__impersonateToken))
      return res
    }

    const { email, password, tenantSlug } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // ── Super admin login (no tenantSlug, or slug === 'admin') ──
    if (!tenantSlug || tenantSlug === 'admin') {
      const [admin] = await db
        .select()
        .from(superAdmins)
        .where(eq(superAdmins.email, email.toLowerCase()))

      if (!admin || !admin.isActive) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const valid = await bcrypt.compare(password, admin.passwordHash)
      if (!valid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      // Update last login (best-effort — column may not exist in older DB migrations)
      await db.update(superAdmins)
        .set({ lastLoginAt: new Date() })
        .where(eq(superAdmins.id, admin.id))
        .catch(() => {})

      const token = await signToken({
        sub:   admin.id,
        email: admin.email,
        role:  'super_admin',
        name:  admin.name,
      })

      const res = NextResponse.json({ ok: true, role: 'super_admin', redirectTo: '/super-admin' })
      res.cookies.set(sessionCookieOptions(token))
      return res
    }

    // ── Tenant user login ──
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: 'Organisation not found or inactive' }, { status: 404 })
    }

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenant.id),
          eq(users.email, email.toLowerCase()),
        )
      )

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))
      .catch(() => {})

    const jwtPayload = {
      sub:        user.id,
      email:      user.email,
      role:       'tenant_user' as const,
      tenantId:   tenant.id,
      tenantSlug: tenant.slug,
      userRole:   user.role,
    }

    // ── 2FA gate ─────────────────────────────────────────────────────────────
    if (user.totpEnabled) {
      const tempToken = await signTempToken(jwtPayload)
      return NextResponse.json({ requires2FA: true, tempToken })
    }

    const token = await signToken(jwtPayload)

    logAuth(req, tenant.id, user.id, 'auth.login', { email: user.email, role: user.role })

    const res = NextResponse.json({ ok: true, role: 'tenant_user', redirectTo: '/tenant/dashboard' })
    res.cookies.set(sessionCookieOptions(token))
    // Set tenant_slug cookie so middleware can always resolve tenant without NEXT_PUBLIC_TENANT_SLUG
    res.cookies.set('tenant_slug', tenant.slug, {
      path: '/', httpOnly: false, sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8,
    })
    return res

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
