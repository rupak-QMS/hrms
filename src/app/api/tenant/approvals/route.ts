import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>

const CreateApprovalSchema = z.object({
  entityType: z.enum(['leave', 'expense', 'payroll', 'recruitment', 'separation']),
  entityId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  dueDate: z.string().datetime().optional().nullable(),
  steps: z.array(z.object({
    stepOrder: z.number().int().min(1),
    stepType: z.enum(['sequential', 'parallel']).default('sequential'),
    approverRole: z.string().optional().nullable(),
    approverId: z.string().uuid().optional().nullable(),
    escalationHrs: z.number().int().positive().optional().nullable(),
  })).min(1),
})

const ActionSchema = z.object({
  id: z.string().uuid(),
  stepId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'delegate', 'request_info']),
  comment: z.string().optional().nullable(),
  delegatedTo: z.string().uuid().optional().nullable(),
})

export async function GET(req: NextRequest) {
  try {
    const guard = await apiGuard('leave:read')
    if (guard.error) return guard.error
    const { session } = guard

    const { searchParams } = new URL(req.url)
    const entityType = searchParams.get('entityType')
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)
    const offset = (page - 1) * limit

    let requests: Row[], countRows: Row[]
    if (entityType && status) {
      ;[requests, countRows] = await Promise.all([
        db.execute(sql`
          SELECT r.*, json_agg(s.* ORDER BY s.step_order) FILTER (WHERE s.id IS NOT NULL) AS steps
          FROM hrms_approval_requests r
          LEFT JOIN hrms_approval_steps s ON s.request_id = r.id
          WHERE r.tenant_id = ${session.tenantId}::uuid AND r.entity_type = ${entityType} AND r.status = ${status}
          GROUP BY r.id ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `),
        db.execute(sql`SELECT COUNT(*) FROM hrms_approval_requests WHERE tenant_id = ${session.tenantId}::uuid AND entity_type = ${entityType} AND status = ${status}`),
      ]) as unknown as [Row[], Row[]]
    } else if (entityType) {
      ;[requests, countRows] = await Promise.all([
        db.execute(sql`
          SELECT r.*, json_agg(s.* ORDER BY s.step_order) FILTER (WHERE s.id IS NOT NULL) AS steps
          FROM hrms_approval_requests r
          LEFT JOIN hrms_approval_steps s ON s.request_id = r.id
          WHERE r.tenant_id = ${session.tenantId}::uuid AND r.entity_type = ${entityType}
          GROUP BY r.id ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `),
        db.execute(sql`SELECT COUNT(*) FROM hrms_approval_requests WHERE tenant_id = ${session.tenantId}::uuid AND entity_type = ${entityType}`),
      ]) as unknown as [Row[], Row[]]
    } else if (status) {
      ;[requests, countRows] = await Promise.all([
        db.execute(sql`
          SELECT r.*, json_agg(s.* ORDER BY s.step_order) FILTER (WHERE s.id IS NOT NULL) AS steps
          FROM hrms_approval_requests r
          LEFT JOIN hrms_approval_steps s ON s.request_id = r.id
          WHERE r.tenant_id = ${session.tenantId}::uuid AND r.status = ${status}
          GROUP BY r.id ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `),
        db.execute(sql`SELECT COUNT(*) FROM hrms_approval_requests WHERE tenant_id = ${session.tenantId}::uuid AND status = ${status}`),
      ]) as unknown as [Row[], Row[]]
    } else {
      ;[requests, countRows] = await Promise.all([
        db.execute(sql`
          SELECT r.*, json_agg(s.* ORDER BY s.step_order) FILTER (WHERE s.id IS NOT NULL) AS steps
          FROM hrms_approval_requests r
          LEFT JOIN hrms_approval_steps s ON s.request_id = r.id
          WHERE r.tenant_id = ${session.tenantId}::uuid
          GROUP BY r.id ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `),
        db.execute(sql`SELECT COUNT(*) FROM hrms_approval_requests WHERE tenant_id = ${session.tenantId}::uuid`),
      ]) as unknown as [Row[], Row[]]
    }

    const total = Number((countRows[0] as { count: string }).count)
    return NextResponse.json({ data: requests, total, page, limit })
  } catch (err) {
    console.error('[approvals GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('leave:create')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const parsed = CreateApprovalSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { entityType, entityId, title, description, priority, dueDate, steps } = parsed.data

    const insertResult = await db.execute(sql`
      INSERT INTO hrms_approval_requests
        (tenant_id, entity_type, entity_id, title, description, priority, due_date, status, requested_by)
      VALUES
        (${session.tenantId}::uuid, ${entityType}, ${entityId}::uuid, ${title}, ${description ?? null},
         ${priority}, ${dueDate ?? null}::timestamptz, 'pending', ${session.sub}::uuid)
      RETURNING id
    `) as unknown as Row[]

    const requestId = insertResult[0].id as string

    for (const s of steps) {
      await db.execute(sql`
        INSERT INTO hrms_approval_steps
          (tenant_id, request_id, step_order, step_type, approver_role, approver_id, escalation_hrs, status)
        VALUES
          (${session.tenantId}::uuid, ${requestId}::uuid, ${s.stepOrder}, ${s.stepType},
           ${s.approverRole ?? null}, ${s.approverId ?? null}::uuid, ${s.escalationHrs ?? null}, 'pending')
      `)
    }

    return NextResponse.json({ ok: true, id: requestId }, { status: 201 })
  } catch (err) {
    console.error('[approvals POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const guard = await apiGuard('leave:approve')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const parsed = ActionSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

    const { id, stepId, action, comment, delegatedTo } = parsed.data
    const stepStatus = action === 'approve' ? 'approved'
      : action === 'reject' ? 'rejected'
      : action === 'delegate' ? 'delegated'
      : 'pending'

    await db.execute(sql`
      UPDATE hrms_approval_steps
      SET status = ${stepStatus}, action = ${action}, comment = ${comment ?? null},
          acted_by = ${session.sub}::uuid, acted_at = now(),
          delegated_to = ${delegatedTo ?? null}::uuid
      WHERE id = ${stepId}::uuid AND request_id = ${id}::uuid AND tenant_id = ${session.tenantId}::uuid
    `)

    const stepRows = await db.execute(sql`
      SELECT status FROM hrms_approval_steps
      WHERE request_id = ${id}::uuid AND tenant_id = ${session.tenantId}::uuid
    `) as unknown as { status: string }[]

    const allApproved = stepRows.every(r => r.status === 'approved')
    const anyRejected = stepRows.some(r => r.status === 'rejected')
    const newStatus = anyRejected ? 'rejected' : allApproved ? 'approved' : 'in_progress'
    const done = allApproved || anyRejected

    await db.execute(
      done
        ? sql`UPDATE hrms_approval_requests SET status = ${newStatus}, completed_at = now() WHERE id = ${id}::uuid AND tenant_id = ${session.tenantId}::uuid`
        : sql`UPDATE hrms_approval_requests SET status = ${newStatus}, completed_at = NULL WHERE id = ${id}::uuid AND tenant_id = ${session.tenantId}::uuid`
    )

    return NextResponse.json({ ok: true, requestStatus: newStatus })
  } catch (err) {
    console.error('[approvals PATCH]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
