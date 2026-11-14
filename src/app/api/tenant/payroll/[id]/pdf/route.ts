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
import { eq, and, lte, gte, sql } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
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

function resolveStaticLogo(orgName: string): string | null {
  // Fallback: look for a bundled logo at public/logos/<slug>.png and embed as data URI
  try {
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const p = path.join(process.cwd(), 'public', 'logos', `${slug}.png`)
    if (fs.existsSync(p)) {
      return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
    }
  } catch { /* ignore */ }
  return null
}

type Ytd = { gross: number; payg: number; medicare: number; superC: number; net: number }

function buildPayslipHtml(opts: {
  orgName:        string
  orgAddress:     string | null
  abn:            string | null
  logoUrl:        string | null
  employeeName:   string
  employeeNumber: string | null
  employeeAddress:string | null
  employmentType: string | null
  annualSalary:   string | null
  periodStart:    string
  periodEnd:      string
  paymentDate:    string
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
  ytd:            Ytd
  recordId:       string
}) {
  const o = opts
  const empBasis = o.employmentType
    ? o.employmentType.replace(/_/g, '-').replace(/\b\w/g, c => c.toUpperCase()) + ' employment'
    : null

  const salaryRows: string[] = []
  if (o.hoursWorked && o.hourlyRate) {
    salaryRows.push(`<tr>
      <td class="lbl">Base hourly</td>
      <td class="num">${Number(o.hoursWorked).toFixed(4)}</td>
      <td class="num">${fmt(o.hourlyRate)}</td>
      <td class="num">${fmt(Number(o.hoursWorked) * Number(o.hourlyRate))}</td>
      <td class="num">${fmt(o.ytd.gross - o.allowances)}</td>
    </tr>`)
  } else {
    salaryRows.push(`<tr>
      <td class="lbl">Base pay (${o.frequency})</td>
      <td class="num"></td><td class="num"></td>
      <td class="num">${fmt(o.grossPay)}</td>
      <td class="num">${fmt(o.ytd.gross)}</td>
    </tr>`)
  }
  if (o.allowances > 0) {
    salaryRows.push(`<tr>
      <td class="lbl">Allowances</td>
      <td class="num"></td><td class="num"></td>
      <td class="num">${fmt(o.allowances)}</td>
      <td class="num"></td>
    </tr>`)
  }

  const section = (title: string, rows: string, totalThis: string, totalYtd: string) => `
    <table class="sec">
      <thead><tr><th class="sec-title" colspan="3">${title}</th><th class="col-h">THIS PAY</th><th class="col-h">YTD</th></tr></thead>
      <tbody>${rows}
        <tr class="total"><td colspan="2"></td><td class="num total-lbl">TOTAL</td><td class="num b">${totalThis}</td><td class="num b">${totalYtd}</td></tr>
      </tbody>
    </table>`

  const taxRows = `<tr><td class="lbl">PAYG</td><td></td><td></td><td class="num">${fmt(o.paygWithholding)}</td><td class="num">${fmt(o.ytd.payg)}</td></tr>
    ${Number(o.medicareLevy ?? 0) > 0 ? `<tr><td class="lbl">Medicare Levy</td><td></td><td></td><td class="num">${fmt(o.medicareLevy)}</td><td class="num">${fmt(o.ytd.medicare)}</td></tr>` : ''}`
  const totalTaxThis = Number(o.paygWithholding ?? 0) + Number(o.medicareLevy ?? 0)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Payslip — ${o.employeeName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Source Sans Pro','Segoe UI',Arial,sans-serif; background:#fff; color:#1a1a1a; font-size:13px; }
  .page { max-width: 780px; margin: 0 auto; padding: 36px 40px; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
  .logo { height:56px; max-width:220px; object-fit:contain; }
  .org-name-text { font-size:22px; font-weight:700; color:#0E3D52; }
  .box { background:#f1f1f1; padding:14px 18px; min-width:230px; }
  .box h3 { font-size:12px; font-weight:700; letter-spacing:.02em; margin-bottom:6px; }
  .box p { font-size:12.5px; line-height:1.45; }
  .mid { display:flex; justify-content:space-between; align-items:flex-end; margin:26px 0 18px; }
  .emp p { font-size:14px; line-height:1.5; }
  .emp .name { font-weight:600; }
  .strip { background:#ececec; display:flex; justify-content:space-between; padding:10px 16px; font-size:12.5px; margin-bottom:6px; }
  .strip b { font-weight:700; }
  table.sec { width:100%; border-collapse:collapse; margin-top:22px; }
  .sec-title { text-align:left; font-size:12px; font-weight:700; padding:6px 0; border-bottom:1px solid #ccc; }
  .col-h { text-align:right; font-size:11px; font-weight:700; color:#333; padding:6px 0; border-bottom:1px solid #ccc; width:95px; }
  td { padding:7px 0; font-size:12.5px; }
  td.lbl { color:#1a1a1a; }
  td.num { text-align:right; font-variant-numeric: tabular-nums; }
  tr.total td { background:#ececec; padding:8px 8px; }
  td.total-lbl { font-size:11px; color:#555; }
  .b { font-weight:700; }
  .pay-details { margin-top:28px; }
  .pay-details .hdr { display:flex; justify-content:space-between; font-size:12px; font-weight:700; border-bottom:1px solid #ccc; padding-bottom:6px; }
  .pay-details .row { display:flex; justify-content:space-between; padding:8px 0; font-size:12.5px; }
  .footer { margin-top:40px; display:flex; justify-content:space-between; font-size:10.5px; color:#999; border-top:1px solid #eee; padding-top:10px; }
  @media print { .page { padding: 10mm 12mm; } }
</style>
</head>
<body>
<div class="page">
  <div class="top">
    ${o.logoUrl ? `<img class="logo" src="${o.logoUrl}" alt="${o.orgName}"/>` : `<div class="org-name-text">${o.orgName}</div>`}
    <div class="box">
      <h3>PAID BY</h3>
      <p>${o.orgName}${o.orgAddress ? `<br/>${o.orgAddress.replace(/\n/g, '<br/>')}` : ''}${o.abn ? `<br/>ABN ${o.abn}` : ''}</p>
    </div>
  </div>

  <div class="mid">
    <div class="emp">
      <p class="name">${o.employeeName}</p>
      ${o.employeeAddress ? `<p>${o.employeeAddress.replace(/\n/g, '<br/>')}</p>` : ''}
      ${o.employeeNumber ? `<p style="color:#777;font-size:12px;">Employee # ${o.employeeNumber}</p>` : ''}
    </div>
    <div class="box">
      <h3>EMPLOYMENT DETAILS</h3>
      <p>Pay Frequency: ${o.frequency.charAt(0).toUpperCase() + o.frequency.slice(1)}
      ${o.annualSalary ? `<br/>Annual Salary: ${fmt(o.annualSalary)}` : ''}
      ${empBasis ? `<br/>Employment Basis: ${empBasis}` : ''}</p>
    </div>
  </div>

  <div class="strip">
    <span>Pay Period: <b>${o.periodStart.split('-').reverse().join('/')} - ${o.periodEnd.split('-').reverse().join('/')}</b></span>
    <span>Payment Date: <b>${o.paymentDate}</b></span>
    <span>Total Earnings: <b>${fmt(o.grossPay)}</b></span>
    <span>Net Pay: <b>${fmt(o.netPay)}</b></span>
  </div>

  ${section('SALARY & WAGES', salaryRows.join(''), fmt(o.grossPay), fmt(o.ytd.gross))}

  ${o.deductions > 0 ? section('DEDUCTIONS',
    `<tr><td class="lbl">Other Deductions</td><td></td><td></td><td class="num">${fmt(o.deductions)}</td><td class="num"></td></tr>`,
    fmt(o.deductions), '') : ''}

  ${section('TAX', taxRows, fmt(totalTaxThis), fmt(o.ytd.payg + o.ytd.medicare))}

  ${Number(o.superContrib ?? 0) > 0 ? section('SUPERANNUATION',
    `<tr><td class="lbl">SGC — Superannuation Guarantee</td><td></td><td></td><td class="num">${fmt(o.superContrib)}</td><td class="num">${fmt(o.ytd.superC)}</td></tr>`,
    fmt(o.superContrib), fmt(o.ytd.superC)) : ''}

  <div class="pay-details">
    <div class="hdr"><span>PAYMENT DETAILS</span><span>AMOUNT</span></div>
    <div class="row"><span>Net pay — ${o.employeeName}</span><span class="b">${fmt(o.netPay)}</span></div>
  </div>

  <div class="footer">
    <p>Payslip ID: ${o.recordId.slice(0, 8).toUpperCase()} · Generated ${new Date().toLocaleDateString('en-AU', { dateStyle: 'long' })}</p>
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
        empNumber:         employees.employeeNumber,
        empAddress:        employees.address,
        empType:           employees.employmentType,
        empAnnualSalary:   employees.annualSalary,
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

    // Year-to-date totals for the Australian financial year containing this period's end
    const pe = new Date(row.periodEnd + 'T00:00:00')
    const fyStartYear = pe.getMonth() >= 6 ? pe.getFullYear() : pe.getFullYear() - 1
    const fyStart = `${fyStartYear}-07-01`
    const [ytdRow] = await db
      .select({
        gross:    sql<string>`coalesce(sum(${payrollRecords.grossPay}), 0)`,
        payg:     sql<string>`coalesce(sum(${payrollRecords.paygWithholding}), 0)`,
        medicare: sql<string>`coalesce(sum(${payrollRecords.medicareLevy}), 0)`,
        superC:   sql<string>`coalesce(sum(${payrollRecords.superContribution}), 0)`,
        net:      sql<string>`coalesce(sum(${payrollRecords.netPay}), 0)`,
      })
      .from(payrollRecords)
      .where(and(
        eq(payrollRecords.tenantId, session.tenantId),
        eq(payrollRecords.employeeId, row.employeeId),
        gte(payrollRecords.periodStart, fyStart),
        lte(payrollRecords.periodEnd, row.periodEnd),
      ))
    const ytd = {
      gross:    Number(ytdRow?.gross ?? 0),
      payg:     Number(ytdRow?.payg ?? 0),
      medicare: Number(ytdRow?.medicare ?? 0),
      superC:   Number(ytdRow?.superC ?? 0),
      net:      Number(ytdRow?.net ?? 0),
    }

    const pd          = (row.payslipData as Record<string, unknown>) ?? {}
    const allowances  = Number(pd.allowances ?? 0)
    const deductions  = Number(pd.deductions ?? 0)
    const frequency   = (pd.frequency as string) ?? 'fortnightly'
    const effectiveTax = pd.effectiveTaxRate != null ? Number(pd.effectiveTaxRate) : null
    const abn         = (row.orgAbn as Record<string, unknown>)?.abn as string | null ?? null

    const employeeName = `${row.empFirst ?? ''} ${row.empLast ?? ''}`.trim() || 'Employee'
    const employeeEmail = row.empEmail ?? ''

    const orgName    = row.orgName ?? 'Organisation'
    const orgAddress = (row.orgAbn as Record<string, unknown>)?.address as string | null ?? null
    const logoUrl    = row.orgLogo ?? resolveStaticLogo(orgName)
    const paymentDate = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })

    // Build HTML payslip
    const html = buildPayslipHtml({
      orgName,
      orgAddress,
      abn,
      logoUrl,
      employeeName,
      employeeNumber:  row.empNumber ?? null,
      employeeAddress: row.empAddress ?? null,
      employmentType:  row.empType ?? null,
      annualSalary:    row.empAnnualSalary ?? null,
      periodStart:     row.periodStart,
      periodEnd:       row.periodEnd,
      paymentDate,
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
      ytd,
      recordId:        row.id,
    })

    // Preview mode: return the HTML directly without uploading (used for QA/local)
    if (body.preview === true) {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
    }

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
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to generate payslip', detail }, { status: 500 })
  }
}
