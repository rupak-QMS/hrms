/**
 * GET  /api/tenant/expenses  — list expense claims (filtered by status, employeeId, category)
 * POST /api/tenant/expenses  — submit a new expense claim
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { expenseClaims, employees } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { put } from '@vercel/blob'
import { validateFile } from '@/lib/validateUpload'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await apiGuard('expenses:read')
  if (guard.error) return guard.error

  const { tenantId, userRole } = guard.session

  const { searchParams } = new URL(req.url)
  const status     = searchParams.get('status')
  const employeeId = searchParams.get('employeeId')
  const category   = searchParams.get('category')

  const isAdmin = ['director', 'hr_manager', 'hr_officer', 'operations_manager', 'team_leader', 'payroll_officer'].includes(userRole)

  const conditions: any[] = [eq(expenseClaims.tenantId, tenantId)]

  if (!isAdmin) {
    // Find employee record for this user
    const [emp] = await db.select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.tenantId, tenantId), eq(employees.userId, guard.session.sub ?? '')))
      .limit(1)
    if (emp) conditions.push(eq(expenseClaims.employeeId, emp.id))
    else return NextResponse.json({ claims: [], total: 0 })
  } else {
    if (employeeId) conditions.push(eq(expenseClaims.employeeId, employeeId))
  }

  if (status)   conditions.push(eq(expenseClaims.status, status))
  if (category) conditions.push(eq(expenseClaims.category, category))

  const rows = await db
    .select({
      id:          expenseClaims.id,
      title:       expenseClaims.title,
      category:    expenseClaims.category,
      amount:      expenseClaims.amount,
      currency:    expenseClaims.currency,
      expenseDate: expenseClaims.expenseDate,
      description: expenseClaims.description,
      receiptUrl:  expenseClaims.receiptUrl,
      status:      expenseClaims.status,
      submittedAt: expenseClaims.submittedAt,
      reviewedBy:  expenseClaims.reviewedBy,
      reviewedAt:  expenseClaims.reviewedAt,
      reviewNotes: expenseClaims.reviewNotes,
      paidAt:      expenseClaims.paidAt,
      createdAt:   expenseClaims.createdAt,
      employeeId:        expenseClaims.employeeId,
      employeeFirstName: employees.firstName,
      employeeLastName:  employees.lastName,
      employeeEmail:     employees.email,
    })
    .from(expenseClaims)
    .leftJoin(employees, eq(expenseClaims.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(expenseClaims.createdAt))

  return NextResponse.json({ claims: rows, total: rows.length })
}

export async function POST(req: NextRequest) {
  const guard = await apiGuard('expenses:write')
  if (guard.error) return guard.error

  const { tenantId } = guard.session
  const userId = guard.session.sub ?? ''

  // Find employee
  const [emp] = await db.select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.tenantId, tenantId), eq(employees.userId, userId)))
    .limit(1)

  if (!emp) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 })

  let title: string, category: string, amount: string, expenseDate: string
  let description = '', receiptFile: File | null = null

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const fd    = await req.formData()
    title       = String(fd.get('title') ?? '')
    category    = String(fd.get('category') ?? '')
    amount      = String(fd.get('amount') ?? '')
    expenseDate = String(fd.get('expenseDate') ?? '')
    description = String(fd.get('description') ?? '')
    receiptFile = fd.get('receipt') as File | null
  } else {
    const body  = await req.json()
    title       = body.title
    category    = body.category
    amount      = body.amount
    expenseDate = body.expenseDate
    description = body.description ?? ''
  }

  if (!title || !category || !amount || !expenseDate) {
    return NextResponse.json({ error: 'title, category, amount and expenseDate are required' }, { status: 400 })
  }

  let receiptUrl: string | null = null
  if (receiptFile && receiptFile.size > 0) {
    const receiptErr = validateFile(receiptFile, 'receipt')
    if (receiptErr) return NextResponse.json({ error: receiptErr }, { status: 415 })
    const ext   = receiptFile.name.split('.').pop() ?? 'pdf'
    const bytes = await receiptFile.arrayBuffer()
    const blob  = await put(
      `receipts/${tenantId}/${Date.now()}_${emp.id}.${ext}`,
      bytes,
      { access: 'public', contentType: receiptFile.type || 'application/pdf', addRandomSuffix: false }
    )
    receiptUrl = blob.url
  }

  const [claim] = await db.insert(expenseClaims).values({
    tenantId,
    employeeId:  emp.id,
    title:       title.trim(),
    category,
    amount,
    expenseDate,
    description: description || null,
    receiptUrl,
    status:      'pending',
  }).returning({ id: expenseClaims.id })

  return NextResponse.json({ ok: true, claimId: claim.id }, { status: 201 })
}
