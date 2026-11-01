import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents, employees } from '@/lib/db/schema'
import { eq, and, desc, ilike, isNull, sql, count } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const guard = await apiGuard('documents:read')
    if (guard.error) return guard.error
    const { session } = guard

    const { searchParams } = req.nextUrl
    const employeeId = searchParams.get('employeeId')
    const category   = searchParams.get('category')
    const status     = searchParams.get('status')
    const search     = searchParams.get('search')
    const limit      = Math.min(Number(searchParams.get('limit') ?? 50), 200)
    const offset     = Number(searchParams.get('offset') ?? 0)

    const conditions = [eq(documents.tenantId, session.tenantId), isNull(documents.deletedAt)]
    if (employeeId) conditions.push(eq(documents.employeeId, employeeId))
    if (category)   conditions.push(eq(documents.category, category))
    if (status)     conditions.push(eq(documents.status, status as any))
    if (search)     conditions.push(ilike(documents.title, `%${search}%`))

    const rows = await db
      .select({
        id:             documents.id,
        employeeId:     documents.employeeId,
        category:       documents.category,
        title:          documents.title,
        blobUrl:        documents.blobUrl,
        fileName:       documents.fileName,
        fileSizeBytes:  documents.fileSizeBytes,
        mimeType:       documents.mimeType,
        status:         documents.status,
        expiryDate:     documents.expiryDate,
        notes:          documents.notes,
        version:        documents.version,
        createdAt:      documents.createdAt,
        updatedAt:      documents.updatedAt,
        employeeFirstName: employees.firstName,
        employeeLastName:  employees.lastName,
        employeeNumber:    employees.employeeNumber,
      })
      .from(documents)
      .leftJoin(employees, and(
        eq(employees.id, documents.employeeId!),
        eq(employees.tenantId, documents.tenantId)
      ))
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset)

    // Compute stats and categories from a second lightweight query
    const allDocs = await db
      .select({ status: documents.status, expiryDate: documents.expiryDate, category: documents.category })
      .from(documents)
      .where(eq(documents.tenantId, session.tenantId))

    const now = new Date()
    const stats = { total: allDocs.length, active: 0, expired: 0, expiringSoon: 0 }
    const catSet = new Set<string>()
    for (const d of allDocs) {
      if (d.category) catSet.add(d.category)
      if (d.status === 'active') stats.active++
      if (d.status === 'expired') stats.expired++
      if (d.status === 'active' && d.expiryDate) {
        const exp = new Date(d.expiryDate)
        const days = (exp.getTime() - now.getTime()) / 86_400_000
        if (days >= 0 && days <= 30) stats.expiringSoon++
      }
    }

    // Count filtered (paginated) total
    const [{ filteredTotal }] = await db
      .select({ filteredTotal: count() })
      .from(documents)
      .where(and(...conditions))

    return NextResponse.json({
      documents: rows,
      stats,
      categories: Array.from(catSet).sort(),
      pagination: { limit, offset, count: rows.length, total: filteredTotal },
    })
  } catch (err) {
    console.error('[documents GET]', err)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }
}

const CreateDocumentSchema = z.object({
  employeeId:    z.string().uuid().optional(),
  category:      z.string().min(1).max(100),
  title:         z.string().min(1).max(300),
  blobUrl:       z.string().url(),
  fileName:      z.string().max(255).optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  mimeType:      z.string().max(100).optional(),
  expiryDate:    z.string().optional(),
  notes:         z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('documents:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const parsed = CreateDocumentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'blobUrl is required', details: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const [row] = await db
      .insert(documents)
      .values({
        tenantId:      session.tenantId,
        uploadedBy:    session.sub,
        employeeId:    data.employeeId ?? null,
        category:      data.category,
        title:         data.title,
        blobUrl:       data.blobUrl,
        fileName:      data.fileName ?? null,
        fileSizeBytes: data.fileSizeBytes ?? null,
        mimeType:      data.mimeType ?? null,
        expiryDate:    data.expiryDate ?? null,
        notes:         data.notes ?? null,
      })
      .returning({
        id:         documents.id,
        title:      documents.title,
        category:   documents.category,
        blobUrl:    documents.blobUrl,
        status:     documents.status,
        version:    documents.version,
        createdAt:  documents.createdAt,
      })

    writeAudit(req, session, {
      action:     'document.create',
      resource:   'document',
      resourceId: row.id,
      newValues:  { title: data.title, category: data.category, employeeId: data.employeeId ?? null },
    })

    return NextResponse.json({ record: row }, { status: 201 })
  } catch (err) {
    console.error('[documents POST]', err)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}

const PatchDocumentSchema = z.object({
  id:         z.string().uuid(),
  status:     z.enum(['active', 'expired', 'archived']).optional(),
  expiryDate: z.string().optional().nullable(),
  notes:      z.string().optional().nullable(),
  title:      z.string().min(1).max(300).optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const guard = await apiGuard('documents:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    if (!body?.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }
    const parsed = PatchDocumentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { id, ...fields } = parsed.data

    const [row] = await db
      .update(documents)
      .set({ ...fields, updatedAt: new Date() } as any)
      .where(and(eq(documents.id, id), eq(documents.tenantId, session.tenantId)))
      .returning({
        id:         documents.id,
        title:      documents.title,
        status:     documents.status,
        expiryDate: documents.expiryDate,
        notes:      documents.notes,
      })

    writeAudit(req, session, {
      action:     'document.update',
      resource:   'document',
      resourceId: id,
      newValues:  fields,
    })

    return NextResponse.json({ record: row })
  } catch (err) {
    console.error('[documents PATCH]', err)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const guard = await apiGuard('documents:write')
    if (guard.error) return guard.error
    const { session } = guard

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 })
    }

    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.tenantId, session.tenantId)))

    writeAudit(req, session, {
      action:     'document.delete',
      resource:   'document',
      resourceId: id,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[documents DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
  }
}
