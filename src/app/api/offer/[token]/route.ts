/**
 * GET  /api/offer/:token  — public offer details (no auth required)
 * POST /api/offer/:token  — accept or reject offer (no auth required)
 *
 * :token is the contract UUID (unguessable, treated as a one-time token).
 *
 * POST body: { action: 'accept' | 'reject', signature?: string (base64 PNG) }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contracts, employees, tenants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantEmailCtx, fireEmail } from '@/lib/email/emailHelper'
import { contractSignedEmail, genericNotificationEmail } from '@/lib/email/templates'
import { getTenantRoleEmails } from '@/lib/email/emailHelper'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params

  try {
    const [row] = await db
      .select({
        id:          contracts.id,
        type:        contracts.type,
        status:      contracts.status,
        pdfUrl:      contracts.pdfUrl,
        sentAt:      contracts.sentAt,
        signedAt:    contracts.signedAt,
        tenantId:    contracts.tenantId,
        empFirst:    employees.firstName,
        empLast:     employees.lastName,
        empEmail:    employees.email,
        orgName:     tenants.name,
        logoUrl:     tenants.logoUrl,
        primaryColor:tenants.primaryColor,
      })
      .from(contracts)
      .leftJoin(employees, eq(contracts.employeeId, employees.id))
      .leftJoin(tenants,   eq(contracts.tenantId,   tenants.id))
      .where(eq(contracts.id, token))
      .limit(1)

    if (!row) {
      return NextResponse.json({ error: 'Offer not found or link is invalid.' }, { status: 404 })
    }

    // Don't expose contracts that are still drafts
    if (row.status === 'draft') {
      return NextResponse.json({ error: 'This offer has not been sent yet.' }, { status: 403 })
    }

    return NextResponse.json({
      id:          row.id,
      type:        row.type,
      status:      row.status,
      pdfUrl:      row.pdfUrl,
      sentAt:      row.sentAt,
      signedAt:    row.signedAt,
      candidateName: `${row.empFirst ?? ''} ${row.empLast ?? ''}`.trim(),
      orgName:     row.orgName,
      logoUrl:     row.logoUrl,
      primaryColor:row.primaryColor ?? '#0E3D52',
    })
  } catch (err: any) {
    console.error('offer GET error:', err)
    return NextResponse.json({ error: 'Failed to load offer.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params

  try {
    const body      = await req.json()
    const action    = body.action as 'accept' | 'reject'
    const signature = body.signature as string | undefined // base64 PNG dataURL

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be "accept" or "reject"' }, { status: 400 })
    }

    const [contract] = await db
      .select({
        id:        contracts.id,
        status:    contracts.status,
        tenantId:  contracts.tenantId,
        employeeId:contracts.employeeId,
        type:      contracts.type,
        empFirst:  employees.firstName,
        empLast:   employees.lastName,
        empEmail:  employees.email,
        orgName:   tenants.name,
        logoUrl:   tenants.logoUrl,
        primaryColor:tenants.primaryColor,
      })
      .from(contracts)
      .leftJoin(employees, eq(contracts.employeeId, employees.id))
      .leftJoin(tenants,   eq(contracts.tenantId,   tenants.id))
      .where(eq(contracts.id, token))
      .limit(1)

    if (!contract) {
      return NextResponse.json({ error: 'Offer not found.' }, { status: 404 })
    }

    if (contract.status === 'draft') {
      return NextResponse.json({ error: 'This offer has not been sent yet.' }, { status: 403 })
    }

    if (contract.status === 'signed' || contract.status === 'rejected') {
      return NextResponse.json({ error: 'This offer has already been responded to.' }, { status: 409 })
    }

    // Get IP for audit trail
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? 'unknown'

    if (action === 'accept') {
      await db
        .update(contracts)
        .set({
          status:        'signed',
          signedAt:      new Date(),
          signatureIp:   ip,
          signatureData: signature ?? null,
        })
        .where(eq(contracts.id, token))

      // Fire emails (non-blocking)
      const ctx = await getTenantEmailCtx(contract.tenantId).catch(() => null)
      if (ctx && contract.empEmail) {
        const loginUrl = ctx.loginUrl
        const candidateFullName = `${contract.empFirst ?? ''} ${contract.empLast ?? ''}`.trim()
        fireEmail(ctx, {
          to: contract.empEmail,
          ...contractSignedEmail({
            recipientName: contract.empFirst ?? 'Candidate',
            orgName:       ctx.orgName,
            logoUrl:       ctx.logoUrl,
            primaryColor:  ctx.primaryColor,
            employeeName:  candidateFullName,
            contractType:  contract.type,
            signedAt:      new Date().toISOString(),
            loginUrl,
          }),
        })

        // Notify HR officers
        const hrEmails = await getTenantRoleEmails(contract.tenantId, ['hr_officer', 'director'])
        if (hrEmails.length > 0) {
          fireEmail(ctx, {
            to: hrEmails,
            ...genericNotificationEmail({
              recipientName: 'HR Team',
              orgName:       ctx.orgName,
              logoUrl:       ctx.logoUrl,
              primaryColor:  ctx.primaryColor,
              title:         `Offer Letter Accepted — ${candidateFullName}`,
              message:       `<strong>${candidateFullName}</strong> has accepted their <strong>${contract.type}</strong> offer letter. You can now proceed with onboarding.`,
              ctaLabel:      'View Contract',
              ctaUrl:        `${loginUrl}/tenant/contracting`,
            }),
          })
        }
      }

      return NextResponse.json({ ok: true, status: 'signed' })
    } else {
      // Rejected
      await db
        .update(contracts)
        .set({ status: 'rejected' })
        .where(eq(contracts.id, token))

      // Notify HR
      const ctx = await getTenantEmailCtx(contract.tenantId).catch(() => null)
      if (ctx) {
        const hrEmails = await getTenantRoleEmails(contract.tenantId, ['hr_officer', 'director'])
        if (hrEmails.length > 0) {
          const candidateName = `${contract.empFirst ?? ''} ${contract.empLast ?? ''}`.trim()
          fireEmail(ctx, {
            to: hrEmails,
            ...genericNotificationEmail({
              recipientName: 'HR Team',
              orgName:       ctx.orgName,
              logoUrl:       ctx.logoUrl,
              primaryColor:  ctx.primaryColor,
              title:         `Offer Letter Declined — ${candidateName}`,
              message:       `<strong>${candidateName}</strong> has <strong>declined</strong> their <strong>${contract.type}</strong> offer. Please follow up with the candidate.`,
              ctaLabel:      'View Contract',
              ctaUrl:        `${ctx.loginUrl}/tenant/contracting`,
            }),
          })
        }
      }

      return NextResponse.json({ ok: true, status: 'rejected' })
    }
  } catch (err: any) {
    console.error('offer POST error:', err)
    return NextResponse.json({ error: 'Failed to process response.' }, { status: 500 })
  }
}
