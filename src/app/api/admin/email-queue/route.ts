/**
 * GET /api/admin/email-queue
 * Returns recent email queue entries for monitoring (super-admin only).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailQueue } from '@/lib/db/schema'
import { apiAuth } from '@/lib/auth/apiAuth'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await apiAuth()
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = req.nextUrl
    const status = searchParams.get('status')
    const limit  = Math.min(Number(searchParams.get('limit') ?? 50), 200)

    const rows = await db
      .select()
      .from(emailQueue)
      .where(status ? eq(emailQueue.status, status as any) : undefined)
      .orderBy(desc(emailQueue.createdAt))
      .limit(limit)

    return NextResponse.json({ queue: rows, count: rows.length })
  } catch (err) {
    console.error('[admin/email-queue GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
