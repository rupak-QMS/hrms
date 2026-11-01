/**
 * API route tests — GET & POST /api/tenant/employees
 * src/app/api/tenant/employees/route.ts
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

// ── Auth / guard stubs ────────────────────────────────────────────────────────

const mockApiGuard = vi.fn()
vi.mock('@/lib/auth/apiGuard', () => ({
  apiGuard: (...a: unknown[]) => mockApiGuard(...a),
}))

// ── bcrypt stub ───────────────────────────────────────────────────────────────

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$hashed') },
}))

// ── DB stubs ──────────────────────────────────────────────────────────────────
//
// select()  → fluent chain that when awaited calls mockDbSelect (queued)
// insert()  → .values().returning() calls mockDbInsert

const mockDbSelect = vi.fn()
const mockDbInsert = vi.fn()

function makeSelectChain(): any {
  const chain: any = {}
  ;['from', 'leftJoin', 'where', 'orderBy', 'limit', 'offset'].forEach(m => {
    chain[m] = () => chain
  })
  chain.then = (res: any, rej: any) => mockDbSelect().then(res, rej)
  return chain
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: mockDbInsert })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  employees:   {},
  departments: {},
  positions:   {},
  users:       {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(), or: vi.fn(), ilike: vi.fn(),
  desc: vi.fn(), asc: vi.fn(), count: vi.fn(), sql: vi.fn(),
  isNull: vi.fn(() => 'isNull'),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { GET, POST } from '@/app/api/tenant/employees/route'
import { db } from '@/lib/db'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReq(opts: {
  searchParams?: Record<string, string>
  body?: unknown
} = {}): any {
  const url = new URL('http://localhost/api/tenant/employees')
  Object.entries(opts.searchParams ?? {}).forEach(([k, v]) => url.searchParams.set(k, v))
  return { nextUrl: url, json: async () => opts.body ?? {} }
}

const BASE_SESSION = {
  sub: 'u-1', email: 'dir@acme.com',
  role: 'tenant_user' as const, tenantId: 't-1',
}

const GUARD_OK_DIRECTOR  = { error: null, session: { ...BASE_SESSION, userRole: 'director'  } }
const GUARD_OK_EMPLOYEE  = { error: null, session: { ...BASE_SESSION, userRole: 'employee'  } }
const GUARD_OK_CONTRACTOR = { error: null, session: { ...BASE_SESSION, userRole: 'contractor' } }
const GUARD_401 = {
  error: { _tag: 'NextResponse', body: { error: 'Unauthenticated' }, status: 401 },
  session: null,
}
const GUARD_403 = {
  error: { _tag: 'NextResponse', body: { error: 'Forbidden', role: 'it_admin' }, status: 403 },
  session: null,
}

const EMP_ROWS = [
  { id: 'e-1', firstName: 'Alice', lastName: 'Smith', email: 'alice@acme.com', isActive: true },
]

beforeEach(() => {
  vi.resetAllMocks()
  // Restore db method implementations (resetAllMocks clears vi.fn() impls)
  vi.mocked(db.select).mockImplementation(() => makeSelectChain())
  vi.mocked(db.insert).mockImplementation(() => ({
    values: vi.fn(() => ({ returning: mockDbInsert })),
  }) as any)
  mockDbSelect.mockResolvedValue([])
  mockDbInsert.mockResolvedValue([])
})

// ── GET ───────────────────────────────────────────────────────────────────────

describe('GET /api/tenant/employees', () => {
  it('returns 401 when unauthenticated', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401)
    const res = await GET(makeReq()) as any
    expect(res.status).toBe(401)
  })

  it('returns 403 when apiGuard denies (missing permission)', async () => {
    mockApiGuard.mockResolvedValue(GUARD_403)
    const res = await GET(makeReq()) as any
    expect(res.status).toBe(403)
  })

  it('returns 403 for employee role — org directory is restricted', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK_EMPLOYEE)
    const res = await GET(makeReq()) as any
    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/restricted/i)
  })

  it('returns 403 for contractor role — org directory is restricted', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK_CONTRACTOR)
    const res = await GET(makeReq()) as any
    expect(res.status).toBe(403)
  })

  it('returns 200 with employee list and pagination metadata', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK_DIRECTOR)
    mockDbSelect
      .mockResolvedValueOnce(EMP_ROWS)           // list query
      .mockResolvedValueOnce([{ value: '1' }])   // count query
      .mockResolvedValueOnce([{ activeCount: 1, inactiveCount: 0, ndisCount: 0 }]) // stats
    const res = await GET(makeReq()) as any
    expect(res.status).toBe(200)
    expect(res.body.employees).toEqual(EMP_ROWS)
    expect(res.body.total).toBe(1)
    expect(res.body.page).toBe(1)
    expect(typeof res.body.pages).toBe('number')
  })

  it('returns 200 with default limit=20 and page=1', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK_DIRECTOR)
    mockDbSelect
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ value: '0' }])
      .mockResolvedValueOnce([{ activeCount: 0, inactiveCount: 0, ndisCount: 0 }])
    const res = await GET(makeReq()) as any
    expect(res.body.limit).toBe(20)
    expect(res.body.page).toBe(1)
  })
})

// ── POST ──────────────────────────────────────────────────────────────────────

describe('POST /api/tenant/employees', () => {
  it('returns 401 when unauthenticated', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401)
    const res = await POST(makeReq()) as any
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK_DIRECTOR)
    const res = await POST(makeReq({ body: { firstName: 'Alice' } })) as any
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 201 with newly created employee and login account', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK_DIRECTOR)
    const created = { id: 'e-2', firstName: 'Bob', lastName: 'Jones', email: 'bob@acme.com' }
    // user lookup → no existing user; user insert → new user; employee insert → employee
    mockDbSelect
      .mockResolvedValueOnce([])          // existing user lookup returns empty
    mockDbInsert
      .mockResolvedValueOnce([{ id: 'u-99' }])  // user insert
      .mockResolvedValueOnce([created])           // employee insert
    const res = await POST(makeReq({
      body: {
        firstName: 'Bob', lastName: 'Jones', email: 'bob@acme.com',
        employmentType: 'full_time', startDate: '2024-01-15',
      },
    })) as any
    expect(res.status).toBe(201)
    expect(res.body.employee).toEqual(created)
    expect(res.body.loginCreated).toBe(true)
    expect(res.body.defaultPassword).toBeDefined()
  })

  it('returns 201 and links existing user account when email already has a login', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK_DIRECTOR)
    const created = { id: 'e-3', firstName: 'Carol', lastName: 'White', email: 'carol@acme.com' }
    mockDbSelect.mockResolvedValueOnce([{ id: 'u-existing' }])
    mockDbInsert.mockResolvedValueOnce([created])
    const res = await POST(makeReq({
      body: {
        firstName: 'Carol', lastName: 'White', email: 'carol@acme.com',
        employmentType: 'full_time', startDate: '2024-01-15',
      },
    })) as any
    expect(res.status).toBe(201)
    expect(res.body.loginCreated).toBe(false)
    expect(res.body.defaultPassword).toBeUndefined()
  })

  it('returns 409 on duplicate employee (unique constraint violation)', async () => {
    mockApiGuard.mockResolvedValue(GUARD_OK_DIRECTOR)
    const dupErr = Object.assign(new Error('unique constraint'), { code: '23505' })
    mockDbInsert.mockRejectedValue(dupErr)
    const res = await POST(makeReq({
      body: {
        firstName: 'Alice', lastName: 'Smith', email: 'alice@acme.com',
        employmentType: 'full_time', startDate: '2024-01-15',
      },
    })) as any
    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/exists/i)
  })
})
