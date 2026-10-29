import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/super-admin/clients/[id]/logo
// Body: { dataUrl: string } — base64 data URL (max ~500KB after base64 = ~375KB file)
export async function POST(req: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params

  try {
    const body = await req.json()
    const { dataUrl } = body

    if (!dataUrl || typeof dataUrl !== 'string') {
      return NextResponse.json({ error: 'dataUrl required' }, { status: 400 })
    }

    // Validate it's an image data URL
    if (!dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Must be an image data URL' }, { status: 400 })
    }

    // Rough size check: base64 string length * 0.75 ≈ bytes
    const approxBytes = dataUrl.length * 0.75
    if (approxBytes > 512 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 512 KB)' }, { status: 413 })
    }

    const [updated] = await db
      .update(tenants)
      .set({ logoUrl: dataUrl, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning({ id: tenants.id, logoUrl: tenants.logoUrl })

    if (!updated) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    return NextResponse.json({ logoUrl: updated.logoUrl })
  } catch (err) {
    console.error('Logo upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// DELETE — remove logo
export async function DELETE(_: NextRequest, ctx: RouteContext) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  await db.update(tenants).set({ logoUrl: null, updatedAt: new Date() }).where(eq(tenants.id, id))
  return NextResponse.json({ ok: true })
}
