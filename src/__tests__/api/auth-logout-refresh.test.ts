/**
 * API route tests — POST /api/auth/logout
 * src/app/api/auth/logout/route.ts
 * (refresh is covered in auth-refresh.test.ts)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Next.js stubs ─────────────────────────────────────────────────────────────

const mockCookiesSet = vi.fn()

vi.mock('next/server', () => ({
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

// ── Session / JWT stubs ───────────────────────────────────────────────────────

const mockGetSession    = vi.fn()
const mockSignToken     = vi.fn().mockResolvedValue('new.signed.token')

vi.mock('@/lib/auth/session', () => ({
  getSession:          (...a: unknown[]) => mockGetSession(...a),
  sessionCookieOptions: (token: string)  => ({ name: 'hrms_session', value: token }),
  clearCookieOptions:  ()                => ({ name: 'hrms_session', value: '', maxAge: 0 }),
}))

vi.mock('@/lib/auth/jwt', () => ({
  signToken:   (...a: unknown[]) => mockSignToken(...a),
  verifyToken: vi.fn(),
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { POST as logoutPOST } from '@/app/api/auth/logout/route'

beforeEach(() => {
  vi.clearAllMocks()
  mockSignToken.mockResolvedValue('new.signed.token')
  mockGetSession.mockResolvedValue({ sub: 'u1', email: 'hr@test.com', tenantId: 'tid-001', role: 'tenant_user', userRole: 'hr_officer' })
})

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 ok', async () => {
    const res = await logoutPOST() as any
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('clears the session cookie', async () => {
    await logoutPOST()
    expect(mockCookiesSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'hrms_session', maxAge: 0 })
    )
  })
})
