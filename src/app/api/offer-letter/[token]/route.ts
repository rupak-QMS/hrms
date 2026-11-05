/**
 * GET  /api/offer-letter/:token  — public offer letter details (no auth required)
 * POST /api/offer-letter/:token  — accept or reject (no auth required)
 *
 * :token is the offerLetters.acceptanceToken (uuid, unguessable one-time token).
 *
 * POST body: { action: 'accept' | 'reject', signature?: string (base64 PNG dataURL) }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { offerLetters, offerLetterEvents, tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getTenantEmailCtx, fireEmail, getTenantRoleEmails } from '@/lib/email/emailHelper'
import { genericNotificationEmail } from '@/lib/email/templates'
import { notifyRole } from '@/lib/notifications/notify'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ token: string }> }

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params

  try {
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
        pdfUrl:          offerLetters.pdfUrl,
        status:          offerLetters.status,
        sentAt:          offerLetters.sentAt,
        acceptedAt:      offerLetters.acceptedAt,
        rejectedAt:      offerLetters.rejectedAt,
        expiresAt:       offerLetters.expiresAt,
        tenantId:        offerLetters.tenantId,
        orgName:         tenants.name,
        logoUrl:         tenants.logoUrl,
        primaryColor:    tenants.primaryColor,
      })
      .from(offerLetters)
      .leftJoin(tenants, eq(offerLetters.tenantId, tenants.id))
      .where(eq(offerLetters.acceptanceToken, token))
      .limit(1)

    if (!row) {
      return NextResponse.json({ error: 'Offer not found or link is invalid.' }, { status: 404 })
    }

    if (row.status === 'draft') {
      return NextResponse.json({ error: 'This offer has not been sent yet.' }, { status: 403 })
    }

    // Check expiry
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      return NextResponse.json({
        id:            row.id,
        status:        'expired',
        candidateName: row.candidateName,
        orgName:       row.orgName,
        logoUrl:       row.logoUrl,
        primaryColor:  row.primaryColor ?? '#0E3D52',
      })
    }

    return NextResponse.json({
      id:              row.id,
      type:            'offer_letter',
      status:          row.status,
      candidateName:   row.candidateName,
      candidateEmail:  row.candidateEmail,
      position:        row.position,
      department:      row.department,
      employmentType:  row.employmentType,
      startDate:       row.startDate,
      salaryAmount:    row.salaryAmount,
      salaryCycle:     row.salaryCycle,
      templateContent: row.templateContent,
      pdfUrl:          row.pdfUrl,
      sentAt:          row.sentAt,
      acceptedAt:      row.acceptedAt,
      rejectedAt:      row.rejectedAt,
      expiresAt:       row.expiresAt,
      orgName:         row.orgName,
      logoUrl:         row.logoUrl,
      primaryColor:    row.primaryColor ?? '#0E3D52',
    })
  } catch (err: any) {
    console.error('offer-letter GET error:', err)
    return NextResponse.json({ error: 'Failed to load offer.' }, { status: 500 })
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params

  try {
    const body      = await req.json()
    const action    = body.action as 'accept' | 'reject'
    const signature = body.signature as string | undefined

    if (action !== 'accept' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be "accept" or "reject"' }, { status: 400 })
    }

    const [offer] = await db
      .select({
        id:             offerLetters.id,
        status:         offerLetters.status,
        tenantId:       offerLetters.tenantId,
        candidateName:  offerLetters.candidateName,
        candidateEmail: offerLetters.candidateEmail,
        position:       offerLetters.position,
        expiresAt:      offerLetters.expiresAt,
        orgName:        tenants.name,
        logoUrl:        tenants.logoUrl,
        primaryColor:   tenants.primaryColor,
      })
      .from(offerLetters)
      .leftJoin(tenants, eq(offerLetters.tenantId, tenants.id))
      .where(eq(offerLetters.acceptanceToken, token))
      .limit(1)

    if (!offer) {
      return NextResponse.json({ error: 'Offer not found.' }, { status: 404 })
    }

    if (offer.status === 'draft') {
      return NextResponse.json({ error: 'This offer has not been sent yet.' }, { status: 403 })
    }

    if (offer.status === 'accepted' || offer.status === 'rejected' || offer.status === 'withdrawn') {
      return NextResponse.json({ error: 'This offer has already been responded to.' }, { status: 409 })
    }

    if (offer.expiresAt && new Date(offer.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This offer has expired.' }, { status: 410 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
               ?? req.headers.get('x-real-ip')
               ?? 'unknown'

    const now = new Date()

    if (action === 'accept') {
      await db.update(offerLetters)
        .set({
          status:     'accepted',
          acceptedAt: now,
          updatedAt:  now,
          // Store signature in payslipData-like field — use notes for now as a simple audit trail
          notes: signature ? `Signed electronically. IP: ${ip}` : `Accepted electronically. IP: ${ip}`,
        })
        .where(eq(offerLetters.id, offer.id))

      // Log event
      await db.insert(offerLetterEvents).values({
        tenantId:    offer.tenantId,
        offerId:     offer.id,
        event:       'accepted',
        note:        `Candidate accepted offer electronically. IP: ${ip}`,
        performedBy: 'candidate',
      }).catch(() => {})

      // Notify HR via email + in-app
      ;(async () => {
        try {
          const ctx      = await getTenantEmailCtx(offer.tenantId)
          const hrEmails = await getTenantRoleEmails(offer.tenantId, ['hr_officer', 'director'])

          if (hrEmails.length > 0) {
            fireEmail(ctx, {
              to: hrEmails,
              ...genericNotificationEmail({
                recipientName: 'HR Team',
                orgName:       ctx.orgName,
                logoUrl:       ctx.logoUrl,
                primaryColor:  ctx.primaryColor,
                title:         `🎉 Offer Letter Accepted — ${offer.candidateName}`,
                message:       `<strong>${offer.candidateName}</strong> has accepted the offer for <strong>${offer.position}</strong>. You can now proceed with onboarding.`,
                ctaLabel:      'View Offer Letters',
                ctaUrl:        `${ctx.loginUrl}/tenant/offer-letters`,
              }),
            })
          }

          // Send confirmation to candidate
          if (offer.candidateEmail) {
            fireEmail(ctx, {
              to: offer.candidateEmail,
              ...genericNotificationEmail({
                recipientName: offer.candidateName,
                orgName:       ctx.orgName,
                logoUrl:       ctx.logoUrl,
                primaryColor:  ctx.primaryColor,
                title:         `✅ Offer Accepted — ${offer.position}`,
                message:       `Thank you for accepting the offer for <strong>${offer.position}</strong> at <strong>${ctx.orgName}</strong>. We're excited to have you on the team! The HR team will be in touch with next steps.`,
                ctaLabel:      'Contact HR',
                ctaUrl:        ctx.loginUrl,
              }),
            })
          }

          notifyRole(offer.tenantId, ['hr_officer', 'director', 'operations_manager'], {
            type:  'document',
            title: `🎉 Offer accepted — ${offer.candidateName}`,
            body:  `${offer.candidateName} accepted the offer for ${offer.position}.`,
            link:  '/tenant/offer-letters',
          })
        } catch (e) { console.error('offer-letter accept notify error:', e) }
      })()

      return NextResponse.json({ ok: true, status: 'accepted' })

    } else {
      // Rejected
      await db.update(offerLetters)
        .set({
          status:     'rejected',
          rejectedAt: now,
          updatedAt:  now,
          notes: `Declined electronically. IP: ${ip}`,
        })
        .where(eq(offerLetters.id, offer.id))

      await db.insert(offerLetterEvents).values({
        tenantId:    offer.tenantId,
        offerId:     offer.id,
        event:       'rejected',
        note:        `Candidate declined offer electronically. IP: ${ip}`,
        performedBy: 'candidate',
      }).catch(() => {})

      // Notify HR
      ;(async () => {
        try {
          const ctx      = await getTenantEmailCtx(offer.tenantId)
          const hrEmails = await getTenantRoleEmails(offer.tenantId, ['hr_officer', 'director'])

          if (hrEmails.length > 0) {
            fireEmail(ctx, {
              to: hrEmails,
              ...genericNotificationEmail({
                recipientName: 'HR Team',
                orgName:       ctx.orgName,
                logoUrl:       ctx.logoUrl,
                primaryColor:  ctx.primaryColor,
                title:         `Offer Letter Declined — ${offer.candidateName}`,
                message:       `<strong>${offer.candidateName}</strong> has declined the offer for <strong>${offer.position}</strong>. You may wish to follow up.`,
                ctaLabel:      'View Offer Letters',
                ctaUrl:        `${ctx.loginUrl}/tenant/offer-letters`,
              }),
            })
          }

          notifyRole(offer.tenantId, ['hr_officer', 'director'], {
            type:  'document',
            title: `Offer declined — ${offer.candidateName}`,
            body:  `${offer.candidateName} declined the offer for ${offer.position}.`,
            link:  '/tenant/offer-letters',
          })
        } catch (e) { console.error('offer-letter reject notify error:', e) }
      })()

      return NextResponse.json({ ok: true, status: 'rejected' })
    }
  } catch (err: any) {
    console.error('offer-letter POST error:', err)
    return NextResponse.json({ error: 'Failed to process response.' }, { status: 500 })
  }
}
