/**
 * POST /api/tenant/payroll-finance/runs/[runId]/process
 *
 * Processes a payroll run: fetches all active employees, calculates their
 * AU-compliant pay (PAYG, Medicare, LITO, Super @ 11.5%), creates/replaces
 * payroll run entries, and updates the run totals.
 *
 * Only callable when run.status === 'draft'.
 * Sets run.status to 'processing' while running, then back to 'draft' with
 * totals populated (user reviews before finalising).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { payrollRuns, payrollRunEntries, employees } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import {
  calculatePayroll,
  grossFromHours,
  grossFromSalary,
  type PayFrequency,
} from '@/lib/payroll/calculator'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const guard = await apiGuard('payroll_finance:write')
  if (guard.error) return guard.error
  const { tenantId } = guard.session
  const { runId } = await params

  // 1. Fetch and validate the run
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, tenantId)))

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status === 'finalised' || run.status === 'paid') {
    return NextResponse.json(
      { error: `Cannot reprocess a run with status "${run.status}"` },
      { status: 409 }
    )
  }

  const frequency = (run.frequency ?? 'fortnightly') as PayFrequency

  // 2. Mark as processing
  await db
    .update(payrollRuns)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(payrollRuns.id, runId))

  try {
    // 3. Fetch all active employees for this tenant
    const activeEmployees = await db
      .select({
        id:             employees.id,
        employeeNumber: employees.employeeNumber,
        firstName:      employees.firstName,
        lastName:       employees.lastName,
        employmentType: employees.employmentType,
        annualSalary:   employees.annualSalary,
        hourlyRate:     employees.hourlyRate,
        hoursPerWeek:   employees.ordinaryHoursPerWeek,
      })
      .from(employees)
      .where(and(
        eq(employees.tenantId, tenantId),
        eq(employees.isActive, true),
      ))

    if (activeEmployees.length === 0) {
      await db
        .update(payrollRuns)
        .set({ status: 'draft', updatedAt: new Date() })
        .where(eq(payrollRuns.id, runId))
      return NextResponse.json({ message: 'No active employees found', entries: [] })
    }

    // 4. Delete any existing entries for this run (re-process)
    await db
      .delete(payrollRunEntries)
      .where(and(
        eq(payrollRunEntries.runId, runId),
        eq(payrollRunEntries.tenantId, tenantId),
      ))

    // 5. Calculate pay for each employee
    const entryValues = []
    let sumGross = 0
    let sumNet   = 0
    let sumTax   = 0
    let sumSuper = 0

    for (const emp of activeEmployees) {
      const hourlyRate   = Number(emp.hourlyRate   ?? 0)
      const annualSalary = Number(emp.annualSalary ?? 0)
      const hoursPerWeek = Number(emp.hoursPerWeek ?? 38)

      // Determine gross for this pay period
      let periodHours = 0
      let grossPay    = 0
      let ordinaryPay = 0

      if (annualSalary > 0) {
        // Salaried employee
        grossPay    = grossFromSalary(annualSalary, frequency)
        ordinaryPay = grossPay
        periodHours = frequency === 'weekly'
          ? hoursPerWeek
          : frequency === 'fortnightly'
          ? hoursPerWeek * 2
          : frequency === 'monthly'
          ? Math.round(hoursPerWeek * 52 / 12)
          : hoursPerWeek * 52
      } else if (hourlyRate > 0) {
        // Hourly — use standard hours; timesheet override via entries POST
        periodHours = frequency === 'weekly'
          ? hoursPerWeek
          : frequency === 'fortnightly'
          ? hoursPerWeek * 2
          : frequency === 'monthly'
          ? Math.round(hoursPerWeek * 52 / 12)
          : hoursPerWeek * 52
        grossPay    = grossFromHours(periodHours, hourlyRate)
        ordinaryPay = grossPay
      } else {
        // No rate on record — create a zero entry so run is complete
        grossPay = 0
        ordinaryPay = 0
        periodHours = 0
      }

      // AU-compliant payroll calculation
      const calc = grossPay > 0
        ? calculatePayroll({ grossPay, frequency })
        : {
            grossPay:          0,
            taxableIncome:     0,
            paygWithholding:   0,
            medicareLevy:      0,
            totalTax:          0,
            superContribution: 0,
            netPay:            0,
            effectiveTaxRate:  0,
            annualisedGross:   0,
            annualisedTax:     0,
          }

      // Leave accrual: standard AU 4 weeks / year = ~0.1538 hrs per hour worked
      const leaveAccrued = periodHours > 0
        ? Math.round(periodHours * 0.15385 * 10000) / 10000
        : 0

      entryValues.push({
        tenantId,
        runId,
        employeeId:       emp.id,
        employeeNumber:   emp.employeeNumber ?? null,
        firstName:        emp.firstName,
        lastName:         emp.lastName,
        employmentType:   emp.employmentType ?? null,
        hoursWorked:      String(periodHours),
        hourlyRate:       String(hourlyRate),
        ordinaryPay:      String(ordinaryPay.toFixed(2)),
        overtimePay:      '0.00',
        allowances:       '0.00',
        grossPay:         String(calc.grossPay.toFixed(2)),
        paygWithholding:  String(calc.paygWithholding.toFixed(2)),
        medicareLevy:     String(calc.medicareLevy.toFixed(2)),
        otherDeductions:  '0.00',
        superContribution:String(calc.superContribution.toFixed(2)),
        netPay:           String(calc.netPay.toFixed(2)),
        leaveAccrued:     String(leaveAccrued),
        notes:            null,
      })

      sumGross += calc.grossPay
      sumNet   += calc.netPay
      sumTax   += calc.totalTax
      sumSuper += calc.superContribution
    }

    // 6. Bulk insert entries
    const inserted = await db
      .insert(payrollRunEntries)
      .values(entryValues)
      .returning({ id: payrollRunEntries.id })

    // 7. Update run totals and reset to draft (ready for review)
    const [updated] = await db
      .update(payrollRuns)
      .set({
        status:        'draft',
        totalGross:    String(sumGross.toFixed(2)),
        totalNet:      String(sumNet.toFixed(2)),
        totalTax:      String(sumTax.toFixed(2)),
        totalSuper:    String(sumSuper.toFixed(2)),
        employeeCount: activeEmployees.length,
        updatedAt:     new Date(),
      })
      .where(eq(payrollRuns.id, runId))
      .returning()

    return NextResponse.json({
      run:          updated,
      entriesCount: inserted.length,
      totals: {
        gross: sumGross.toFixed(2),
        net:   sumNet.toFixed(2),
        tax:   sumTax.toFixed(2),
        super: sumSuper.toFixed(2),
      },
    })
  } catch (err) {
    // Rollback to draft on error
    await db
      .update(payrollRuns)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(eq(payrollRuns.id, runId))

    console.error('[payroll process]', err)
    return NextResponse.json({ error: 'Payroll processing failed' }, { status: 500 })
  }
}
