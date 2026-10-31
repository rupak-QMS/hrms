/**
 * GET  /api/tenant/tickets        — list tickets with SLA stats
 * POST /api/tenant/tickets        — create a new ticket
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supportTickets, employees } from '@/lib/db/schema'
import { eq, and, desc, sql, gte, lte, or, ilike } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// SLA target minutes by priority
const SLA_MINUTES: Record<string, number> = {
  critical: 240,    // 4 hours
  high:     480,    // 8 hours
  medium:   1440,   // 24 hours
  low:      4320,   // 72 hours
}

const CreateSchema = z.object({
  title:       z.string().min(3).max(255),
  description: z.string().min(10),
  category:    z.enum(['it', 'hr', 'payroll', 'facilities', 'compliance', 'other']).default('other'),
  priority:    z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
})

export async function GET(req: NextRequest) {
  const guard = await apiGuard('tickets:read')
  if (guard.error) return guard.error
  const { session } = guard

  const { searchParams } = req.nextUrl
  const status   = searchParams.get('status')
  const priority = searchParams.get('priority')
  const q        = searchParams.get('q')
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit    = 25
  const offset   = (page - 1) * limit

  const conditions = [eq(supportTickets.tenantId, session.tenantId)]
  if (status)   conditions.push(eq(supportTickets.status,   status as any))
  if (priority) conditions.push(eq(supportTickets.priority, priority as any))
  if (q)        conditions.push(or(
    ilike(supportTickets.title, `%${q}%`),
    ilike(supportTickets.ticketNumber, `%${q}%`),
  )!)

  const [rows, [{ total }], [stats]] = await Promise.all([
    db.select().from(supportTickets)
      .where(and(...conditions))
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit).offset(offset),

    db.select({ total: sql<number>`count(*)::int` })
      .from(supportTickets)
      .where(and(...conditions)),

    db.select({
      totalOpen:     sql<number>`count(*) filter (where status in ('open','in_progress','pending'))::int`,
      breached:      sql<number>`count(*) filter (where sla_breached = true and status not in ('resolved','closed'))::int`,
      resolvedToday: sql<number>`count(*) filter (where resolved_at >= now() - interval '24 hours')::int`,
      avgResolveMins:sql<number>`round(avg(extract(epoch from (resolved_at - created_at))/60) filter (where resolved_at is not null))::int`,
      criticalOpen:  sql<number>`count(*) filter (where priority = 'critical' and status not in ('resolved','closed'))::int`,
    }).from(supportTickets).where(eq(supportTickets.tenantId, session.tenantId)),
  ])

  // Flag SLA breaches in real-time (tickets not yet marked as breached in DB)
  const now = new Date()
  const enriched = rows.map(t => {
    const ageMinutes = (now.getTime() - new Date(t.createdAt).getTime()) / 60000
    const slaTarget  = SLA_MINUTES[t.priority] ?? 1440
    const isBreached = t.slaBreached || (
      !['resolved', 'closed'].includes(t.status) && ageMinutes > slaTarget
    )
    const slaUsedPct = Math.min(100, Math.round((ageMinutes / slaTarget) * 100))
    return { ...t, isBreached, slaUsedPct, slaTargetMins: slaTarget }
  })

  return NextResponse.json({ tickets: enriched, total, page, pages: Math.ceil(total / limit), stats })
}

export async function POST(req: NextRequest) {
  const guard = await apiGuard('tickets:write')
  if (guard.error) return guard.error
  const { session } = guard

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { title, description, category, priority } = parsed.data

  // Generate ticket number: TKT-YYYYMM-NNNN
  const [{ seq }] = await db.select({
    seq: sql<number>`count(*) + 1`
  }).from(supportTickets).where(eq(supportTickets.tenantId, session.tenantId))

  const ym = new Date().toISOString().slice(0, 7).replace('-', '')
  const ticketNumber = `TKT-${ym}-${String(seq).padStart(4, '0')}`

  const [ticket] = await db.insert(supportTickets).values({
    tenantId:      session.tenantId,
    ticketNumber,
    title,
    description,
    category,
    priority,
    status:        'open',
    slaTargetMins: SLA_MINUTES[priority] ?? 1440,
    slaBreached:   false,
  }).returning()

  return NextResponse.json({ ticket }, { status: 201 })
}
