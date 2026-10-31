/**
 * GET /api/tenant/leave/export?status=&from=&to=&leaveType=&format=csv
 *
 * Exports leave requests as CSV.
 * Requires leave:read. Employees see only their own (same scoping as list).
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { leaveRequests, employees } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'
import { hasPermission } from '@/lib/auth/permissions'

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
  const guard = await apiGuard('leave:read')
  if (guard.error) return guard.error
  const { session } = guard

  const { searchParams } = req.nextUrl
  const filterStatus = searchParams.get('status')
  const filterType   = searchParams.get('leaveType')
  const filterFrom   = searchParams.get('from')
  const filterTo     = searchParams.get('to')

  const canApprove = hasPermission(session.userRole, 'leave:approve')

  let scopedEmployeeId: string | null = null
  if (!canApprove) {
    const [emp] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.tenantId, session.tenantId), eq(employees.userId, session.sub)))
    if (!emp) {
      return new NextResponse('Employee Number,First Name,Last Name,Leave Type,Status,Start Date,End Date,Days,Notes\r\n', {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="leave-export.csv"' },
      })
    }
    scopedEmployeeId = emp.id
  }

  const conditions = [eq(leaveRequests.tenantId, session.tenantId)]
  if (scopedEmployeeId) conditions.push(eq(leaveRequests.employeeId, scopedEmployeeId))
  if (filterStatus) conditions.push(eq(leaveRequests.status, filterStatus as any))
  if (filterType)   conditions.push(eq(leaveRequests.leaveType, filterType))
  if (filterFrom)   conditions.push(gte(leaveRequests.startDate, filterFrom as any))
  if (filterTo)     conditions.push(lte(leaveRequests.endDate,   filterTo as any))

  const rows = await db
    .select({
      employeeNumber: employees.employeeNumber,
      firstName:      employees.firstName,
      lastName:       employees.lastName,
      leaveType:      leaveRequests.leaveType,
      status:         leaveRequests.status,
      startDate:      leaveRequests.startDate,
      endDate:        leaveRequests.endDate,
      totalDays:      leaveRequests.totalDays,
      notes:          leaveRequests.notes,
      createdAt:      leaveRequests.createdAt,
    })
    .from(leaveRequests)
    .leftJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .where(and(...conditions))
    .orderBy(leaveRequests.startDate)

  const header = rowToCsv([
    'Employee Number', 'First Name', 'Last Name',
    'Leave Type', 'Status', 'Start Date', 'End Date', 'Days', 'Notes', 'Submitted At',
  ])

  const lines = rows.map(r => rowToCsv([
    r.employeeNumber ?? '',
    r.firstName ?? '',
    r.lastName ?? '',
    r.leaveType ?? '',
    r.status ?? '',
    r.startDate ? String(r.startDate) : '',
    r.endDate   ? String(r.endDate)   : '',
    r.totalDays !== null ? String(r.totalDays) : '',
    r.notes ?? '',
    r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
  ]))

  const csv = [header, ...lines].join('\r\n')
  const filename = `leave-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
