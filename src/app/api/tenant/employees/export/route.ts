/**
 * GET /api/tenant/employees/export?status=&type=&search=&format=csv
 *
 * Exports the employee directory as a CSV file.
 * Requires employees:read permission (same as the list endpoint).
 * Employees and contractors are blocked (same rule as list endpoint).
 *
 * Response: text/csv with Content-Disposition: attachment
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { employees, departments, positions } from '@/lib/db/schema'
import { eq, and, ilike, or } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function rowToCsv(cols: string[]): string {
  return cols.map(escapeCsv).join(',')
}

export async function GET(req: NextRequest) {
  const guard = await apiGuard('employees:read')
  if (guard.error) return guard.error
  const { session } = guard

  if (session.userRole === 'employee' || session.userRole === 'contractor') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status')
  const type   = searchParams.get('type')

  const conditions = [eq(employees.tenantId, session.tenantId!)]
  if (status === 'active')   conditions.push(eq(employees.isActive, true))
  if (status === 'inactive') conditions.push(eq(employees.isActive, false))
  if (type) conditions.push(eq(employees.employmentType, type as any))
  if (search) {
    conditions.push(
      or(
        ilike(employees.firstName, `%${search}%`),
        ilike(employees.lastName,  `%${search}%`),
        ilike(employees.email,     `%${search}%`),
        ilike(employees.employeeNumber, `%${search}%`),
      )!
    )
  }

  const rows = await db
    .select({
      employeeNumber:   employees.employeeNumber,
      firstName:        employees.firstName,
      lastName:         employees.lastName,
      preferredName:    employees.preferredName,
      email:            employees.email,
      phone:            employees.phone,
      employmentType:   employees.employmentType,
      departmentName:   departments.name,
      positionTitle:    positions.title,
      startDate:        employees.startDate,
      isActive:         employees.isActive,
      complianceStatus: employees.complianceStatus,
      ndisWorker:       employees.ndisWorker,
      entityName:       employees.entityName,
      annualSalary:     employees.annualSalary,
      ordinaryHours:    employees.ordinaryHoursPerWeek,
    })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .leftJoin(positions,   eq(positions.id,   employees.positionId))
    .where(and(...conditions))
    .orderBy(employees.lastName, employees.firstName)

  const header = rowToCsv([
    'Employee Number', 'First Name', 'Last Name', 'Preferred Name',
    'Email', 'Phone', 'Employment Type', 'Department', 'Position',
    'Start Date', 'Active', 'Compliance Status', 'NDIS Worker',
    'Entity Name', 'Annual Salary', 'Ordinary Hours/Week',
  ])

  const lines = rows.map(r => rowToCsv([
    r.employeeNumber ?? '',
    r.firstName ?? '',
    r.lastName ?? '',
    r.preferredName ?? '',
    r.email ?? '',
    r.phone ?? '',
    r.employmentType ?? '',
    r.departmentName ?? '',
    r.positionTitle ?? '',
    r.startDate ? String(r.startDate) : '',
    r.isActive ? 'Yes' : 'No',
    r.complianceStatus ?? '',
    r.ndisWorker ? 'Yes' : 'No',
    r.entityName ?? '',
    r.annualSalary !== null ? String(r.annualSalary) : '',
    r.ordinaryHours !== null ? String(r.ordinaryHours) : '',
  ]))

  const csv = [header, ...lines].join('\r\n')
  const filename = `employees-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
