/**
 * API route tests — POST /api/auth/logout
 * src/app/api/auth/logout/route.ts
 */
import { describe, it, expect, vi } from 'vitest'

// ── Next.js stubs ─────────────────────────────────────────────────────────────

const mockCookiesSet = vi.fn()

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      _tag: 'NextResponse', body, status: init?.status ?? 200,
      cookies: { set: mockCookiesSet },
    }),
  },
}))

// ── Session stub ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/session', () => ({
  clearCookieOptions: vi.fn(() => ({ name: 'session', value: '', maxAge: 0 })),
  getSession: vi.fn(() => Promise.resolve({ sub: 'u1' })),
}))

// ── Import after mocks ────────────────────────────────────────────────────────

import { POST } from '@/app/api/auth/logout/route'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('returns 200 and clears the session cookie', async () => {
    const res = await POST() as any
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(mockCookiesSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'session', maxAge: 0 }),
    )
  })
})
