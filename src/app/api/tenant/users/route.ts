import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, employees } from '@/lib/db/schema'
import { eq, and, asc, ilike } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const guard = await apiGuard('users:read')
    if (guard.error) return guard.error
    const { session } = guard

    const { searchParams } = req.nextUrl
    const search = searchParams.get('search')
    const role   = searchParams.get('role')
    const active = searchParams.get('active')
    const limit  = Math.min(Number(searchParams.get('limit') ?? 50), 200)
    const offset = Number(searchParams.get('offset') ?? 0)

    const conditions: any[] = [eq(users.tenantId, session.tenantId)]
    if (role) conditions.push(eq(users.role, role as any))
    if (active !== null && active !== undefined && active !== '') {
      conditions.push(eq(users.isActive, active !== 'false'))
    }
    if (search) conditions.push(ilike(users.email, `%${search}%`))

    const rows = await db
      .select({
        id:             users.id,
        email:          users.email,
        role:           users.role,
        isActive:       users.isActive,
        totpEnabled:    users.totpEnabled,
        lastLoginAt:    users.lastLoginAt,
        createdAt:      users.createdAt,
        updatedAt:      users.updatedAt,
        firstName:      employees.firstName,
        lastName:       employees.lastName,
        employeeNumber: employees.employeeNumber,
        photoUrl:       employees.photoUrl,
      })
      .from(users)
      .leftJoin(employees, and(
        eq(employees.userId, users.id),
        eq(employees.tenantId, users.tenantId)
      ))
      .where(and(...conditions))
      .orderBy(asc(users.email))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({ users: rows, pagination: { limit, offset, count: rows.length } })
  } catch (err) {
    console.error('[users GET]', err)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('users:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const { email, role, password } = body
    if (!email || !role || !password) {
      return NextResponse.json({ error: 'email, role and password are required' }, { status: 400 })
    }

    const { hashPassword } = await import('@/lib/auth/password')
    const passwordHash = await hashPassword(password)

    const [row] = await db
      .insert(users)
      .values({ tenantId: session.tenantId, email: email.trim().toLowerCase(), role, passwordHash, isActive: true })
      .returning({ id: users.id, email: users.email, role: users.role, isActive: users.isActive })

    return NextResponse.json({ user: row }, { status: 201 })
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    console.error('[users POST]', err)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
