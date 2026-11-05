import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/auth/tenant-branding?slug=yahweh-care
// Public endpoint — returns only safe branding fields (no PII, no secrets)
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug || slug === 'admin') {
    return NextResponse.json({
      name: 'Platform Administration',
      logoUrl: null,
      primaryColor: '#0E3D52',
      settings: {},
    })
  }

  try {
    const [tenant] = await db
      .select({
        name:         tenants.name,
        logoUrl:      tenants.logoUrl,
        primaryColor: tenants.primaryColor,
        settings:     tenants.settings,
        isActive:     tenants.isActive,
      })
      .from(tenants)
      .where(eq(tenants.slug, slug))

    if (!tenant) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      name:         tenant.name,
      logoUrl:      tenant.logoUrl ?? null,
      primaryColor: tenant.primaryColor ?? '#0E3D52',
      settings:     tenant.settings ?? {},
      isActive:     tenant.isActive,
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
