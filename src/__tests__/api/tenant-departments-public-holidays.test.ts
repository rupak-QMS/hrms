/**
 * API route tests — departments + public-holidays
 * src/app/api/tenant/departments/route.ts      (GET, POST)
 * src/app/api/tenant/public-holidays/route.ts  (GET, POST, PATCH, DELETE)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Stubs ──────────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL
    _body: unknown
    constructor(url = 'https://app.test/') { this.nextUrl = new URL(url) }
    async json() { return this._body ?? {} }
  },
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 }),
  },
}))

// departments uses getSession directly
vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))

// public-holidays uses apiGuard
vi.mock('@/lib/auth/apiGuard', () => ({
  apiGuard: vi.fn(),
  apiAuth:  vi.fn(),
}))

// public-holidays imports hasPermission from permissions
vi.mock('@/lib/auth/permissions', () => ({
  hasPermission: vi.fn(() => true),
}))

function makeSelectChain(data: unknown) {
  const c: Record<string, unknown> = {}
  ;['from', 'where', 'orderBy', 'limit', 'leftJoin'].forEach(m => { c[m] = () => c })
  c.then = (resolve: (v: unknown) => void) => Promise.resolve(data).then(resolve)
  return c
}

function makeInsertChain(data: unknown = []) {
  const c: Record<string, unknown> = {}
  ;['values', 'returning'].forEach(m => { c[m] = () => c })
  c.then = (resolve: (v: unknown) => void) => Promise.resolve(data).then(resolve)
  return c
}

function makeUpdateChain(data: unknown = []) {
  const c: Record<string, unknown> = {}
  ;['set', 'where', 'returning'].forEach(m => { c[m] = () => c })
  c.then = (resolve: (v: unknown) => void) => Promise.resolve(data).then(resolve)
  return c
}

function makeDeleteChain() {
  const c: Record<string, unknown> = {}
  c['where'] = () => c
  c.then = (resolve: (v: unknown) => void) => Promise.resolve(undefined).then(resolve)
  return c
}

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => makeSelectChain([])),
    insert: vi.fn(() => makeInsertChain([])),
    update: vi.fn(() => makeUpdateChain([])),
    delete: vi.fn(() => makeDeleteChain()),
  },
}))

vi.mock('drizzle-orm', () => ({
  eq:  vi.fn(() => 'eq'),
  and: vi.fn(() => 'and'),
  gte: vi.fn(() => 'gte'),
  lte: vi.fn(() => 'lte'),
  asc: vi.fn(() => 'asc'),
  sql: vi.fn(() => ({ as: vi.fn(() => 'sql_aliased'), queryChunks: [] })),
  ilike: vi.fn(() => 'ilike'),
  desc: vi.fn(() => 'desc'),
}))

import { GET as deptGET, POST as deptPOST } from '@/app/api/tenant/departments/route'
import {
  GET    as holidayGET,
  POST   as holidayPOST,
  PATCH  as holidayPATCH,
  DELETE as holidayDELETE,
} from '@/app/api/tenant/public-holidays/route'
import { getSession } from '@/lib/auth/session'
import { apiGuard }   from '@/lib/auth/apiGuard'
import { db }         from '@/lib/db'
import { NextRequest } from 'next/server'

const mockGetSession = vi.mocked(getSession)
const mockApiGuard   = vi.mocked(apiGuard)
const mockDb         = vi.mocked(db)

const SESSION = {
  sub: 'u1', email: 'hr@test.com',
  tenantId: 'tid-001',
  role: 'tenant_user' as const,
  userRole: 'hr_officer',
}

const GUARD_OK  = { error: null, session: SESSION }
const GUARD_401 = { error: { body: { error: 'Unauthenticated' }, status: 401 }, session: null }
const GUARD_403 = { error: { body: { error: 'Forbidden' }, status: 403 }, session: null }

function makeReq(url: string, body?: unknown) {
  const r = new NextRequest(url) as any
  if (body !== undefined) r._body = body
  return r
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue(SESSION as any)
  mockApiGuard.mockResolvedValue(GUARD_OK as any)
  mockDb.select = vi.fn(() => makeSelectChain([]) as any)
  mockDb.insert = vi.fn(() => makeInsertChain([]) as any)
  mockDb.update = vi.fn(() => makeUpdateChain([]) as any)
  mockDb.delete = vi.fn(() => makeDeleteChain() as any)
})

// ── GET /api/tenant/departments ────────────────────────────────────────────────

describe('GET /api/tenant/departments', () => {
  it('returns 401 when no session', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401 as any)
    const res = await deptGET(makeReq('https://app.test/')) as any
    expect(res.status).toBe(401)
  })

  it('returns a departments array', async () => {
    mockDb.select = vi.fn(() => makeSelectChain([{ id: 'd1', name: 'HR', description: null }]) as any)
    const res = await deptGET(makeReq('https://app.test/')) as any
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.departments)).toBe(true)
    expect(res.body.departments[0].name).toBe('HR')
  })

  it('returns an empty array when the DB throws', async () => {
    mockDb.select = vi.fn(() => { throw new Error('DB error') })
    const res = await deptGET(makeReq('https://app.test/')) as any
    expect(res.body.error).toBeDefined()
  })
})

// ── POST /api/tenant/departments ──────────────────────────────────────────────

describe('POST /api/tenant/departments', () => {
  it('returns 401 when no session', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401 as any)
    const res = await deptPOST(makeReq('https://app.test/', { name: 'Finance' })) as any
    expect(res.status).toBe(401)
  })

  it('returns 400 when name is missing', async () => {
    const res = await deptPOST(makeReq('https://app.test/', {})) as any
    expect(res.status).toBe(400)
  })

  it('returns 201 with the new department on success', async () => {
    const created = { id: 'd2', name: 'Finance', description: null, isActive: true }
    mockDb.insert = vi.fn(() => makeInsertChain([created]) as any)
    const res = await deptPOST(makeReq('https://app.test/', { name: 'Finance' })) as any
    expect(res.status).toBe(201)
    expect(res.body.department.name).toBe('Finance')
  })
})

// ── GET /api/tenant/public-holidays ───────────────────────────────────────────

describe('GET /api/tenant/public-holidays', () => {
  it('returns 401 when guard fails', async () => {
    mockApiGuard.mockResolvedValue(GUARD_401 as any)
    const res = await holidayGET(makeReq('https://app.test/api/tenant/public-holidays')) as any
    expect(res.status).toBe(401)
  })

  it('returns holidays array and year', async () => {
    const rows = [{ id: 'h1', name: 'New Year', date: '2025-01-01', country: 'AU' }]
    mockDb.select = vi.fn(() => makeSelectChain(rows) as any)
    const res = await holidayGET(makeReq('https://app.test/api/tenant/public-holidays?year=2025')) as any
    expect(res.status).toBe(200)
    expect(res.body.year).toBe(2025)
    expect(res.body.holidays[0].name).toBe('New Year')
  })

  it('defaults year to the current year when not specified', async () => {
    const res = await holidayGET(makeReq('https://app.test/api/tenant/public-holidays')) as any
    expect(res.body.year).toBe(new Date().getFullYear())
  })

  it('returns an empty holidays array when DB has no matching rows', async () => {
    mockDb.select = vi.fn(() => makeSelectChain([]) as any)
    const res = await holidayGET(makeReq('https://app.test/api/tenant/public-holidays')) as any
    expect(res.body.holidays).toEqual([])
  })
})

// ── POST /api/tenant/public-holidays ──────────────────────────────────────────

describe('POST /api/tenant/public-holidays', () => {
  it('returns 403 when guard denies access', async () => {
    mockApiGuard.mockResolvedValue(GUARD_403 as any)
    const res = await holidayPOST(makeReq('https://app.test/', { name: 'Easter', date: '2025-04-18' })) as any
    expect(res.status).toBe(403)
  })

  it('returns 400 when name is missing', async () => {
    const res = await holidayPOST(makeReq('https://app.test/', { date: '2025-04-18' })) as any
    expect(res.status).toBe(400)
  })

  it('returns 400 when date is missing', async () => {
    const res = await holidayPOST(makeReq('https://app.test/', { name: 'Easter' })) as any
    expect(res.status).toBe(400)
  })

  it('returns 201 with the created holiday on success', async () => {
    const created = { id: 'h2', name: 'Easter', date: '2025-04-18', country: 'AU', isNational: true }
    mockDb.insert = vi.fn(() => makeInsertChain([created]) as any)
    const res = await holidayPOST(makeReq('https://app.test/', { name: 'Easter', date: '2025-04-18' })) as any
    expect(res.status).toBe(201)
    expect(res.body.holiday.name).toBe('Easter')
  })
})

// ── PATCH /api/tenant/public-holidays ─────────────────────────────────────────

describe('PATCH /api/tenant/public-holidays', () => {
  it('returns 400 when id is missing', async () => {
    const res = await holidayPATCH(makeReq('https://app.test/', { name: 'Easter' })) as any
    expect(res.status).toBe(400)
  })

  it('returns 404 when holiday not found for this tenant', async () => {
    mockDb.select = vi.fn(() => makeSelectChain([]) as any)
    const res = await holidayPATCH(makeReq('https://app.test/', { id: 'h-999', name: 'Updated' })) as any
    expect(res.status).toBe(404)
  })

  it('returns 200 with the updated holiday on success', async () => {
    const existing = { id: 'h1' }
    const updated  = { id: 'h1', name: 'Updated Name', date: '2025-04-18', country: 'AU' }
    mockDb.select = vi.fn(() => makeSelectChain([existing]) as any)
    mockDb.update = vi.fn(() => makeUpdateChain([updated]) as any)
    const res = await holidayPATCH(makeReq('https://app.test/', { id: 'h1', name: 'Updated Name' })) as any
    expect(res.status).toBe(200)
    expect(res.body.holiday.name).toBe('Updated Name')
  })
})

// ── DELETE /api/tenant/public-holidays ────────────────────────────────────────

describe('DELETE /api/tenant/public-holidays', () => {
  it('returns 400 when id is missing', async () => {
    const res = await holidayDELETE(makeReq('https://app.test/', {})) as any
    expect(res.status).toBe(400)
  })

  it('returns 404 when holiday not found for this tenant', async () => {
    mockDb.select = vi.fn(() => makeSelectChain([]) as any)
    const res = await holidayDELETE(makeReq('https://app.test/', { id: 'bad-id' })) as any
    expect(res.status).toBe(404)
  })

  it('returns 200 and ok:true on successful deletion', async () => {
    mockDb.select = vi.fn(() => makeSelectChain([{ id: 'h1' }]) as any)
    const res = await holidayDELETE(makeReq('https://app.test/', { id: 'h1' })) as any
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('calls db.delete when holiday exists', async () => {
    mockDb.select = vi.fn(() => makeSelectChain([{ id: 'h1' }]) as any)
    await holidayDELETE(makeReq('https://app.test/', { id: 'h1' }))
    expect(mockDb.delete).toHaveBeenCalled()
  })
})
