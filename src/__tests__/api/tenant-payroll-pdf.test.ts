/**
 * API route tests — POST /api/tenant/payroll/[id]/pdf
 * src/app/api/tenant/payroll/[id]/pdf/route.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Next.js stubs ─────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      _tag: 'NextResponse', body, status: init?.status ?? 200,
    }),
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined) })),
}))

// ── Auth stub ─────────────────────────────────────────────────────────────────

const mockApiGuard = vi.fn()
vi.mock('@/lib/auth/apiGuard', () => ({
  apiGuard: (...a: unknown[]) => mockApiGuard(...a),
}))

// ── Vercel Blob stub ──────────────────────────────────────────────────────────

const mockPut = vi.fn()
vi.mock('@vercel/blob', () => ({
  put: (...a: unknown[]) => mockPut(...a),
}))

// ── Email / notification stubs ────────────────────────────────────────────────

vi.mock('@/lib/email/emailHelper', () => ({
  getTenantEmailCtx: vi.fn().mockResolvedValue({ notify: { emailPayroll: false } }),
  fireEmail:         vi.fn(),
}))

vi.mock('@/lib/email/templates', () => ({
  payslipReadyEmail: vi.fn().mockReturnValue({ subject: '', html: '' }),
}))

// ── DB stubs ──────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn()

function makeSelectChain(): any {
  const chain: any = {}
  ;['from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset'].forEach(m => {
    chain[m] = () => chain
  })
  chain.then = (res: any, rej: any) => mockDbSelect().then(res, rej)
  return chain
}

function makeUpdateChain(): any {
  return { set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) }
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => makeSelectChain()),
    update: vi.fn(() => makeUpdateChain()),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  payrollRecords: {},
  employees:      {},
  tenants:        {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { POST } from '@/app/api/tenant/payroll/[id]/pdf/route'
import { db } from '@/lib/db'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReq(body: unknown = {}): any {
  return { json: async () => body }
}

function makeCtx(id: string): any {
  return { params: Promise.resolve({ id }) }
}

const BASE_SESSION = {
  sub: 'u-1', email: 'pay@acme.com',
  role: 'tenant_user' as const, tenantId: 't-1', userRole: 'payroll_officer',
}

const GUARD_OK  = { error: null, session: BASE_SESSION }
const GUARD_401 = {
  error: { _tag: 'NextResponse', body: { error: 'Unauthenticated' }, status: 401 },
  session: null,
}

const DB_ROW = {
  id: 'pr-1', employeeId: 'e-1',
  periodStart: '2024-02-01', periodEnd: '2024-02-14',
  grossPay: '3000.00', paygWithholding: '600.00',
  medicareLevy: '60.00', superContribution: '330.00', netPay: '2010.00',
  hoursWorked: null, hourlyRate: null,
  payslipData: { frequency: 'fortnightly', allowances: 0, deductions: 0 },
  status: 'pending',
  empFirst: 'Alice', empLast: 'Smith', empEmail: 'alice@acme.com',
  empEntityName: null,
  orgName: 'Acme Pty Ltd', orgLogo: null, orgColor: '#0E3D52', orgAbn: null,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(db.select).mockImplementation(() => makeSelectChain())
  vi.mocked(db.update).mockImplementation(() => makeUpdateChain() as any)
  mockDbSelect.mockResolvedValue([])
  mockPut.mockResolvedValue({ url: 'https://blob.vercel.com/payslips/t-1/pr-1.html' })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/tenant/payroll/[id]/pdf', () => {
  it('returns 401 when unauthenticated', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401)
    const res = await POST(makeReq(), makeCtx('pr-1')) as any
    expect(res.status).toBe(401)
  })

  it('returns 404 when payroll record not found', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK)
    mockDbSelect.mockResolvedValueOnce([])   // no row
    const res = await POST(makeReq(), makeCtx('pr-x')) as any
    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 200 with payslip URL when record exists', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK)
    mockDbSelect.mockResolvedValueOnce([DB_ROW])
    const res = await POST(makeReq(), makeCtx('pr-1')) as any
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.payslipUrl).toMatch(/blob\.vercel\.com/)
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringContaining('pr-1'),
      expect.stringContaining('<!DOCTYPE html>'),
      expect.objectContaining({ contentType: 'text/html' }),
    )
  })
})
