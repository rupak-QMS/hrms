/**
 * GET /api/tenant/payroll-finance/runs/[runId]/export-aba
 *
 * Generates an ABA (Australian Banking Association) direct entry file
 * for the finalised payroll run. This file is uploaded to the bank to
 * process net pay transfers to employees.
 *
 * ABA format spec: https://www.cemtexaba.com/aba-format/cemtex-aba-file-format-details
 *
 * Requires: run.status === 'finalised'
 * Required tenant settings: bsb, accountNumber, accountName, apca (APCA user ID)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { payrollRuns, payrollRunEntries, essOnboarding, tenants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

function padLeft(str: string, len: number, char = ' ') {
  return String(str).slice(0, len).padStart(len, char)
}
function padRight(str: string, len: number, char = ' ') {
  return String(str).slice(0, len).padEnd(len, char)
}
function sanitise(str: string) {
  // ABA allows A-Z a-z 0-9 space & - ( ) + * = : / , . ?
  return String(str ?? '').replace(/[^A-Za-z0-9 &\-\(\)\+\*=:\/,\.\?]/g, ' ')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const guard = await apiGuard('payroll_finance:read')
  if (guard.error) return guard.error
  const { tenantId } = guard.session
  const { runId } = await params

  // Fetch run
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.tenantId, tenantId)))

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'finalised' && run.status !== 'paid') {
    return NextResponse.json(
      { error: 'Run must be finalised before exporting ABA file' },
      { status: 409 }
    )
  }

  // Fetch tenant bank settings
  const [tenant] = await db
    .select({ settings: tenants.settings, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))

  const settings = (tenant?.settings ?? {}) as Record<string, string>
  const bankBsb         = (settings.payrollBsb         ?? '000-000').replace(/[^0-9]/g, '')
  const bankAccount     = (settings.payrollAccount      ?? '000000000').replace(/[^0-9]/g, '')
  const bankAccountName = (settings.payrollAccountName  ?? tenant?.name ?? 'EMPLOYER').slice(0, 32)
  const apcaId          = (settings.apcaUserId          ?? '000000').padStart(6, '0').slice(0, 6)

  // Fetch entries with employee bank details (from ESS onboarding)
  const entries = await db
    .select({
      employeeId:      payrollRunEntries.employeeId,
      firstName:       payrollRunEntries.firstName,
      lastName:        payrollRunEntries.lastName,
      netPay:          payrollRunEntries.netPay,
      bankBsb:         essOnboarding.bankBsb,
      bankAccount:     essOnboarding.bankAccountNumber,
      bankAccountName: essOnboarding.bankAccountName,
    })
    .from(payrollRunEntries)
    .leftJoin(essOnboarding, and(
      eq(essOnboarding.employeeId, payrollRunEntries.employeeId),
      eq(essOnboarding.tenantId, tenantId),
    ))
    .where(and(
      eq(payrollRunEntries.runId, runId),
      eq(payrollRunEntries.tenantId, tenantId),
    ))

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No entries found for this run' }, { status: 404 })
  }

  const payDate = run.payDate
    ? new Date(run.payDate).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '')
    : new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '')

  const lines: string[] = []

  // === DESCRIPTIVE RECORD (header) ===
  // Field: 1=0, 2-8=blank(7), 9=01, 10-20=BSB(7), 21-29=Account(9), 30=space,
  // 31-56=Account Name(26), 57-62=Amount(10, zero), 63-74=Merchant Name(12),
  // 75-80=Date(6), 81-120=blank(40)
  const header = [
    '0',                                    // Record type
    padRight('', 17),                       // Blank (17)
    '01',                                   // Reel sequence
    padRight(bankBsb.slice(0,6).padStart(6,'0').replace(/(\d{3})(\d{3})/, '$1-$2'), 7),  // Bank/State/Branch (BSB) 7
    padLeft(bankAccount.slice(0,9), 9),     // Account number (9)
    ' ',                                    // Indicator (1)
    padRight(sanitise(bankAccountName), 26),// Account name (26)
    padLeft('000000', 10),                  // Amount — always 0 in header
    padRight(sanitise((tenant?.name ?? 'PAYROLL').slice(0,12)), 12), // Merchant name
    padLeft(payDate, 6),                    // Processing date DDMMYY (6)
    padRight('', 40),                       // Blank (40)
  ].join('')
  lines.push(header.slice(0, 120))

  // === DETAIL RECORDS ===
  let creditTotal = 0
  let recordCount = 0

  for (const entry of entries) {
    const net = Math.round(Number(entry.netPay ?? 0) * 100) // cents
    if (net <= 0) continue

    const empBsb     = (entry.bankBsb         ?? '000-000').replace(/[^0-9]/g, '').slice(0,6).padStart(6,'0')
    const empAccount = (entry.bankAccount  ?? '000000000').replace(/[^0-9]/g, '').slice(0,9).padEnd(9,' ')
    const empName    = sanitise(`${entry.firstName ?? ''} ${entry.lastName ?? ''}`.trim()).slice(0,32).padEnd(32,' ')
    const lodgeName  = sanitise((entry.bankAccountName ?? empName).trim()).slice(0,16).padEnd(16,' ')
    const reference  = sanitise(`PAYROLL ${run.name ?? ''}`.trim()).slice(0,18).padEnd(18,' ')

    // Detail record (120 chars):
    // 1=1, 2-8=BSB(7), 9-17=Account(9), 18=indicator(1), 19=transCode(2),
    // 20-29=amount(10cents), 30-61=AccountName(32), 62-79=lodgment ref(18),
    // 80-86=trace BSB(7), 87-95=trace account(9), 96-111=name of remitter(16),
    // 112-120=withholding(8, zero)
    const detail = [
      '1',
      empBsb.replace(/(\d{3})(\d{3})/, '$1-$2').padStart(7,' '),
      empAccount,
      ' ',     // Indicator
      '50',    // Transaction code: 50 = credit
      padLeft(String(net), 10, '0'),
      empName,
      reference,
      bankBsb.slice(0,6).padStart(6,'0').replace(/(\d{3})(\d{3})/, '$1-$2').padStart(7,' '),
      padLeft(bankAccount.slice(0,9), 9),
      lodgeName,
      padLeft('00000000', 8, '0'),  // Withholding (zero)
    ].join('')
    lines.push(detail.slice(0, 120))

    creditTotal += net
    recordCount++
  }

  if (recordCount === 0) {
    return NextResponse.json({ error: 'No employees with valid net pay to export' }, { status: 422 })
  }

  // === FILE TOTAL RECORD (trailer) ===
  // 1=7, 2-8=blank(7), 9-20=BSB and account(blank,12), 21=blank,
  // 22-30=credit total(10), 31-39=debit total(10), …, 75-80=count(6)
  const trailer = [
    '7',
    padRight('999-999', 7),
    padLeft('', 12),
    ' ',
    padLeft(String(creditTotal),  10, '0'),   // credit total (cents)
    padLeft('0000000000', 10, '0'),            // debit total (always 0 for payroll)
    padRight('', 24),                           // blank
    padLeft(String(recordCount), 6, '0'),       // record count
    padRight('', 40),                           // blank
  ].join('')
  lines.push(trailer.slice(0, 120))

  const abaContent = lines.join('\r\n') + '\r\n'
  const filename = `payroll-${run.name.replace(/[^a-z0-9]/gi, '-')}-${payDate}.aba`

  return new NextResponse(abaContent, {
    status: 200,
    headers: {
      'Content-Type':        'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
