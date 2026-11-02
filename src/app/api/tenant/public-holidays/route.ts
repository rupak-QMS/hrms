import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { publicHolidays } from '@/lib/db/schema'
import { eq, and, gte, lte, asc } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { hasPermission } from '@/lib/auth/permissions'

export const dynamic = 'force-dynamic'

// ── GET /api/tenant/public-holidays ──────────────────────────────────────────
// Returns public holidays for the tenant.
// Query params: year (defaults to current year), country (default 'AU')
export async function GET(req: NextRequest) {
  try {
  const guard = await apiGuard('leave:read')
  if (guard.error) return guard.error
  const { session } = guard

  const { searchParams } = req.nextUrl
  const year    = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const country = searchParams.get('country') ?? null   // null = all countries

  const from = `${year}-01-01`
  const to   = `${year}-12-31`

  const conditions = [
    eq(publicHolidays.tenantId, session.tenantId),
    gte(publicHolidays.date, from),
    lte(publicHolidays.date, to),
  ]
  if (country) conditions.push(eq(publicHolidays.country, country))

  const rows = await db
    .select({
      id:         publicHolidays.id,
      name:       publicHolidays.name,
      date:       publicHolidays.date,
      country:    publicHolidays.country,
      state:      publicHolidays.state,
      isNational: publicHolidays.isNational,
    })
    .from(publicHolidays)
    .where(and(...conditions))
    .orderBy(asc(publicHolidays.date))

  return NextResponse.json({ holidays: rows, year })
  } catch (err: any) {
    console.error('[public-holidays GET]', err)
    return NextResponse.json({ error: 'Failed to fetch public holidays', detail: err?.message ?? String(err), cause: err?.cause?.message ?? null }, { status: 500 })
  }
}

// ── POST /api/tenant/public-holidays ─────────────────────────────────────────
// HR officers / managers create a new holiday entry.
export async function POST(req: NextRequest) {
  const guard = await apiGuard('leave:approve')
  if (guard.error) return guard.error
  const { session } = guard

  const body = await req.json()
  const { name, date, country = 'AU', state = null, isNational = true } = body

  if (!name || !date) {
    return NextResponse.json({ error: 'name and date are required' }, { status: 400 })
  }

  const [created] = await db
    .insert(publicHolidays)
    .values({ tenantId: session.tenantId, name, date, country, state, isNational })
    .returning()

  return NextResponse.json({ holiday: created }, { status: 201 })
}

// ── PATCH /api/tenant/public-holidays ────────────────────────────────────────
// Update an existing holiday entry.
export async function PATCH(req: NextRequest) {
  const guard = await apiGuard('leave:approve')
  if (guard.error) return guard.error
  const { session } = guard

  const body = await req.json()
  const { id, name, date, country, state, isNational } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const [existing] = await db
    .select({ id: publicHolidays.id })
    .from(publicHolidays)
    .where(and(eq(publicHolidays.id, id), eq(publicHolidays.tenantId, session.tenantId)))

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Partial<typeof publicHolidays.$inferInsert> = {}
  if (name       !== undefined) updates.name       = name
  if (date       !== undefined) updates.date       = date
  if (country    !== undefined) updates.country    = country
  if (state      !== undefined) updates.state      = state
  if (isNational !== undefined) updates.isNational = isNational

  const [updated] = await db
    .update(publicHolidays)
    .set(updates)
    .where(eq(publicHolidays.id, id))
    .returning()

  return NextResponse.json({ holiday: updated })
}

// ── DELETE /api/tenant/public-holidays ───────────────────────────────────────
// Delete a holiday entry.
export async function DELETE(req: NextRequest) {
  const guard = await apiGuard('leave:approve')
  if (guard.error) return guard.error
  const { session } = guard

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const [existing] = await db
    .select({ id: publicHolidays.id })
    .from(publicHolidays)
    .where(and(eq(publicHolidays.id, id), eq(publicHolidays.tenantId, session.tenantId)))

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.delete(publicHolidays).where(eq(publicHolidays.id, id))
  return NextResponse.json({ ok: true })
}
