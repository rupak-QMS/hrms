/**
 * API route tests — GET & POST /api/tenant/employees
 * src/app/api/tenant/employees/route.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Stubs ──────────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL
    constructor(url: string, init?: RequestInit) {
      this.nextUrl = new URL(url)
    }
    async json() { return {} }
  },
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      _tag: 'NextResponse',
      body,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))

// Chainable Drizzle mock: supports select/from/where/leftJoin/orderBy/limit/offset
function makeChain(data: unknown) {
  const c: Record<string, unknown> = {}
  ;['from', 'where', 'leftJoin', 'orderBy', 'limit', 'offset'].forEach(m => {
    c[m] = () => c
  })
  c.then = (resolve: (v: unknown) => void) => Promise.resolve(data).then(resolve)
  return c
}

const mockInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]) }

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => mockInsert),
  },
}))

// Stub drizzle-orm operators — these are passed to the mocked db chain which ignores them
vi.mock('drizzle-orm', () => ({
  eq:    vi.fn((_a, _b) => 'eq'),
  and:   vi.fn((..._args) => 'and'),
  or:    vi.fn((..._args) => 'or'),
  ilike: vi.fn((_a, _b) => 'ilike'),
  asc:   vi.fn((_a) => 'asc'),
  desc:  vi.fn((_a) => 'desc'),
  gte:   vi.fn((_a, _b) => 'gte'),
  lte:   vi.fn((_a, _b) => 'lte'),
  count: vi.fn(() => 'count'),
  sum:   vi.fn(() => 'sum'),
  sql:   Object.assign(vi.fn(() => 'sql'), { raw: vi.fn(() => 'sql') }),
  isNull: vi.fn(() => 'isNull'),
}))

import { GET, POST } from '@/app/api/tenant/employees/route'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

const mockGetSession = vi.mocked(getSession)
const mockDb = vi.mocked(db)

const YPC_SESSION = {
  sub:        'user-ypc-001',
  email:      'director@yahwehpc.com.au',
  role:       'tenant_user' as const,
  tenantId:   '00000000-0000-0000-0000-000000000002',
  userRole:   'director',
}

function makeRequest(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  // GET makes two db.select calls: rows query + count query.
  // Queue them: first returns [], second returns [{ value: 0 }].
  mockDb.select = vi.fn()
    .mockReturnValueOnce(makeChain([]) as any)
    .mockReturnValueOnce(makeChain([{ value: 0 }]) as any)
    .mockReturnValue(makeChain([{ value: 0 }]) as any)
})

// ── GET — guards ───────────────────────────────────────────────────────────────

describe('GET /api/tenant/employees — guards', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await GET(makeRequest('https://app.test/api/tenant/employees')) as any
    expect(res.status).toBe(401)
  })

  it('returns 403 when contractor (org-wide directory is blocked; use /api/tenant/my-profile)', async () => {
    mockGetSession.mockResolvedValue({ ...YPC_SESSION, userRole: 'contractor' } as any)
    const res = await GET(makeRequest('https://app.test/api/tenant/employees')) as any
    // The route explicitly blocks contractor from the org-wide employee directory.
    expect(res.status).toBe(403)
  })

  it('returns 200 for director', async () => {
    mockGetSession.mockResolvedValue(YPC_SESSION as any)
    const res = await GET(makeRequest('https://app.test/api/tenant/employees')) as any
    expect(res.status).toBe(200)
  })
})

// ── GET — response shape ───────────────────────────────────────────────────────

describe('GET /api/tenant/employees — response shape', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(YPC_SESSION as any)
    // Re-queue for each shape test (outer beforeEach runs first, inner runs after)
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeChain([]) as any)
      .mockReturnValueOnce(makeChain([{ value: 0 }]) as any)
      .mockReturnValue(makeChain([{ value: 0 }]) as any)
  })

  it('returns employees array and pagination metadata', async () => {
    const res = await GET(makeRequest('https://app.test/api/tenant/employees')) as any
    expect(res.body).toHaveProperty('employees')
    expect(Array.isArray(res.body.employees)).toBe(true)
    expect(res.body).toHaveProperty('page')
    expect(res.body).toHaveProperty('limit')
  })

  it('defaults to page=1, limit=20', async () => {
    const res = await GET(makeRequest('https://app.test/api/tenant/employees')) as any
    expect(res.body.page).toBe(1)
    expect(res.body.limit).toBe(20)
  })

  it('respects page and limit query params', async () => {
    const res = await GET(makeRequest('https://app.test/api/tenant/employees?page=3&limit=50')) as any
    expect(res.body.page).toBe(3)
    expect(res.body.limit).toBe(50)
  })

  it('caps limit at 500', async () => {
    const res = await GET(makeRequest('https://app.test/api/tenant/employees?limit=9999')) as any
    expect(res.body.limit).toBe(500)
  })

  it('minimum page is 1 even when page=0 is passed', async () => {
    const res = await GET(makeRequest('https://app.test/api/tenant/employees?page=0')) as any
    expect(res.body.page).toBe(1)
  })
})

// ── POST — guard ───────────────────────────────────────────────────────────────

describe('POST /api/tenant/employees — guards', () => {
  it('returns 403 when employee tries to create a new employee', async () => {
    mockGetSession.mockResolvedValue({ ...YPC_SESSION, userRole: 'employee' } as any)
    const req = Object.assign(makeRequest('https://app.test/api/tenant/employees'), {
      json: () => Promise.resolve({ firstName: 'Test', lastName: 'User', email: 'test@example.com' }),
    })
    const res = await POST(req as any) as any
    expect(res.status).toBe(403)
  })

  it('returns 403 when hr_officer… wait, hr_officer CAN write employees', async () => {
    // hr_officer has employees:write — should NOT be 403
    mockGetSession.mockResolvedValue({ ...YPC_SESSION, userRole: 'hr_officer' } as any)
    // Provide a minimal valid payload; DB insert will return [] (no-op mock)
    const req = Object.assign(makeRequest('https://app.test/api/tenant/employees'), {
      json: () => Promise.resolve({
        firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com',
        employmentType: 'full_time', startDate: '2024-01-01',
      }),
    })
    const res = await POST(req as any) as any
    // May be 200/201 or 400/500 depending on validation — just not 403
    expect(res.status).not.toBe(403)
  })
})
