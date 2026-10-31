import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auditLogs, users, employees } from '@/lib/db/schema'
import { eq, and, gte, lte, desc, ilike, or } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const guard = await apiGuard('audit:read')
    if (guard.error) return guard.error
    const { session } = guard

    const { searchParams } = req.nextUrl
    const resource  = searchParams.get('resource')
    const action    = searchParams.get('action')
    const userId    = searchParams.get('userId')
    const from      = searchParams.get('from')    // ISO date
    const to        = searchParams.get('to')      // ISO date
    const search    = searchParams.get('search')  // free-text on action/resource
    const limit     = Math.min(Number(searchParams.get('limit') ?? 50), 200)
    const offset    = Number(searchParams.get('offset') ?? 0)

    const conditions = [eq(auditLogs.tenantId, session.tenantId)]

    if (resource)  conditions.push(eq(auditLogs.resource, resource))
    if (action)    conditions.push(eq(auditLogs.action, action))
    if (userId)    conditions.push(eq(auditLogs.userId, userId))
    if (from)      conditions.push(gte(auditLogs.createdAt, new Date(from)))
    if (to)        conditions.push(lte(auditLogs.createdAt, new Date(to)))
    if (search) {
      conditions.push(
        or(
          ilike(auditLogs.action, `%${search}%`),
          ilike(auditLogs.resource, `%${search}%`)
        )!
      )
    }

    const rows = await db
      .select({
        id:         auditLogs.id,
        action:     auditLogs.action,
        resource:   auditLogs.resource,
        resourceId: auditLogs.resourceId,
        oldValues:  auditLogs.oldValues,
        newValues:  auditLogs.newValues,
        ipAddress:  auditLogs.ipAddress,
        userAgent:  auditLogs.userAgent,
        createdAt:  auditLogs.createdAt,
        // actor details
        userId:     auditLogs.userId,
        actorEmail: users.email,
        actorRole:  users.role,
        firstName:  employees.firstName,
        lastName:   employees.lastName,
      })
      .from(auditLogs)
      .leftJoin(users, and(
        eq(users.id, auditLogs.userId!),
        eq(users.tenantId, auditLogs.tenantId)
      ))
      .leftJoin(employees, and(
        eq(employees.userId, users.id),
        eq(employees.tenantId, auditLogs.tenantId)
      ))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset)

    // Distinct resources for filter UI
    const resourceList = await db
      .selectDistinct({ resource: auditLogs.resource })
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, session.tenantId))
      .orderBy(auditLogs.resource)

    return NextResponse.json({
      logs: rows,
      resources: resourceList.map(r => r.resource),
      pagination: { limit, offset, count: rows.length },
    })
  } catch (err) {
    console.error('[audit-log GET]', err)
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
  }
}

// Allow server-side code to write audit entries directly
export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('audit:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const { action, resource, resourceId, oldValues, newValues } = body

    if (!action || !resource) {
      return NextResponse.json({ error: 'action and resource are required' }, { status: 400 })
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                   || req.headers.get('x-real-ip')
                   || null
    const userAgent = req.headers.get('user-agent')

    const [row] = await db
      .insert(auditLogs)
      .values({
        tenantId:   session.tenantId,
        userId:     session.sub,
        action,
        resource,
        resourceId: resourceId ?? null,
        oldValues:  oldValues ?? null,
        newValues:  newValues ?? null,
        ipAddress,
        userAgent,
      })
      .returning({ id: auditLogs.id, createdAt: auditLogs.createdAt })

    return NextResponse.json({ log: row }, { status: 201 })
  } catch (err) {
    console.error('[audit-log POST]', err)
    return NextResponse.json({ error: 'Failed to write audit entry' }, { status: 500 })
  }
}
