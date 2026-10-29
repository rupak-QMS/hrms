import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { courses, trainingRecords, employees } from '@/lib/db/schema'
import { eq, and, asc, desc, ilike } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// GET /api/tenant/training
// Returns courses list. Pass ?records=true to include training records with employee details.
export async function GET(req: NextRequest) {
  try {
    const guard = await apiGuard('training:read')
    if (guard.error) return guard.error
    const { session } = guard

    const { searchParams } = req.nextUrl
    const includeRecords = searchParams.get('records') === 'true'
    const employeeId     = searchParams.get('employeeId')
    const category       = searchParams.get('category')
    const mandatory      = searchParams.get('mandatory')
    const search         = searchParams.get('search')
    const limit          = Math.min(Number(searchParams.get('limit') ?? 50), 200)
    const offset         = Number(searchParams.get('offset') ?? 0)

    // ── Courses ──────────────────────────────────────────────────────────
    const courseConditions = [eq(courses.tenantId, session.tenantId)]
    if (category)  courseConditions.push(eq(courses.category, category))
    if (mandatory !== null && mandatory !== undefined)
      courseConditions.push(eq(courses.isMandatory, mandatory !== 'false'))
    if (search)    courseConditions.push(ilike(courses.title, `%${search}%`))

    const courseList = await db
      .select({
        id:             courses.id,
        title:          courses.title,
        description:    courses.description,
        category:       courses.category,
        isMandatory:    courses.isMandatory,
        validityMonths: courses.validityMonths,
        isActive:       courses.isActive,
        createdAt:      courses.createdAt,
      })
      .from(courses)
      .where(and(...courseConditions))
      .orderBy(asc(courses.title))
      .limit(limit)
      .offset(offset)

    if (!includeRecords) {
      return NextResponse.json({
        courses: courseList,
        pagination: { limit, offset, count: courseList.length },
      })
    }

    // ── Training Records (with employee details) ─────────────────────────
    const recordConditions = [eq(trainingRecords.tenantId, session.tenantId)]
    if (employeeId) recordConditions.push(eq(trainingRecords.employeeId, employeeId))

    const records = await db
      .select({
        id:             trainingRecords.id,
        employeeId:     trainingRecords.employeeId,
        courseId:       trainingRecords.courseId,
        status:         trainingRecords.status,
        completedAt:    trainingRecords.completedAt,
        expiryDate:     trainingRecords.expiryDate,
        certificateUrl: trainingRecords.certificateUrl,
        score:          trainingRecords.score,
        attempts:       trainingRecords.attempts,
        createdAt:      trainingRecords.createdAt,
        // employee
        firstName:      employees.firstName,
        lastName:       employees.lastName,
        employeeNumber: employees.employeeNumber,
        // course
        courseTitle:    courses.title,
        courseCategory: courses.category,
        isMandatory:    courses.isMandatory,
      })
      .from(trainingRecords)
      .leftJoin(employees, and(
        eq(employees.id, trainingRecords.employeeId),
        eq(employees.tenantId, trainingRecords.tenantId)
      ))
      .leftJoin(courses, eq(courses.id, trainingRecords.courseId))
      .where(and(...recordConditions))
      .orderBy(desc(trainingRecords.createdAt))
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      courses: courseList,
      records,
      pagination: { limit, offset, count: records.length },
    })
  } catch (err) {
    console.error('[training GET]', err)
    return NextResponse.json({ error: 'Failed to fetch training data' }, { status: 500 })
  }
}

// POST /api/tenant/training — create a course
const CreateCourseSchema = z.object({
  title:          z.string().min(1).max(300),
  description:    z.string().optional(),
  category:       z.string().max(100).optional(),
  isMandatory:    z.boolean().default(false),
  validityMonths: z.number().int().positive().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('training:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const parsed = CreateCourseSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const data = parsed.data

    const [row] = await db
      .insert(courses)
      .values({
        tenantId:       session.tenantId,
        title:          data.title,
        description:    data.description ?? null,
        category:       data.category ?? null,
        isMandatory:    data.isMandatory,
        validityMonths: data.validityMonths ?? null,
      })
      .returning({ id: courses.id, title: courses.title, createdAt: courses.createdAt })

    return NextResponse.json({ course: row }, { status: 201 })
  } catch (err) {
    console.error('[training POST]', err)
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 })
  }
}
