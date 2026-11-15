/**
 * GET  /api/tenant/offer-letters/[id]/letter          — branded offer letter HTML (preview)
 * GET  /api/tenant/offer-letters/[id]/letter?print=1  — same, auto-opens print dialog
 * POST /api/tenant/offer-letters/[id]/letter          — uploads letter to Blob, saves pdfUrl
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { offerLetters, offerLetterEvents, tenants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { put } from '@vercel/blob'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

function resolveStaticLogo(orgName: string): string | null {
  try {
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const p = path.join(process.cwd(), 'public', 'logos', `${slug}.png`)
    if (fs.existsSync(p)) {
      return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
    }
  } catch { /* ignore */ }
  return null
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d.includes('T') ? d : d + 'T00:00:00') : d
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

const EMP_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time', casual: 'Casual', contractor: 'Contractor',
}

function fmtSalary(amount: number | null, cycle: string): string | null {
  if (!amount) return null
  const f = amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
  const c = cycle === 'annual' ? 'per annum' : cycle === 'hourly' ? 'per hour' : `per ${cycle}`
  return `${f} ${c}`
}

function buildLetterHtml(o: {
  orgName: string; orgAddress: string | null; abn: string | null; logoUrl: string | null
  candidateName: string; candidateEmail: string | null
  position: string; department: string | null; employmentType: string
  startDate: string | null; salaryAmount: number | null; salaryCycle: string
  templateContent: string | null; expiresAt: Date | string | null
  refId: string; autoPrint: boolean
}) {
  const firstName = o.candidateName.split(' ')[0]
  const salary = fmtSalary(o.salaryAmount, o.salaryCycle)

  const detailRow = (label: string, value: string | null) =>
    value ? `<tr><td class="dl">${label}</td><td class="dv">${esc(value)}</td></tr>` : ''

  const body = o.templateContent
    ? `<div class="content">${esc(o.templateContent)}</div>`
    : `
    <p>Dear ${esc(firstName)},</p>
    <p>We are pleased to offer you employment with <strong>${esc(o.orgName)}</strong> on the terms set out below. This letter, once accepted, forms the basis of your employment agreement with us.</p>
    <table class="details">
      ${detailRow('Position', o.position)}
      ${detailRow('Department', o.department)}
      ${detailRow('Employment Basis', EMP_TYPE_LABELS[o.employmentType] ?? o.employmentType)}
      ${detailRow('Commencement Date', o.startDate ? fmtDate(o.startDate) : null)}
      ${detailRow('Remuneration', salary)}
    </table>
    <p>Your remuneration is inclusive of base salary and exclusive of superannuation, which will be paid in addition at the applicable Superannuation Guarantee rate into your nominated fund.</p>
    <p>Your employment will be subject to the terms of your employment agreement, our workplace policies as amended from time to time, and the satisfactory completion of any pre-employment checks.</p>
    <p>To accept this offer, please sign where indicated below${o.expiresAt ? ` by <strong>${fmtDate(o.expiresAt)}</strong>` : ''}. We look forward to welcoming you to the team.</p>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Offer of Employment — ${esc(o.candidateName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Source Sans Pro','Segoe UI',Arial,sans-serif; background:#fff; color:#1a1a1a; font-size:13.5px; line-height:1.65; }
  .page { max-width: 760px; margin: 0 auto; padding: 44px 48px; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:34px; }
  .logo { height:58px; max-width:230px; object-fit:contain; }
  .org-name-text { font-size:22px; font-weight:700; color:#0E3D52; }
  .org-block { text-align:right; font-size:12px; color:#444; line-height:1.5; }
  .org-block .nm { font-weight:700; font-size:13px; color:#1a1a1a; }
  .date { margin-bottom:22px; }
  .confidential { font-weight:700; font-size:12px; letter-spacing:.04em; margin-bottom:4px; }
  .addressee { margin-bottom:26px; }
  .subject { font-weight:700; font-size:15px; margin-bottom:20px; }
  p { margin-bottom:14px; }
  .content { white-space: pre-wrap; }
  table.details { border-collapse:collapse; margin:20px 0 22px; width:100%; }
  .details td { padding:8px 14px; border:1px solid #ddd; font-size:13px; }
  .details .dl { background:#f1f1f1; font-weight:600; width:200px; }
  .sign { margin-top:44px; display:flex; justify-content:space-between; gap:40px; }
  .sig-block { flex:1; }
  .sig-block .for { font-size:12px; color:#555; margin-bottom:38px; }
  .sig-line { border-top:1px solid #1a1a1a; padding-top:6px; font-size:12px; }
  .footer { margin-top:48px; border-top:1px solid #eee; padding-top:10px; display:flex; justify-content:space-between; font-size:10.5px; color:#999; }
  @media print { .page { padding: 12mm 15mm; } }
</style>
</head>
<body>
<div class="page">
  <div class="top">
    ${o.logoUrl ? `<img class="logo" src="${o.logoUrl}" alt="${esc(o.orgName)}"/>` : `<div class="org-name-text">${esc(o.orgName)}</div>`}
    <div class="org-block">
      <div class="nm">${esc(o.orgName)}</div>
      ${o.orgAddress ? esc(o.orgAddress).replace(/\n/g, '<br/>') + '<br/>' : ''}
      ${o.abn ? `ABN ${esc(o.abn)}` : ''}
    </div>
  </div>

  <p class="date">${fmtDate(new Date())}</p>

  <div class="addressee">
    <p class="confidential">PRIVATE &amp; CONFIDENTIAL</p>
    <p>${esc(o.candidateName)}${o.candidateEmail ? `<br/><span style="color:#555;font-size:12.5px;">${esc(o.candidateEmail)}</span>` : ''}</p>
  </div>

  <p class="subject">Offer of Employment — ${esc(o.position)}</p>

  ${body}

  <div class="sign">
    <div class="sig-block">
      <div class="for">For and on behalf of ${esc(o.orgName)}</div>
      <div class="sig-line">Signature &nbsp;&middot;&nbsp; Name &nbsp;&middot;&nbsp; Date</div>
    </div>
    <div class="sig-block">
      <div class="for">Accepted by ${esc(o.candidateName)}</div>
      <div class="sig-line">Signature &nbsp;&middot;&nbsp; Date</div>
    </div>
  </div>

  <div class="footer">
    <p>Ref: ${o.refId.slice(0, 8).toUpperCase()}</p>
    <p>This is a computer-generated document.</p>
  </div>
</div>
${o.autoPrint ? '<script>window.onload=()=>{window.print()}</script>' : ''}
</body>
</html>`
}

async function loadOffer(id: string, tenantId: string) {
  const [row] = await db
    .select({
      id:              offerLetters.id,
      candidateName:   offerLetters.candidateName,
      candidateEmail:  offerLetters.candidateEmail,
      position:        offerLetters.position,
      department:      offerLetters.department,
      employmentType:  offerLetters.employmentType,
      startDate:       offerLetters.startDate,
      salaryAmount:    offerLetters.salaryAmount,
      salaryCycle:     offerLetters.salaryCycle,
      templateContent: offerLetters.templateContent,
      expiresAt:       offerLetters.expiresAt,
      orgName:         tenants.name,
      orgLogo:         tenants.logoUrl,
      orgSettings:     tenants.settings,
    })
    .from(offerLetters)
    .leftJoin(tenants, eq(offerLetters.tenantId, tenants.id))
    .where(and(eq(offerLetters.id, id), eq(offerLetters.tenantId, tenantId)))
  return row ?? null
}

function htmlFromRow(row: NonNullable<Awaited<ReturnType<typeof loadOffer>>>, autoPrint: boolean) {
  const orgName  = row.orgName ?? 'Organisation'
  const settings = (row.orgSettings as Record<string, unknown>) ?? {}
  return buildLetterHtml({
    orgName,
    orgAddress:      (settings.address as string) ?? null,
    abn:             (settings.abn as string) ?? null,
    logoUrl:         row.orgLogo ?? resolveStaticLogo(orgName),
    candidateName:   row.candidateName,
    candidateEmail:  row.candidateEmail,
    position:        row.position,
    department:      row.department,
    employmentType:  row.employmentType,
    startDate:       row.startDate,
    salaryAmount:    row.salaryAmount,
    salaryCycle:     row.salaryCycle,
    templateContent: row.templateContent,
    expiresAt:       row.expiresAt,
    refId:           row.id,
    autoPrint,
  })
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  try {
    const guard = await apiGuard('contracts:read')
    if (guard.error) return guard.error
    const { session } = guard

    const row = await loadOffer(id, session.tenantId)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const autoPrint = req.nextUrl.searchParams.get('print') === '1'
    return new NextResponse(htmlFromRow(row, autoPrint), { headers: { 'Content-Type': 'text/html' } })
  } catch (err) {
    console.error('GET /api/tenant/offer-letters/[id]/letter', err)
    return NextResponse.json({ error: 'Failed to build offer letter' }, { status: 500 })
  }
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params
  try {
    const guard = await apiGuard('contracts:write')
    if (guard.error) return guard.error
    const { session } = guard

    const row = await loadOffer(id, session.tenantId)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const html = htmlFromRow(row, false)
    const blob = await put(`offer-letters/${session.tenantId}/${id}.html`, html, {
      access: 'public', contentType: 'text/html', addRandomSuffix: false,
    })

    await db.update(offerLetters)
      .set({ pdfUrl: blob.url, updatedAt: new Date() })
      .where(and(eq(offerLetters.id, id), eq(offerLetters.tenantId, session.tenantId)))

    await db.insert(offerLetterEvents).values({
      tenantId:    session.tenantId,
      offerId:     id,
      event:       'pdf_generated',
      note:        'Branded offer letter generated',
      performedBy: session.email ?? 'system',
    })

    return NextResponse.json({ ok: true, pdfUrl: blob.url })
  } catch (err) {
    console.error('POST /api/tenant/offer-letters/[id]/letter', err)
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to generate offer letter', detail }, { status: 500 })
  }
}
