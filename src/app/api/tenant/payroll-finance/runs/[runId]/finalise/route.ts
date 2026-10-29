/**
 * POST /api/tenant/payroll-finance/runs/[runId]/finalise
 *
 * Locks a payroll run: status draft → finalised.
 * A finalised run cannot be reprocessed or edited.
 * Creates payroll_records (individual payslip rows) from the run entries.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { payrollRuns, payrollRunEntries, payrollRecords } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const guard = await apiGuard('payroll_finance:write')
  if (guard.error) return guard.error
  const { tenantId, email } = guard.session
  const { runId } = await params

  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, tenantId)))

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'draft') {
    return NextResponse.json(
      { error: `Run must be in draft status to finalise (current: ${run.status})` },
      { status: 409 }
    )
  }

  // Check there are entries
  const entries = await db
    .select()
    .from(payrollRunEntries)
    .where(and(eq(payrollRunEntries.runId, runId), eq(payrollRunEntries.tenantId, tenantId)))

  if (entries.length === 0) {
    return NextResponse.json(
      { error: 'Cannot finalise: run has no entries. Run /process first.' },
      { status: 422 }
    )
  }

  // Stamp finalised
  const [finalised] = await db
    .update(payrollRuns)
    .set({
      finalisedBy: email,
      finalisedAt: new Date(),
      updatedAt:   new Date(),
    })
    .where(eq(payrollRuns.id, runId))
    .returning()

  // Create payroll_records for each entry (individual employee payslip records)
  // These are what employees see in My Payslips
  const payslipValues = entries.map((e) => ({
    tenantId,
    employeeId:       e.employeeId,
    payrollRunId:     runId,
    periodStart:      run.periodStart,
    periodEnd:        run.periodEnd,
    grossPay:         e.grossPay,
    netPay:           e.netPay,
    paygWithholding:  e.paygWithholding,
    medicareLevy:     e.medicareLevy,
    superContribution:e.superContribution,
    hoursWorked:      e.hoursWorked,
  }))

  await db.insert(payrollRecords).values(payslipValues).onConflictDoNothing()

  return NextResponse.json({
    run:     finalised,
    payslips: payslipValues.length,
    message: `Run finalised. ${payslipValues.length} payslip records created.`,
  })
}
