import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { documents, employees } from '@/lib/db/schema'
import { eq, and, asc, desc, ilike } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
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

    const conditions = [eq(documents.tenantId, session.tenantId)]
    if (employeeId) conditions.push(eq(documents.employeeId, employeeId))
    if (category)   conditions.push(eq(documents.category, category))
    if (status)     conditions.push(eq(documents.status, status as any))
    if (search)     conditions.push(ilike(documents.title, `%${search}%`))

    const rows = await db
      .select({
        id:            documents.id,
        employeeId:    documents.employeeId,
        category:      documents.category,
        title:         documents.title,
        blobUrl:       documents.blobUrl,
        fileName:      documents.fileName,
        fileSizeBytes: documents.fileSizeBytes,
        mimeType:      documents.mimeType,
        status:        documents.status,
        expiryDate:    documents.expiryDate,
        notes:         documents.notes,
        version:       documents.version,
        createdAt:     documents.createdAt,
        updatedAt:     documents.updatedAt,
        // employee name for display
        firstName:     employees.firstName,
        lastName:      employees.lastName,
        employeeNumber: employees.employeeNumber,
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

    return NextResponse.json({
      documents: rows,
      pagination: { limit, offset, count: rows.length },
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
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const [row] = await db
      .insert(documents)
      .values({
        tenantId:      session.tenantId,
        uploadedBy:    session.userId,
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
      .returning({ id: documents.id, createdAt: documents.createdAt })

    return NextResponse.json({ document: row }, { status: 201 })
  } catch (err) {
    console.error('[documents POST]', err)
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 })
  }
}
