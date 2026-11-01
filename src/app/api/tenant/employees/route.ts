import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { employees, departments, positions, users } from '@/lib/db/schema'
import { eq, and, isNull, ilike, or, asc, count, sql } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

// GET /api/tenant/employees?search=&status=&type=&page=1&limit=20
export async function GET(req: NextRequest) {
  const guard = await apiGuard('employees:read')
  if (guard.error) return guard.error
  const { session } = guard

  // employees:read for 'employee' and 'contractor' is scoped to own record only
  // (see permissions.ts comment). This endpoint is the org-wide directory —
  // personal profile data is served by /api/tenant/my-profile instead.
  if (session.userRole === 'employee' || session.userRole === 'contractor') {
    return NextResponse.json(
      { error: 'Access restricted. Use /api/tenant/my-profile for your own profile.' },
      { status: 403 }
    )
  }

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status')           // 'active' | 'inactive'
  const type   = searchParams.get('type')             // employment_type
  const page   = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit  = Math.min(500, Number(searchParams.get('limit') ?? 20))
  const offset = (page - 1) * limit

  try {
    const conditions = [eq(employees.tenantId, session.tenantId!), isNull(employees.deletedAt)]

    if (status === 'active')   conditions.push(eq(employees.isActive, true))
    if (status === 'inactive') conditions.push(eq(employees.isActive, false))
    if (type) conditions.push(eq(employees.employmentType, type as any))

    const query = db
      .select({
        id:               employees.id,
        employeeNumber:   employees.employeeNumber,
        firstName:        employees.firstName,
        lastName:         employees.lastName,
        preferredName:    employees.preferredName,
        email:            employees.email,
        phone:            employees.phone,
        employmentType:   employees.employmentType,
        entityName:       employees.entityName,
        departmentId:     employees.departmentId,
        positionId:       employees.positionId,
        startDate:        employees.startDate,
        isActive:         employees.isActive,
        complianceStatus: employees.complianceStatus,
        ndisWorker:       employees.ndisWorker,
        createdAt:        employees.createdAt,
        departmentName:   departments.name,
        positionTitle:    positions.title,
      })
      .from(employees)
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .leftJoin(positions,   eq(employees.positionId,   positions.id))
      .where(
        search
          ? and(
              ...conditions,
              or(
                ilike(employees.firstName, `%${search}%`),
                ilike(employees.lastName,  `%${search}%`),
                ilike(employees.email,     `%${search}%`),
                ilike(employees.employeeNumber, `%${search}%`),
              )
            )
          : and(...conditions)
      )
      .orderBy(asc(employees.lastName), asc(employees.firstName))
      .limit(limit)
      .offset(offset)

    const rows = await query

    // Count total matching rows (without limit/offset)
    const whereClause = search
      ? and(...conditions, or(
          ilike(employees.firstName, `%${search}%`),
          ilike(employees.lastName,  `%${search}%`),
          ilike(employees.email,     `%${search}%`),
          ilike(employees.employeeNumber, `%${search}%`),
        ))
      : and(...conditions)
    // Total matching (filtered) count + unfiltered counts for stat cards
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(employees)
      .where(whereClause)

    // Always count against the full tenant (ignoring search/status/type filters)
    // so stat cards reflect the entire workforce, not the current filter slice.
    const tenantCondition = eq(employees.tenantId, session.tenantId!)
    const [stats] = await db
      .select({
        activeCount:   sql<number>`count(*) filter (where ${employees.isActive} = true)`,
        inactiveCount: sql<number>`count(*) filter (where ${employees.isActive} = false)`,
        ndisCount:     sql<number>`count(*) filter (where ${employees.ndisWorker} = true)`,
      })
      .from(employees)
      .where(tenantCondition)

    return NextResponse.json({
      employees: rows,
      page,
      limit,
      total:         Number(total),
      pages:         Math.ceil(Number(total) / limit),
      activeCount:   Number(stats.activeCount),
      inactiveCount: Number(stats.inactiveCount),
      ndisCount:     Number(stats.ndisCount),
    })
  } catch (err) {
    console.error('GET /api/tenant/employees', err)
    return NextResponse.json({ error: 'Failed to fetch employees', detail: String(err) }, { status: 500 })
  }
}

// POST /api/tenant/employees
export async function POST(req: NextRequest) {
  const guard = await apiGuard('employees:write')
  if (guard.error) return guard.error
  const { session } = guard

  try {
    const body = await req.json()
    const {
      firstName, lastName, preferredName, dateOfBirth, gender,
      phone, email, address, photoUrl,
      entityName, departmentId, positionId,
      employmentType, awardClassification, payLevel,
      startDate, probationEndDate,
      ndisWorker,
    } = body

    if (!firstName || !lastName || !email || !employmentType || !startDate) {
      return NextResponse.json(
        { error: 'firstName, lastName, email, employmentType and startDate are required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Auto-generate employee number: EMP-{year}-{4 random digits}
    const empNumber = `EMP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

    // Map employment type to a user role
    const roleForType = employmentType === 'contract' ? 'contractor' : 'employee'

    // Derive a default password from the employee's last name + birth year (or a fallback)
    // e.g. "Smith@1990" — they should reset on first login
    const birthYear = dateOfBirth ? new Date(dateOfBirth).getFullYear() : new Date().getFullYear()
    const defaultPassword = `${lastName.trim()}@${birthYear}`
    const passwordHash = await bcrypt.hash(defaultPassword, 12)

    // Create (or find) the login account first, then link it to the employee record
    let userId: string
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, session.tenantId!), eq(users.email, normalizedEmail)))
      .limit(1)

    if (existing.length > 0) {
      // User account already exists (e.g. invited separately) — just link it
      userId = existing[0].id
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          tenantId:     session.tenantId!,
          email:        normalizedEmail,
          passwordHash,
          role:         roleForType as any,
          isActive:     true,
        })
        .returning({ id: users.id })
      userId = newUser.id
    }

    const [emp] = await db
      .insert(employees)
      .values({
        tenantId:          session.tenantId!,
        userId,
        employeeNumber:    empNumber,
        firstName:         firstName.trim(),
        lastName:          lastName.trim(),
        preferredName:     preferredName?.trim() ?? null,
        dateOfBirth:       dateOfBirth ?? null,
        gender:            gender ?? null,
        phone:             phone ?? null,
        email:             normalizedEmail,
        address:           address ?? null,
        photoUrl:          photoUrl ?? null,
        entityName:        entityName ?? null,
        departmentId:      departmentId ?? null,
        positionId:        positionId ?? null,
        employmentType:    employmentType,
        awardClassification: awardClassification ?? null,
        payLevel:          payLevel ?? null,
        startDate:         startDate,
        probationEndDate:  probationEndDate ?? null,
        ndisWorker:        ndisWorker ?? false,
        isActive:          true,
        complianceStatus:  'pending',
      })
      .returning()

    return NextResponse.json({
      employee: emp,
      loginCreated: existing.length === 0,
      defaultPassword: existing.length === 0 ? defaultPassword : undefined,
      message: existing.length === 0
        ? `Login account created. Default password: ${defaultPassword} — employee should reset on first login.`
        : 'Linked to existing login account.',
    }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/tenant/employees', err)
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'An employee with this number or email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create employee', detail: String(err) }, { status: 500 })
  }
}
