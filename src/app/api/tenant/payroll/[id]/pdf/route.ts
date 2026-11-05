/**
 * POST /api/tenant/payroll/[id]/pdf
 *
 * Generates a payslip PDF for the given payroll record, uploads it to
 * Vercel Blob, saves the URL back to the record, and optionally emails
 * it to the employee.
 *
 * Body: { emailEmployee?: boolean }   (defaults to false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { payrollRecords, employees, tenants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { put } from '@vercel/blob'
import { getTenantEmailCtx, fireEmail } from '@/lib/email/emailHelper'
import { payslipReadyEmail } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

function fmt(n: number | string | null | undefined) {
  if (n == null) return '$0.00'
  return `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildPayslipHtml(opts: {
  orgName:        string
  abn:            string | null
  logoUrl:        string | null
  primaryColor:   string
  employeeName:   string
  employeeEmail:  string
  periodStart:    string
  periodEnd:      string
  frequency:      string
  grossPay:       string | null
  paygWithholding:string | null
  medicareLevy:   string | null
  superContrib:   string | null
  netPay:         string | null
  hoursWorked:    string | null
  hourlyRate:     string | null
  allowances:     number
  deductions:     number
  effectiveTax:   number | null
  recordId:       string
}) {
  const color = opts.primaryColor || '#0E3D52'
  const rows: { label: string; amount: string; bold?: boolean; indent?: boolean; negative?: boolean }[] = []

  if (opts.hoursWorked && opts.hourlyRate) {
    rows.push({ label: `Base Pay (${opts.hoursWorked} hrs × ${fmt(opts.hourlyRate)}/hr)`, amount: fmt(Number(opts.hoursWorked) * Number(opts.hourlyRate)) })
  } else {
    rows.push({ label: `Base Pay (${opts.frequency})`, amount: fmt(opts.grossPay) })
  }

  if (opts.allowances > 0) rows.push({ label: 'Allowances', amount: fmt(opts.allowances), indent: true })
  rows.push({ label: 'Gross Pay', amount: fmt(opts.grossPay), bold: true })
  rows.push({ label: 'PAYG Withholding', amount: fmt(opts.paygWithholding), negative: true })
  rows.push({ label: 'Medicare Levy', amount: fmt(opts.medicareLevy), negative: true })
  if (opts.deductions > 0) rows.push({ label: 'Other Deductions', amount: fmt(opts.deductions), negative: true })
  rows.push({ label: 'Net Pay', amount: fmt(opts.netPay), bold: true })

  const rowsHtml = rows.map(r => `
    <tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:10px 0;${r.indent ? 'padding-left:16px;' : ''}color:${r.bold ? '#111827' : '#374151'};font-weight:${r.bold ? '600' : '400'};font-size:14px;">
        ${r.label}
      </td>
      <td style="padding:10px 0;text-align:right;color:${r.negative ? '#dc2626' : r.bold ? '#111827' : '#374151'};font-weight:${r.bold ? '600' : '400'};font-size:14px;">
        ${r.negative && r.amount !== '$0.00' ? '−' : ''}${r.amount}
      </td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Payslip — ${opts.employeeName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f9fafb; color: #111827; }
  .page { max-width: 680px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, ${color}, ${color}cc); padding: 32px; color: #fff; display: flex; align-items: center; gap: 20px; }
  .header-text h1 { font-size: 22px; font-weight: 700; }
  .header-text p { font-size: 13px; opacity: 0.8; margin-top: 2px; }
  .logo { height: 48px; max-width: 120px; object-fit: contain; background: rgba(255,255,255,0.2); border-radius: 8px; padding: 6px; }
  .logo-placeholder { width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 24px 32px; border-bottom: 1px solid #f3f4f6; }
  .meta-item label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; display: block; margin-bottom: 3px; }
  .meta-item span { font-size: 14px; font-weight: 500; color: #111827; }
  .breakdown { padding: 24px 32px; }
  .breakdown h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  .net-box { margin: 24px 32px; background: ${color}10; border: 1.5px solid ${color}40; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; }
  .net-box .label { font-size: 13px; color: #6b7280; }
  .net-box .amount { font-size: 28px; font-weight: 700; color: ${color}; }
  .super-box { margin: 0 32px 24px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; }
  .super-box .label { font-size: 13px; color: #15803d; }
  .super-box .amount { font-size: 16px; font-weight: 600; color: #15803d; }
  .footer { padding: 20px 32px; background: #f9fafb; border-top: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; }
  .footer p { font-size: 11px; color: #9ca3af; }
  @media print { body { background: #fff; } .page { box-shadow: none; margin: 0; border-radius: 0; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    ${opts.logoUrl
      ? `<img class="logo" src="${opts.logoUrl}" alt="${opts.orgName}"/>`
      : `<div class="logo-placeholder">${opts.orgName[0] ?? 'H'}</div>`}
    <div class="header-text">
      <h1>${opts.orgName}</h1>
      <p>Pay Slip${opts.abn ? ` · ABN ${opts.abn}` : ''}</p>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item"><label>Employee</label><span>${opts.employeeName}</span></div>
    <div class="meta-item"><label>Email</label><span>${opts.employeeEmail}</span></div>
    <div class="meta-item"><label>Pay Period</label><span>${fmtDate(opts.periodStart)} – ${fmtDate(opts.periodEnd)}</span></div>
    <div class="meta-item"><label>Frequency</label><span style="text-transform:capitalize">${opts.frequency}</span></div>
    ${opts.hoursWorked ? `<div class="meta-item"><label>Hours Worked</label><span>${opts.hoursWorked}</span></div>` : ''}
    ${opts.effectiveTax != null ? `<div class="meta-item"><label>Effective Tax Rate</label><span>${opts.effectiveTax.toFixed(1)}%</span></div>` : ''}
  </div>

  <div class="breakdown">
    <h2>Pay Breakdown</h2>
    <table>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>

  <div class="net-box">
    <div>
      <div class="label">NET PAY</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:2px;">Payable to ${opts.employeeName}</div>
    </div>
    <div class="amount">${fmt(opts.netPay)}</div>
  </div>

  ${Number(opts.superContrib ?? 0) > 0 ? `
  <div class="super-box">
    <span class="label">Superannuation Contribution (employer)</span>
    <span class="amount">${fmt(opts.superContrib)}</span>
  </div>` : ''}

  <div class="footer">
    <p>Payslip ID: ${opts.recordId.slice(0, 8).toUpperCase()} · Generated ${new Date().toLocaleDateString('en-AU', { dateStyle: 'long' })}</p>
    <p>This is a computer-generated document.</p>
  </div>
</div>
</body>
</html>`
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  try {
    const guard = await apiGuard('payroll:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body              = await req.json().catch(() => ({}))
    const emailEmployee     = body.emailEmployee === true

    // Fetch record + employee + tenant
    const [row] = await db
      .select({
        id:                payrollRecords.id,
        employeeId:        payrollRecords.employeeId,
        periodStart:       payrollRecords.periodStart,
        periodEnd:         payrollRecords.periodEnd,
        hoursWorked:       payrollRecords.hoursWorked,
        hourlyRate:        payrollRecords.hourlyRate,
        grossPay:          payrollRecords.grossPay,
        paygWithholding:   payrollRecords.paygWithholding,
        medicareLevy:      payrollRecords.medicareLevy,
        superContribution: payrollRecords.superContribution,
        netPay:            payrollRecords.netPay,
        payslipData:       payrollRecords.payslipData,
        status:            payrollRecords.status,
        empFirst:          employees.firstName,
        empLast:           employees.lastName,
        empEmail:          employees.email,
        empEntityName:     employees.entityName,
        orgName:           tenants.name,
        orgLogo:           tenants.logoUrl,
        orgColor:          tenants.primaryColor,
        orgAbn:            tenants.settings,
      })
      .from(payrollRecords)
      .leftJoin(employees, eq(payrollRecords.employeeId, employees.id))
      .leftJoin(tenants,   eq(payrollRecords.tenantId,   tenants.id))
      .where(and(eq(payrollRecords.id, id), eq(payrollRecords.tenantId, session.tenantId)))

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const pd          = (row.payslipData as Record<string, unknown>) ?? {}
    const allowances  = Number(pd.allowances ?? 0)
    const deductions  = Number(pd.deductions ?? 0)
    const frequency   = (pd.frequency as string) ?? 'fortnightly'
    const effectiveTax = pd.effectiveTaxRate != null ? Number(pd.effectiveTaxRate) : null
    const abn         = (row.orgAbn as Record<string, unknown>)?.abn as string | null ?? null

    const employeeName = `${row.empFirst ?? ''} ${row.empLast ?? ''}`.trim() || 'Employee'
    const employeeEmail = row.empEmail ?? ''

    // Build HTML payslip
    const html = buildPayslipHtml({
      orgName:         row.orgName ?? 'Organisation',
      abn,
      logoUrl:         row.orgLogo ?? null,
      primaryColor:    row.orgColor ?? '#0E3D52',
      employeeName,
      employeeEmail,
      periodStart:     row.periodStart,
      periodEnd:       row.periodEnd,
      frequency,
      grossPay:        row.grossPay,
      paygWithholding: row.paygWithholding,
      medicareLevy:    row.medicareLevy,
      superContrib:    row.superContribution,
      netPay:          row.netPay,
      hoursWorked:     row.hoursWorked,
      hourlyRate:      row.hourlyRate,
      allowances,
      deductions,
      effectiveTax,
      recordId:        row.id,
    })

    // Upload to Vercel Blob as HTML (renders perfectly in browser / iframe)
    const fileName  = `payslips/${session.tenantId}/${id}.html`
    const blob = await put(fileName, html, {
      access:      'public',
      contentType: 'text/html',
      addRandomSuffix: false,
    })

    // Save URL back to payroll record
    await db.update(payrollRecords)
      .set({ payslipData: { ...pd, payslipUrl: blob.url } })
      .where(and(eq(payrollRecords.id, id), eq(payrollRecords.tenantId, session.tenantId)))

    // Email the employee if requested
    if (emailEmployee && employeeEmail) {
      ;(async () => {
        try {
          const ctx2 = await getTenantEmailCtx(session.tenantId)
          if (ctx2.notify.emailPayroll) {
            fireEmail(ctx2, {
              to: employeeEmail,
              ...payslipReadyEmail({
                recipientName: row.empFirst ?? employeeName,
                orgName:       ctx2.orgName,
                logoUrl:       ctx2.logoUrl,
                primaryColor:  ctx2.primaryColor,
                periodStart:   fmtDate(row.periodStart),
                periodEnd:     fmtDate(row.periodEnd),
                grossPay:      Number(row.grossPay ?? 0),
                netPay:        Number(row.netPay ?? 0),
                superAmount:   Number(row.superContribution ?? 0),
                loginUrl:      ctx2.loginUrl,
              }),
            })
          }
        } catch (e) { console.error('payslip email error:', e) }
      })()
    }

    return NextResponse.json({ ok: true, payslipUrl: blob.url })
  } catch (err) {
    console.error('POST /api/tenant/payroll/[id]/pdf', err)
    return NextResponse.json({ error: 'Failed to generate payslip' }, { status: 500 })
  }
}
