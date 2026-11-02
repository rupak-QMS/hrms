import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { promotionRequests, promotionEvents, employees } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

// GET /api/tenant/promotions?status=&employeeId=
export async function GET(req: NextRequest) {
  try {
    const guard = await apiGuard('performance:read')
    if (guard.error) return guard.error
    const { session } = guard

    const { searchParams } = req.nextUrl
    const status     = searchParams.get('status') ?? ''
    const employeeId = searchParams.get('employeeId') ?? ''

    const conditions = [eq(promotionRequests.tenantId, session.tenantId)]
    if (status)     conditions.push(eq(promotionRequests.status, status as any))
    if (employeeId) conditions.push(eq(promotionRequests.employeeId, employeeId))

    const rows = await db
      .select({
        id:              promotionRequests.id,
        employeeId:      promotionRequests.employeeId,
        raisedById:      promotionRequests.raisedById,
        raisedByName:    promotionRequests.raisedByName,
        currentTitle:    promotionRequests.currentTitle,
        currentSalary:   promotionRequests.currentSalary,
        proposedTitle:   promotionRequests.proposedTitle,
        proposedSalary:  promotionRequests.proposedSalary,
        effectiveDate:   promotionRequests.effectiveDate,
        justification:   promotionRequests.justification,
        status:          promotionRequests.status,
        reviewedBy:      promotionRequests.reviewedBy,
        reviewedAt:      promotionRequests.reviewedAt,
        reviewNotes:     promotionRequests.reviewNotes,
        implementedAt:   promotionRequests.implementedAt,
        createdAt:       promotionRequests.createdAt,
        updatedAt:       promotionRequests.updatedAt,
        // Employee join
        employeeFirstName: employees.firstName,
        employeeLastName:  employees.lastName,
        employeeEmail:     employees.email,
        employeeEntityName: employees.entityName,
      })
      .from(promotionRequests)
      .leftJoin(employees, eq(employees.id, promotionRequests.employeeId))
      .where(and(...conditions))
      .orderBy(desc(promotionRequests.createdAt))

    const stats = {
      total:        rows.length,
      pending:      rows.filter(r => r.status === 'pending').length,
      under_review: rows.filter(r => r.status === 'under_review').length,
      approved:     rows.filter(r => r.status === 'approved').length,
      rejected:     rows.filter(r => r.status === 'rejected').length,
      implemented:  rows.filter(r => r.status === 'implemented').length,
    }

    return NextResponse.json({ promotions: rows, stats })
  } catch (err: any) {
    console.error('[promotions GET]', err)
    return NextResponse.json({ error: 'Failed to fetch promotions', detail: err?.message ?? String(err) }, { status: 500 })
  }
}

// POST /api/tenant/promotions  — raise a new promotion case
export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('performance:write')
    if (guard.error) return guard.error
    const { session } = guard

    const body = await req.json()
    const {
      employeeId, proposedTitle, proposedSalary, effectiveDate,
      justification, currentTitle, currentSalary, raisedByName,
    } = body

    if (!employeeId || !proposedTitle || !justification) {
      return NextResponse.json({ error: 'employeeId, proposedTitle and justification are required' }, { status: 400 })
    }

    // Verify employee belongs to this tenant
    const [emp] = await db
      .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.tenantId, session.tenantId)))

    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const [promotion] = await db.insert(promotionRequests).values({
      tenantId:       session.tenantId,
      employeeId,
      raisedById:     session.sub ?? session.email ?? null,
      raisedByName:   raisedByName || session.email,
      currentTitle:   currentTitle || null,
      currentSalary:  currentSalary ? Number(currentSalary) : null,
      proposedTitle:  proposedTitle.trim(),
      proposedSalary: proposedSalary ? Number(proposedSalary) : null,
      effectiveDate:  effectiveDate || null,
      justification:  justification.trim(),
      status:         'pending',
    }).returning()

    // Log event
    await db.insert(promotionEvents).values({
      tenantId:    session.tenantId,
      promotionId: promotion.id,
      event:       'raised',
      note:        `Promotion case raised for ${emp.firstName} ${emp.lastName} → ${proposedTitle}`,
      performedBy: session.email,
    })

    return NextResponse.json({ promotion }, { status: 201 })
  } catch (err: any) {
    console.error('[promotions POST]', err)
    return NextResponse.json({ error: 'Failed to create promotion', detail: err?.message ?? String(err) }, { status: 500 })
  }
}
