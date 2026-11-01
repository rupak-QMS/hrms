/**
 * API route tests — documents, recognition
 * src/app/api/tenant/documents/route.ts   (GET, POST, PATCH, DELETE)
 * src/app/api/tenant/recognition/route.ts (GET, POST)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Stubs ──────────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL
    _body:   unknown
    constructor(url = 'https://app.test/') { this.nextUrl = new URL(url) }
    async json() { return this._body ?? {} }
  },
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({ body, status: init?.status ?? 200 }),
  },
}))

vi.mock('@/lib/auth/apiGuard', () => ({ apiGuard: vi.fn() }))

// Fire-and-forget notification helpers
vi.mock('@/lib/notifications/notify', () => ({
  notifyRole: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/email/emailHelper', () => ({
  getTenantEmailCtx:   vi.fn().mockResolvedValue({ notify: { emailRecognition: false, emailGrievance: false }, orgName: 'Test Org', logoUrl: '', primaryColor: '#000', loginUrl: '' }),
  getTenantRoleEmails: vi.fn().mockResolvedValue([]),
  fireEmail:           vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/email/templates', () => ({
  recognitionAwardEmail: vi.fn(() => ({ subject: 'Award', html: '<p>Award</p>' })),
}))

function makeSelectChain(data: unknown) {
  const c: Record<string, unknown> = {}
  ;['from', 'where', 'leftJoin', 'orderBy', 'limit', 'offset', 'ilike'].forEach(m => { c[m] = () => c })
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
  eq:    vi.fn(() => 'eq'),
  and:   vi.fn(() => 'and'),
  asc:   vi.fn(() => 'asc'),
  desc:  vi.fn(() => 'desc'),
  gte:   vi.fn(() => 'gte'),
  lte:   vi.fn(() => 'lte'),
  ilike: vi.fn(() => 'ilike'),
  sql:   vi.fn(() => 'sql'),
  isNull: vi.fn(() => 'isNull'),
}))

import { GET as docsGET, POST as docsPOST,
         PATCH as docsPATCH, DELETE as docsDELETE } from '@/app/api/tenant/documents/route'
import { GET as recognGET, POST as recognPOST }     from '@/app/api/tenant/recognition/route'
import { apiGuard }  from '@/lib/auth/apiGuard'
import { db }        from '@/lib/db'
import { NextRequest } from 'next/server'

const mockApiGuard = vi.mocked(apiGuard)
const mockDb       = vi.mocked(db)

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
  mockApiGuard.mockResolvedValue(GUARD_OK as any)
  mockDb.select = vi.fn(() => makeSelectChain([]) as any)
  mockDb.insert = vi.fn(() => makeInsertChain([]) as any)
  mockDb.update = vi.fn(() => makeUpdateChain([]) as any)
  mockDb.delete = vi.fn(() => makeDeleteChain() as any)
})

// ── GET /api/tenant/documents ─────────────────────────────────────────────────

describe('GET /api/tenant/documents', () => {
  it('returns 403 when guard denies access', async () => {
    mockApiGuard.mockResolvedValue(GUARD_403 as any)
    const res = await docsGET(makeReq('https://app.test/api/tenant/documents')) as any
    expect(res.status).toBe(403)
  })

  it('returns documents, stats, and categories', async () => {
    const rows = [
      { id: 'd1', category: 'compliance', title: 'WWCC', status: 'active', expiryDate: null, employeeFirstName: 'Jane', employeeLastName: 'Smith', createdAt: new Date() },
    ]
    const allDocs = [
      { status: 'active', expiryDate: null, category: 'compliance' },
      { status: 'expired', expiryDate: null, category: 'hr' },
    ]
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain(rows) as any)     // filtered records
      .mockReturnValueOnce(makeSelectChain(allDocs) as any)  // all-for-stats
    const res = await docsGET(makeReq('https://app.test/api/tenant/documents')) as any
    expect(res.status).toBe(200)
    expect(res.body.documents).toHaveLength(1)
    expect(res.body.stats.total).toBe(2)
    expect(res.body.stats.active).toBe(1)
    expect(res.body.stats.expired).toBe(1)
    expect(res.body.categories).toContain('compliance')
    expect(res.body.categories).toContain('hr')
  })

  it('returns empty documents and zero stats when no data', async () => {
    mockDb.select = vi.fn()
      .mockReturnValueOnce(makeSelectChain([]) as any)
      .mockReturnValueOnce(makeSelectChain([]) as any)
    const res = await docsGET(makeReq('https://app.test/api/tenant/documents')) as any
    expect(res.body.documents).toEqual([])
    expect(res.body.stats.total).toBe(0)
  })
})

// ── POST /api/tenant/documents ────────────────────────────────────────────────

describe('POST /api/tenant/documents', () => {
  it('returns 403 when guard denies access', async () => {
    mockApiGuard.mockResolvedValue(GUARD_403 as any)
    const res = await docsPOST(makeReq('https://app.test/', { title: 'WWCC', category: 'compliance', blobUrl: 'https://blob.test/file' })) as any
    expect(res.status).toBe(403)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await docsPOST(makeReq('https://app.test/', { title: 'WWCC', category: 'compliance' })) as any
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 201 with the created document on success', async () => {
    const created = { id: 'd2', title: 'Contract', category: 'hr', blobUrl: 'https://blob.test/file', status: 'active', version: 1 }
    mockDb.insert = vi.fn(() => makeInsertChain([created]) as any)
    const res = await docsPOST(makeReq('https://app.test/', { title: 'Contract', category: 'hr', blobUrl: 'https://blob.test/file' })) as any
    expect(res.status).toBe(201)
    expect(res.body.record.title).toBe('Contract')
    expect(res.body.record.status).toBe('active')
  })
})

// ── PATCH /api/tenant/documents ───────────────────────────────────────────────

describe('PATCH /api/tenant/documents', () => {
  it('returns 403 when guard denies access', async () => {
    mockApiGuard.mockResolvedValue(GUARD_403 as any)
    const res = await docsPATCH(makeReq('https://app.test/', { id: 'd1', status: 'expired' })) as any
    expect(res.status).toBe(403)
  })

  it('returns 400 when id is missing', async () => {
    const res = await docsPATCH(makeReq('https://app.test/', { status: 'expired' })) as any
    expect(res.status).toBe(400)
  })

  it('returns 200 with the updated document', async () => {
    const updated = { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', title: 'WWCC', status: 'expired', expiryDate: null, notes: null }
    mockDb.update = vi.fn(() => makeUpdateChain([updated]) as any)
    const res = await docsPATCH(makeReq('https://app.test/', { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', status: 'expired' })) as any
    expect(res.status).toBe(200)
    expect(res.body.record.status).toBe('expired')
  })
})

// ── DELETE /api/tenant/documents ──────────────────────────────────────────────

describe('DELETE /api/tenant/documents', () => {
  it('returns 403 when guard denies access', async () => {
    mockApiGuard.mockResolvedValue(GUARD_403 as any)
    const res = await docsDELETE(makeReq('https://app.test/api/tenant/documents?id=d1')) as any
    expect(res.status).toBe(403)
  })

  it('returns 400 when id is missing from query params', async () => {
    const res = await docsDELETE(makeReq('https://app.test/api/tenant/documents')) as any
    expect(res.status).toBe(400)
  })

  it('returns ok:true on successful delete', async () => {
    const res = await docsDELETE(makeReq('https://app.test/api/tenant/documents?id=d1')) as any
    expect(res.body.ok).toBe(true)
    expect(mockDb.update).toHaveBeenCalled()
  })
})

// ── GET /api/tenant/recognition ───────────────────────────────────────────────

describe('GET /api/tenant/recognition', () => {
  it('returns 403 when guard denies access', async () => {
    mockApiGuard.mockResolvedValue(GUARD_403 as any)
    const res = await recognGET(makeReq('https://app.test/api/tenant/recognition')) as any
    expect(res.status).toBe(403)
  })

  it('returns recognitions array', async () => {
    const rows = [
      { id: 'r1', recipientId: 'e1', nominatedBy: 'e2', type: 'employee_of_month', reason: 'Great work', period: 'Q1 2025', isPublic: true, createdAt: new Date(), recipientFirstName: 'Jane', recipientLastName: 'Smith' },
    ]
    mockDb.select = vi.fn(() => makeSelectChain(rows) as any)
    const res = await recognGET(makeReq('https://app.test/api/tenant/recognition')) as any
    expect(res.status).toBe(200)
    expect(res.body.recognitions).toHaveLength(1)
    expect(res.body.recognitions[0].type).toBe('employee_of_month')
  })
})

// ── POST /api/tenant/recognition ──────────────────────────────────────────────

describe('POST /api/tenant/recognition', () => {
  it('returns 403 when guard denies access', async () => {
    mockApiGuard.mockResolvedValue(GUARD_403 as any)
    const res = await recognPOST(makeReq('https://app.test/', { recipientId: 'e1', type: 'peer_kudos' })) as any
    expect(res.status).toBe(403)
  })

  it('returns 400 when recipientId or type is missing', async () => {
    const res = await recognPOST(makeReq('https://app.test/', { type: 'peer_kudos' })) as any
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/i)
  })

  it('returns 201 with the created recognition', async () => {
    const created = { id: 'r2', recipientId: 'e1', type: 'peer_kudos', reason: 'Helped the team', isPublic: true }
    mockDb.insert = vi.fn(() => makeInsertChain([created]) as any)
    const res = await recognPOST(makeReq('https://app.test/', { recipientId: 'e1', type: 'peer_kudos', reason: 'Helped the team' })) as any
    expect(res.status).toBe(201)
    expect(res.body.record.type).toBe('peer_kudos')
  })
})
