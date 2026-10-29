import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, tenants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth/session'

type RouteContext = { params: Promise<{ id: string }> }

// GET — list all users for a tenant
export async function GET(_: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const tenantUsers = await db
      .select({
        id:          users.id,
        email:       users.email,
        role:        users.role,
        isActive:    users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt:   users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, id))
      .orderBy(users.createdAt)

    return NextResponse.json({ users: tenantUsers })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users', detail: String(error) }, { status: 500 })
  }
}

// POST — create a new user for a tenant
// Body: { email, password, role }
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const { email, password, role } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Verify tenant exists
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id))
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const passwordHash = await bcrypt.hash(password, 12)

    const [user] = await db
      .insert(users)
      .values({
        tenantId:     id,
        email:        email.toLowerCase().trim(),
        passwordHash,
        role:         role ?? 'hr_officer',
        isActive:     true,
      })
      .returning({
        id:       users.id,
        email:    users.email,
        role:     users.role,
        isActive: users.isActive,
      })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A user with this email already exists in this organisation' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

// PATCH — toggle active / reset password
// Body: { userId, isActive? } | { userId, newPassword? }
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const { userId, isActive, newPassword, role } = await req.json()

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (isActive !== undefined) updates.isActive = isActive
    if (newPassword) updates.passwordHash = await bcrypt.hash(newPassword, 12)
    if (role) updates.role = role

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(and(eq(users.id, userId), eq(users.tenantId, id)))
      .returning({ id: users.id, email: users.email, role: users.role, isActive: users.isActive })

    return NextResponse.json({ user: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE — remove user
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const { userId } = await req.json()
    await db.delete(users).where(and(eq(users.id, userId), eq(users.tenantId, id)))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
