/**
 * POST /api/careers/apply
 * Public endpoint — no auth required.
 * Creates a candidate + application record from a public job application.
 *
 * Body (multipart/form-data OR JSON):
 *   tenantId, requisitionId, firstName, lastName, email, phone?,
 *   coverLetter?, resumeUrl? (if pre-uploaded), resume (File)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { candidates, applications, tenants, jobRequisitions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { put } from '@vercel/blob'
import { validateFile } from '@/lib/validateUpload'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    let tenantId: string, requisitionId: string
    let firstName: string, lastName: string, email: string
    let phone = '', coverLetter = '', resumeFile: File | null = null

    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const fd = await req.formData()
      tenantId      = String(fd.get('tenantId') ?? '')
      requisitionId = String(fd.get('requisitionId') ?? '')
      firstName     = String(fd.get('firstName') ?? '')
      lastName      = String(fd.get('lastName') ?? '')
      email         = String(fd.get('email') ?? '')
      phone         = String(fd.get('phone') ?? '')
      coverLetter   = String(fd.get('coverLetter') ?? '')
      resumeFile    = fd.get('resume') as File | null
    } else {
      const body    = await req.json()
      tenantId      = body.tenantId
      requisitionId = body.requisitionId
      firstName     = body.firstName
      lastName      = body.lastName
      email         = body.email
      phone         = body.phone ?? ''
      coverLetter   = body.coverLetter ?? ''
    }

    // Validate required fields
    if (!tenantId || !requisitionId || !firstName || !lastName || !email) {
      return NextResponse.json({ error: 'firstName, lastName, email, tenantId and requisitionId are required' }, { status: 400 })
    }

    // Verify tenant + requisition exist and are open
    const [tenant] = await db.select({ id: tenants.id }).from(tenants)
      .where(and(eq(tenants.id, tenantId), eq(tenants.isActive, true))).limit(1)

    if (!tenant) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })

    const [req2] = await db.select({ id: jobRequisitions.id, status: jobRequisitions.status })
      .from(jobRequisitions)
      .where(and(eq(jobRequisitions.id, requisitionId), eq(jobRequisitions.tenantId, tenantId)))
      .limit(1)

    if (!req2) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    if (req2.status !== 'open') return NextResponse.json({ error: 'This position is no longer accepting applications' }, { status: 409 })

    // Upload resume if provided
    let resumeUrl: string | null = null
    if (resumeFile && resumeFile.size > 0) {
      const resumeErr = validateFile(resumeFile, 'resume')
      if (resumeErr) return NextResponse.json({ error: resumeErr }, { status: 415 })
      const ext   = resumeFile.name.split('.').pop() ?? 'pdf'
      const bytes = await resumeFile.arrayBuffer()
      const blob  = await put(`resumes/${tenantId}/${Date.now()}_${firstName}_${lastName}.${ext}`, bytes, {
        access: 'public',
        contentType: resumeFile.type || 'application/pdf',
        addRandomSuffix: false,
      })
      resumeUrl = blob.url
    }

    // Upsert candidate by email within tenant
    const existing = await db.select({ id: candidates.id })
      .from(candidates)
      .where(and(eq(candidates.tenantId, tenantId), eq(candidates.email, email.toLowerCase().trim())))
      .limit(1)

    let candidateId: string
    if (existing.length > 0) {
      candidateId = existing[0].id
    } else {
      const [cand] = await db.insert(candidates).values({
        tenantId,
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email:     email.toLowerCase().trim(),
        phone:     phone || null,
        resumeUrl: resumeUrl ?? null,
        source:    'career_site',
      }).returning({ id: candidates.id })
      candidateId = cand.id
    }

    // Create application (allow re-apply check)
    const [app] = await db.insert(applications).values({
      tenantId,
      requisitionId,
      candidateId,
      status: 'received',
      notes:  coverLetter || null,
    }).returning({ id: applications.id })

    return NextResponse.json({ ok: true, applicationId: app.id }, { status: 201 })
  } catch (err: any) {
    // Duplicate application (unique constraint)
    if (err?.message?.includes('unique') || err?.code === '23505') {
      return NextResponse.json({ error: 'You have already applied for this position.' }, { status: 409 })
    }
    console.error('POST /api/careers/apply', err)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }
}
