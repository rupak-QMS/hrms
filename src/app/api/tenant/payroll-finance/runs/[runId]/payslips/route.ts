/**
 * POST /api/tenant/payroll-finance/runs/[runId]/payslips
 *
 * Generates PDF payslips for all payroll_records linked to this run.
 * Triggers the /api/tenant/payroll/[id]/pdf route for each record.
 * Returns a summary of generated / failed records.
 *
 * Run must be finalised or paid.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { payrollRuns, payrollRecords } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const guard = await apiGuard('payroll_finance:write')
  if (guard.error) return guard.error
  const { tenantId } = guard.session
  const { runId } = await params

  // Validate run
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, tenantId)))

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'finalised' && run.status !== 'paid') {
    return NextResponse.json(
      { error: `Payslips can only be generated for finalised or paid runs (current: ${run.status})` },
      { status: 409 },
    )
  }

  // Get all payroll_records for this run
  const records = await db
    .select({ id: payrollRecords.id })
    .from(payrollRecords)
    .where(and(
      eq(payrollRecords.payrollRunId, runId),
      eq(payrollRecords.tenantId, tenantId),
    ))

  if (records.length === 0) {
    return NextResponse.json(
      { error: 'No payroll records found for this run. Ensure the run was finalised correctly.' },
      { status: 422 },
    )
  }

  const { emailEmployee = false } = await req.json().catch(() => ({})) as { emailEmployee?: boolean }

  // Generate PDFs by calling the individual payslip PDF endpoint for each record
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin
  const results: Array<{ id: string; status: 'generated' | 'failed'; reason?: string; pdfUrl?: string }> = []

  for (const record of records) {
    try {
      const res = await fetch(`${baseUrl}/api/tenant/payroll/${record.id}/pdf`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          // Forward auth cookie so the internal call is authenticated
          'Cookie':        req.headers.get('cookie') || '',
        },
        body: JSON.stringify({ emailEmployee }),
      })
      const data = await res.json()
      if (!res.ok) {
        results.push({ id: record.id, status: 'failed', reason: (data as { error?: string }).error || `HTTP ${res.status}` })
      } else {
        results.push({ id: record.id, status: 'generated', pdfUrl: (data as { pdfUrl?: string }).pdfUrl })
      }
    } catch (err) {
      results.push({ id: record.id, status: 'failed', reason: String(err) })
    }
  }

  const generated = results.filter(r => r.status === 'generated').length
  const failed    = results.filter(r => r.status === 'failed').length

  return NextResponse.json({
    generated,
    failed,
    results,
    message: `${generated} payslip PDF${generated !== 1 ? 's' : ''} generated${failed > 0 ? `, ${failed} failed` : ''}.`,
  })
}
