import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { superAdmins } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/auth/session'
import { sendEmail } from '@/lib/email/resend'
import { superAdminInviteEmail } from '@/lib/email/templates'

// GET — list all super admins
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const admins = await db
      .select({
        id:          superAdmins.id,
        email:       superAdmins.email,
        name:        superAdmins.name,
        isActive:    superAdmins.isActive,
        lastLoginAt: superAdmins.lastLoginAt,
        createdAt:   superAdmins.createdAt,
      })
      .from(superAdmins)
      .orderBy(superAdmins.createdAt)

    return NextResponse.json({ admins })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}

// POST — create a new super admin
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const [admin] = await db
      .insert(superAdmins)
      .values({ name, email: email.toLowerCase().trim(), passwordHash, isActive: true })
      .returning({ id: superAdmins.id, email: superAdmins.email, name: superAdmins.name, isActive: superAdmins.isActive, createdAt: superAdmins.createdAt })

    // Send invite email
    const loginUrl = process.env.APP_URL ?? 'https://superadmin-hrmsapp.vercel.app'
    const tmpl = superAdminInviteEmail({ recipientName: name, adminEmail: email, tempPassword: password, loginUrl: `${loginUrl}/super-admin` })
    sendEmail({ to: email, ...tmpl }).catch(console.error)

    return NextResponse.json({ admin }, { status: 201 })
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A super admin with this email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 })
  }
}

// PATCH — toggle active status
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id, isActive } = await req.json()
    const [updated] = await db
      .update(superAdmins)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(superAdmins.id, id))
      .returning({ id: superAdmins.id, isActive: superAdmins.isActive })
    return NextResponse.json({ admin: updated })
  } catch {
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
  }
}

// DELETE — remove a super admin
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await req.json()
    await db.delete(superAdmins).where(eq(superAdmins.id, id))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 })
  }
}
