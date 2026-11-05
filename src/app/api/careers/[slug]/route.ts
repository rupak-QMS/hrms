/**
 * GET /api/careers/[slug]
 * Public endpoint — no auth required.
 * Returns tenant branding + open job requisitions for the career site.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tenants, jobRequisitions } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { slug } = await params

  try {
    const [tenant] = await db
      .select({
        id:           tenants.id,
        name:         tenants.name,
        slug:         tenants.slug,
        logoUrl:      tenants.logoUrl,
        primaryColor: tenants.primaryColor,
        settings:     tenants.settings,
        isActive:     tenants.isActive,
      })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1)

    if (!tenant || !tenant.isActive) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    const jobs = await db
      .select({
        id:          jobRequisitions.id,
        title:       jobRequisitions.title,
        description: jobRequisitions.description,
        status:      jobRequisitions.status,
        createdAt:   jobRequisitions.createdAt,
      })
      .from(jobRequisitions)
      .where(and(
        eq(jobRequisitions.tenantId, tenant.id),
        eq(jobRequisitions.status, 'open'),
      ))
      .orderBy(jobRequisitions.createdAt)

    const settings = (tenant.settings ?? {}) as Record<string, unknown>

    return NextResponse.json({
      org: {
        id:          tenant.id,
        name:        tenant.name,
        slug:        tenant.slug,
        logoUrl:     tenant.logoUrl,
        primaryColor: tenant.primaryColor ?? '#0E3D52',
        industry:    settings.industry as string | null ?? null,
        website:     settings.website  as string | null ?? null,
        city:        settings.city     as string | null ?? null,
        state:       settings.state    as string | null ?? null,
        country:     settings.country  as string | null ?? 'Australia',
        careerTagline: settings.careerTagline as string | null ?? null,
        careerBanner:  settings.careerBanner  as string | null ?? null,
      },
      jobs,
      total: jobs.length,
    })
  } catch (err) {
    console.error('GET /api/careers/[slug]', err)
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 })
  }
}
