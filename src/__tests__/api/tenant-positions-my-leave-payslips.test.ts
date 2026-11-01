/**
 * API route tests — positions, my-leave, my-payslips
 * src/app/api/tenant/positions/route.ts    (GET, POST)
 * src/app/api/tenant/my-leave/route.ts     (GET)
 * src/app/api/tenant/my-payslips/route.ts  (GET)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Stubs ──────────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextRequest: class {
    _body: unknown
    nextUrl: URL
    constructor(url = 'https://app.test/') { this.nextUrl = new URL(url) }
    async json() { return this._body ?? {} }
  },
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 }),
  },
}))

// positions uses getSession directly
vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))

// my-leave and my-payslips use apiAuth
vi.mock('@/lib/auth/apiGuard', () => ({
  apiAuth:  vi.fn(),
  apiGuard: vi.fn(),
}))

function makeSelectChain(data: unknown) {
  const c: Record<string, unknown> = {}
  ;['from', 'where', 'leftJoin', 'orderBy', 'limit'].forEach(m => { c[m] = () => c })
  c.then = (resolve: (v: unknown) => void) => Promise.resolve(data).then(resolve)
  return c
}

function makeInsertChain(data: unknown = []) {
  const c: Record<string, unknown> = {}
  ;['values', 'returning'].forEach(m => { c[m] = () => c })
  c.then = (resolve: (v: unknown) => void) => Promise.resolve(data).then(resolve)
  return c
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => makeSelectChain([])),
    insert: vi.fn(() => makeInsertChain([])),
  },
}))

vi.mock('drizzle-orm', () => ({
  eq:    vi.fn(() => 'eq'),
  and:   vi.fn(() => 'and'),
  asc:   vi.fn(() => 'asc'),
  desc:  vi.fn(() => 'desc'),
  sql:   vi.fn(() => ({ as: vi.fn(() => 'sql_aliased'), queryChunks: [] })),
  ilike: vi.fn(() => 'ilike'),
  gte:   vi.fn(() => 'gte'),
  lte:   vi.fn(() => 'lte'),
}))

import { GET as posGET, POST as posPOST } from '@/app/api/tenant/positions/route'
import { GET as myLeaveGET }               from '@/app/api/tenant/my-leave/route'
import { GET as myPayslipsGET }            from '@/app/api/tenant/my-payslips/route'
import { getSession }                      from '@/lib/auth/session'
import { apiGuard, apiAuth }               from '@/lib/auth/apiGuard'
import { db }                              from '@/lib/db'
import { NextRequest }                     from 'next/server'

const mockGetSession = vi.mocked(getSession)
const mockApiGuard   = vi.mocked(apiGuard)
const mockApiAuth    = vi.mocked(apiAuth)
const mockDb         = vi.mocked(db)

const SESSION = {
  sub: 'user-001', email: 'emp@test.com',
  role: 'tenant_user' as const,
  tenantId: 'tid-001', userRole: 'employee',
}
const GUARD_OK  = { error: null, session: SESSION }
const GUARD_401 = { error: { body: { error: 'Unauthenticated' }, status: 401 }, session: null }

function makeReq(body?: unknown) {
  const r = new NextRequest() as any
  if (body !== undefined) r._body = body
  return r
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue(SESSION as any)
  mockApiGuard.mockResolvedValue(GUARD_OK as any)
  mockApiAuth.mockResolvedValue(GUARD_OK as any)
  mockDb.select = vi.fn(() => makeSelectChain([]) as any)
  mockDb.insert = vi.fn(() => makeInsertChain([]) as any)
})

// ── GET /api/tenant/positions ──────────────────────────────────────────────────

describe('GET /api/tenant/positions', () => {
  it('returns 401 when no session', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401 as any)
    mockApiAuth.mockResolvedValue(GUARD_401 as any)
    const res = await posGET(new NextRequest('https://app.test/') as any) as any
    expect(res.status).toBe(401)
  })

  it('returns positions array', async () => {
    const rows = [{ id: 'p1', title: 'Support Worker', departmentId: 'd1' }]
    mockDb.select = vi.fn(() => makeSelectChain(rows) as any)
    const res = await posGET(new NextRequest('https://app.test/' ) as any) as any
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.positions)).toBe(true)
    expect(res.body.positions[0].title).toBe('Support Worker')
  })

  it('returns empty array when DB throws', async () => {
    mockDb.select = vi.fn(() => { throw new Error('DB error') })
    const res = await posGET(new NextRequest('https://app.test/' ) as any) as any
    expect(res.body.error).toBeDefined()
  })
})

// ── POST /api/tenant/positions ─────────────────────────────────────────────────

describe('POST /api/tenant/positions', () => {
  it('returns 401 when no session', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401 as any)
    mockApiAuth.mockResolvedValue(GUARD_401 as any)
    const res = await posPOST(makeReq({ title: 'Manager' })) as any
    expect(res.status).toBe(401)
  })

  it('returns 400 when title is missing', async () => {
    const res = await posPOST(makeReq({})) as any
    expect(res.status).toBe(400)
  })

  it('returns 201 with the new position on success', async () => {
    const created = { id: 'p2', title: 'Coordinator', departmentId: null }
    mockDb.insert = vi.fn(() => makeInsertChain([created]) as any)
    const res = await posPOST(makeReq({ title: 'Coordinator' })) as any
    expect(res.status).toBe(201)
    expect(res.body.position.title).toBe('Coordinator')
  })
})

// ── GET /api/tenant/my-leave ───────────────────────────────────────────────────

describe('GET /api/tenant/my-leave', () => {
  it('returns 401 when unauthenticated', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401 as any)
    mockApiAuth.mockResolvedValue(GUARD_401 as any)
    const res = await myLeaveGET() as any
    expect(res.status).toBe(401)
  })

  it('returns employeeLinked:false when no employee record is linked', async () => {
    mockDb.select = vi.fn(() => makeSelectChain([]) as any)
    const res = await myLeaveGET() as any
    expect(res.status).toBe(200)
    expect(res.body.employeeLinked).toBe(false)
    expect(res.body.requests).toEqual([])
    expect(res.body.stats).toBeNull()
  })

  it('returns requests, stats, and employee when linked', async () => {
    const emp = { id: 'emp-1', firstName: 'Jane', lastName: 'Smith' }
    const requests = [
      { id: 'lr-1', leaveType: 'annual', status: 'approved', totalDays: 5 },
      { id: 'lr-2', leaveType: 'sick',   status: 'pending',  totalDays: 2 },
    ]
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([emp]) as any)      // employee lookup
      .mockReturnValueOnce(makeSelectChain(requests) as any)   // leave requests
    const res = await myLeaveGET() as any
    expect(res.status).toBe(200)
    expect(res.body.employeeLinked).toBe(true)
    expect(res.body.requests).toHaveLength(2)
    expect(res.body.stats.total).toBe(2)
    expect(res.body.stats.approved).toBe(1)
    expect(res.body.stats.pending).toBe(1)
  })

  it('calculates totalDaysApproved from approved requests', async () => {
    const emp = { id: 'emp-1', firstName: 'Jane', lastName: 'Smith' }
    const requests = [
      { id: 'lr-1', status: 'approved', totalDays: 5 },
      { id: 'lr-2', status: 'approved', totalDays: 3 },
      { id: 'lr-3', status: 'pending',  totalDays: 2 },
    ]
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([emp]) as any)
      .mockReturnValueOnce(makeSelectChain(requests) as any)
    const res = await myLeaveGET() as any
    expect(res.body.stats.totalDaysApproved).toBe(8)
    expect(res.body.stats.totalDaysPending).toBe(2)
  })
})

// ── GET /api/tenant/my-payslips ────────────────────────────────────────────────

describe('GET /api/tenant/my-payslips', () => {
  it('returns 401 when unauthenticated', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401 as any)
    mockApiAuth.mockResolvedValue(GUARD_401 as any)
    const res = await myPayslipsGET() as any
    expect(res.status).toBe(401)
  })

  it('returns employeeLinked:false when no employee record is linked', async () => {
    mockDb.select = vi.fn(() => makeSelectChain([]) as any)
    const res = await myPayslipsGET() as any
    expect(res.status).toBe(200)
    expect(res.body.employeeLinked).toBe(false)
    expect(res.body.payslips).toEqual([])
  })

  it('returns payslips and employee when linked', async () => {
    const emp = { id: 'emp-1', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' }
    const payslips = [
      { id: 'pr-1', periodStart: '2025-01-01', periodEnd: '2025-01-14', grossPay: '3000.00', netPay: '2332.00', status: 'paid' },
    ]
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([emp]) as any)       // employee lookup
      .mockReturnValueOnce(makeSelectChain(payslips) as any)    // payroll records
    const res = await myPayslipsGET() as any
    expect(res.status).toBe(200)
    expect(res.body.employeeLinked).toBe(true)
    expect(res.body.payslips).toHaveLength(1)
    expect(res.body.payslips[0].grossPay).toBe('3000.00')
    expect(res.body.employee.firstName).toBe('Jane')
  })

  it('returns empty payslips array when no payroll records exist', async () => {
    const emp = { id: 'emp-1', firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' }
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([emp]) as any)
      .mockReturnValueOnce(makeSelectChain([]) as any)
    const res = await myPayslipsGET() as any
    expect(res.body.payslips).toEqual([])
    expect(res.body.employeeLinked).toBe(true)
  })
})
