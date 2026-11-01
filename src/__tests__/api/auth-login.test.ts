/**
 * API route tests — POST /api/auth/login
 * src/app/api/auth/login/route.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Next.js / cookie stubs ────────────────────────────────────────────────────

const mockCookiesSet = vi.fn()

vi.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      _tag: 'NextResponse',
      body,
      status: init?.status ?? 200,
      cookies: { set: mockCookiesSet },
    }),
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined) })),
}))

// ── DB stub ───────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: mockDbSelect }) }),
    update: () => ({ set: () => ({ where: vi.fn(() => Promise.resolve()) }) }),
    insert: () => ({ values: () => Promise.resolve() }),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  superAdmins: {},
  users:       {},
  tenants:     {},
  auditLogs:   {},
}))

vi.mock('drizzle-orm', () => ({
  eq:  vi.fn(),
  and: vi.fn(),
}))

// ── Auth stubs ────────────────────────────────────────────────────────────────

const mockSignToken     = vi.fn().mockResolvedValue('signed.jwt.token')
const mockSignTempToken = vi.fn().mockResolvedValue('temp.jwt.token')
const mockVerifyToken   = vi.fn()

vi.mock('@/lib/auth/jwt', () => ({
  signToken:     (...a: unknown[]) => mockSignToken(...a),
  signTempToken: (...a: unknown[]) => mockSignTempToken(...a),
  verifyToken:   (...a: unknown[]) => mockVerifyToken(...a),
}))

vi.mock('@/lib/auth/session', () => ({
  sessionCookieOptions: (token: string) => ({ name: 'hrms_session', value: token }),
  getSession: vi.fn(),
}))

// ── bcrypt stub ───────────────────────────────────────────────────────────────

const mockBcryptCompare = vi.fn()
vi.mock('bcryptjs', () => ({ default: { compare: (...a: unknown[]) => mockBcryptCompare(...a) } }))

// ── Import route after all mocks ──────────────────────────────────────────────

import { POST } from '@/app/api/auth/login/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReq(body: unknown) {
  return { json: async () => body } as any
}

const ADMIN = { id: 'sa-1', email: 'admin@hrms.com', name: 'Super Admin', passwordHash: '$hash', isActive: true }
const TENANT = { id: 'tenant-1', slug: 'acme', isActive: true, name: 'Acme Corp' }
const USER   = { id: 'user-1', email: 'alice@acme.com', passwordHash: '$hash', isActive: true, role: 'hr_officer', totpEnabled: false, tenantId: 'tenant-1' }

beforeEach(() => {
  vi.clearAllMocks()
  mockBcryptCompare.mockResolvedValue(true)
  mockSignToken.mockResolvedValue('signed.jwt.token')
})

// ── Validation ────────────────────────────────────────────────────────────────

describe('POST /api/auth/login — validation', () => {
  it('returns 400 when email is missing', async () => {
    const res = await POST(makeReq({ password: 'secret' })) as any
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/email/i)
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeReq({ email: 'a@b.com' })) as any
    expect(res.status).toBe(400)
  })
})

// ── Impersonation ─────────────────────────────────────────────────────────────

describe('POST /api/auth/login — impersonation', () => {
  it('returns 401 for invalid impersonation token', async () => {
    mockVerifyToken.mockResolvedValue(null)
    const res = await POST(makeReq({ __impersonateToken: 'bad-token' })) as any
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/impersonation/i)
  })

  it('returns 401 when token role is not tenant_user', async () => {
    mockVerifyToken.mockResolvedValue({ role: 'super_admin' })
    const res = await POST(makeReq({ __impersonateToken: 'token' })) as any
    expect(res.status).toBe(401)
  })

  it('succeeds with valid tenant_user impersonation token', async () => {
    mockVerifyToken.mockResolvedValue({ role: 'tenant_user' })
    const res = await POST(makeReq({ __impersonateToken: 'valid-token' })) as any
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.role).toBe('tenant_user')
  })
})

// ── Super admin login ─────────────────────────────────────────────────────────

describe('POST /api/auth/login — super admin', () => {
  it('returns 401 when admin not found', async () => {
    mockDbSelect.mockResolvedValue([])
    const res = await POST(makeReq({ email: 'admin@hrms.com', password: 'pw' })) as any
    expect(res.status).toBe(401)
  })

  it('returns 401 when admin is inactive', async () => {
    mockDbSelect.mockResolvedValue([{ ...ADMIN, isActive: false }])
    const res = await POST(makeReq({ email: 'admin@hrms.com', password: 'pw' })) as any
    expect(res.status).toBe(401)
  })

  it('returns 401 when password is wrong', async () => {
    mockDbSelect.mockResolvedValue([ADMIN])
    mockBcryptCompare.mockResolvedValue(false)
    const res = await POST(makeReq({ email: 'admin@hrms.com', password: 'wrong' })) as any
    expect(res.status).toBe(401)
  })

  it('returns 200 with super_admin role on success', async () => {
    mockDbSelect.mockResolvedValue([ADMIN])
    mockBcryptCompare.mockResolvedValue(true)
    const res = await POST(makeReq({ email: 'admin@hrms.com', password: 'correct' })) as any
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('super_admin')
    expect(res.body.redirectTo).toBe('/super-admin')
  })

  it('sets session cookie on super admin success', async () => {
    mockDbSelect.mockResolvedValue([ADMIN])
    mockBcryptCompare.mockResolvedValue(true)
    await POST(makeReq({ email: 'admin@hrms.com', password: 'correct' }))
    expect(mockCookiesSet).toHaveBeenCalled()
  })
})

// ── Tenant user login ─────────────────────────────────────────────────────────

describe('POST /api/auth/login — tenant user', () => {
  it('returns 404 when tenant not found', async () => {
    mockDbSelect.mockResolvedValueOnce([])
    const res = await POST(makeReq({ email: 'alice@acme.com', password: 'pw', tenantSlug: 'acme' })) as any
    expect(res.status).toBe(404)
  })

  it('returns 404 when tenant is inactive', async () => {
    mockDbSelect.mockResolvedValueOnce([{ ...TENANT, isActive: false }])
    const res = await POST(makeReq({ email: 'alice@acme.com', password: 'pw', tenantSlug: 'acme' })) as any
    expect(res.status).toBe(404)
  })

  it('returns 401 when user not found in tenant', async () => {
    mockDbSelect
      .mockResolvedValueOnce([TENANT])
      .mockResolvedValueOnce([])
    const res = await POST(makeReq({ email: 'nobody@acme.com', password: 'pw', tenantSlug: 'acme' })) as any
    expect(res.status).toBe(401)
  })

  it('returns 401 when user is inactive', async () => {
    mockDbSelect
      .mockResolvedValueOnce([TENANT])
      .mockResolvedValueOnce([{ ...USER, isActive: false }])
    const res = await POST(makeReq({ email: 'alice@acme.com', password: 'pw', tenantSlug: 'acme' })) as any
    expect(res.status).toBe(401)
  })

  it('returns 401 when password is wrong', async () => {
    mockDbSelect
      .mockResolvedValueOnce([TENANT])
      .mockResolvedValueOnce([USER])
    mockBcryptCompare.mockResolvedValue(false)
    const res = await POST(makeReq({ email: 'alice@acme.com', password: 'wrong', tenantSlug: 'acme' })) as any
    expect(res.status).toBe(401)
  })

  it('returns 200 with tenant_user role on success', async () => {
    mockDbSelect
      .mockResolvedValueOnce([TENANT])
      .mockResolvedValueOnce([USER])
    mockBcryptCompare.mockResolvedValue(true)
    const res = await POST(makeReq({ email: 'alice@acme.com', password: 'correct', tenantSlug: 'acme' })) as any
    expect(res.status).toBe(200)
    expect(res.body.role).toBe('tenant_user')
    expect(res.body.redirectTo).toBe('/tenant/dashboard')
  })

  it('returns requires2FA when totpEnabled', async () => {
    mockDbSelect
      .mockResolvedValueOnce([TENANT])
      .mockResolvedValueOnce([{ ...USER, totpEnabled: true }])
    mockBcryptCompare.mockResolvedValue(true)
    const res = await POST(makeReq({ email: 'alice@acme.com', password: 'correct', tenantSlug: 'acme' })) as any
    expect(res.status).toBe(200)
    expect(res.body.requires2FA).toBe(true)
    expect(res.body.tempToken).toBe('temp.jwt.token')
    expect(mockSignTempToken).toHaveBeenCalled()
  })
})
