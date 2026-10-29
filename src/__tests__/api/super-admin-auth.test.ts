/**
 * Unit tests — Super-Admin API auth guards
 *
 * Covers: /api/super-admin/admins, /api/super-admin/clients,
 *         /api/super-admin/clients/[id], /api/super-admin/clients/[id]/logo,
 *         /api/super-admin/clients/[id]/modules, /api/super-admin/clients/[id]/users
 *
 * Security requirement: every HTTP method on every super-admin route must
 * return 401 when no session exists or the session role is not 'super_admin'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Next.js stubs ─────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextRequest: class {
    nextUrl: URL
    private _body: unknown
    constructor(url = 'http://localhost/api', _init?: RequestInit) {
      this.nextUrl = new URL(url)
      this._body = {}
    }
    async json() { return this._body }
    async formData() { return { get: () => null, entries: () => new Map().entries() } }
  },
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => ({
      _tag: 'NextResponse',
      body,
      status: init?.status ?? 200,
    }),
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(() => undefined) })),
}))

// ── Session mock ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/session', () => ({ getSession: vi.fn() }))
import { getSession } from '@/lib/auth/session'
const mockGetSession = vi.mocked(getSession)

// ── DB / schema stubs ─────────────────────────────────────────────────────────

const chainProxy: any = new Proxy({}, {
  get: (_t, prop) => {
    if (prop === 'then') return undefined
    if (prop === Symbol.toPrimitive) return undefined
    return () => chainProxy
  },
})

vi.mock('@/lib/db', () => ({
  db: {
    select:  vi.fn(() => chainProxy),
    insert:  vi.fn(() => ({ values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([{ id: 'x' }]) })),
    update:  vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([]) })),
    delete:  vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    query:   { tenants: { findFirst: vi.fn().mockResolvedValue(null) } },
  },
}))

vi.mock('@/lib/db/schema', () => ({
  superAdmins:    { id: 'id', email: 'email', name: 'name', isActive: 'isActive', createdAt: 'createdAt', lastLoginAt: 'lastLoginAt', passwordHash: 'passwordHash' },
  tenants:        { id: 'id', slug: 'slug', name: 'name', isActive: 'isActive', createdAt: 'createdAt', logoUrl: 'logoUrl', primaryColor: 'primaryColor', plan: 'plan', contactEmail: 'contactEmail' },
  users:          { id: 'id', tenantId: 'tenantId', email: 'email', role: 'role', isActive: 'isActive', createdAt: 'createdAt' },
  tenantModules:  { tenantId: 'tenantId', moduleName: 'moduleName', isEnabled: 'isEnabled', updatedAt: 'updatedAt' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(), and: vi.fn(), or: vi.fn(), ilike: vi.fn(),
  asc: vi.fn(), desc: vi.fn(), count: vi.fn(() => 'count'),
  sql: Object.assign(vi.fn(() => 'sql'), { raw: vi.fn(() => 'sql') }),
  inArray: vi.fn(), ne: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$hashed'), compare: vi.fn().mockResolvedValue(true) },
}))

vi.mock('@/lib/email/resend',    () => ({ sendEmail:            vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/email/templates', () => ({ superAdminInviteEmail: vi.fn().mockReturnValue({ subject: '', html: '' }) }))
vi.mock('@/lib/storage/supabase',() => ({ uploadFile: vi.fn().mockResolvedValue('https://cdn/logo.png'), deleteFile: vi.fn().mockResolvedValue(true) }))

// ── Import route handlers AFTER all vi.mock() calls ───────────────────────────

import { GET as adminsGET,  POST as adminsPOST  } from '@/app/api/super-admin/admins/route'
import { GET as clientsGET, POST as clientsPOST } from '@/app/api/super-admin/clients/route'
import { GET as clientIdGET, PATCH as clientIdPATCH, DELETE as clientIdDELETE } from '@/app/api/super-admin/clients/[id]/route'
import { POST as logoIdPOST, DELETE as logoIdDELETE } from '@/app/api/super-admin/clients/[id]/logo/route'
import { GET as modulesGET, PATCH as modulesPATCH, POST as modulesPOST } from '@/app/api/super-admin/clients/[id]/modules/route'
import { GET as usersGET, POST as usersPOST, PATCH as usersPATCH, DELETE as usersDELETE } from '@/app/api/super-admin/clients/[id]/users/route'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_ID = '00000000-0000-0000-0000-000000000001'
const idCtx   = { params: Promise.resolve({ id: FAKE_ID }) }

function superAdminSession() {
  return { sub: 'sa-1', email: 'superadmin@yahwehhrms.com.au', role: 'super_admin' as const, name: 'SA' }
}
function tenantSession() {
  return { sub: 'u-1', email: 'director@yahwehcare.com.au', role: 'tenant_user' as const, tenantId: 'tid-1', tenantSlug: 'yahwehcare', userRole: 'director', name: 'Director' }
}
function makeReq(body: unknown = {}) {
  const { NextRequest } = require('next/server')
  const req = new NextRequest('http://localhost/api')
  req.json    = async () => body
  req.formData = async () => ({ get: () => null, entries: () => new Map().entries() })
  return req
}

beforeEach(() => vi.clearAllMocks())

// ── Helper ────────────────────────────────────────────────────────────────────

async function get401(fn: () => Promise<{ status: number }>) {
  const res = await fn()
  return res.status
}

// ══ /api/super-admin/admins ══════════════════════════════════════════════════

describe('GET /api/super-admin/admins — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await get401(() => adminsGET())).toBe(401)
  })
  it('returns 401 for a tenant_user session', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect(await get401(() => adminsGET())).toBe(401)
  })
  it('allows super_admin', async () => {
    mockGetSession.mockResolvedValue(superAdminSession() as any)
    const res = await adminsGET()
    expect(res.status).toBeLessThan(400)
  })
})

describe('POST /api/super-admin/admins — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await get401(() => adminsPOST(makeReq({ email: 'x@x.com', name: 'X', password: 'P@ss1!' })))).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect(await get401(() => adminsPOST(makeReq({ email: 'x@x.com', name: 'X', password: 'P@ss1!' })))).toBe(401)
  })
})

// ══ /api/super-admin/clients ═════════════════════════════════════════════════

describe('GET /api/super-admin/clients — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await get401(() => clientsGET(makeReq()))).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect(await get401(() => clientsGET(makeReq()))).toBe(401)
  })
  it('allows super_admin', async () => {
    mockGetSession.mockResolvedValue(superAdminSession() as any)
    const res = await clientsGET(makeReq())
    expect(res.status).toBeLessThan(400)
  })
})

describe('POST /api/super-admin/clients — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect(await get401(() => clientsPOST(makeReq({ name: 'C', slug: 'c', contactEmail: 'c@c.com' })))).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect(await get401(() => clientsPOST(makeReq({ name: 'C', slug: 'c', contactEmail: 'c@c.com' })))).toBe(401)
  })
})

// ══ /api/super-admin/clients/[id] ════════════════════════════════════════════

describe('GET /clients/[id] — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await clientIdGET(makeReq(), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await clientIdGET(makeReq(), idCtx as any)).status).toBe(401)
  })
})

describe('PATCH /clients/[id] — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await clientIdPATCH(makeReq({ name: 'U' }), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await clientIdPATCH(makeReq({ name: 'U' }), idCtx as any)).status).toBe(401)
  })
})

describe('DELETE /clients/[id] — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await clientIdDELETE(makeReq(), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await clientIdDELETE(makeReq(), idCtx as any)).status).toBe(401)
  })
})

// ══ /clients/[id]/logo ═══════════════════════════════════════════════════════

describe('POST /clients/[id]/logo — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await logoIdPOST(makeReq(), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await logoIdPOST(makeReq(), idCtx as any)).status).toBe(401)
  })
})

describe('DELETE /clients/[id]/logo — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await logoIdDELETE(makeReq(), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await logoIdDELETE(makeReq(), idCtx as any)).status).toBe(401)
  })
})

// ══ /clients/[id]/modules ════════════════════════════════════════════════════

describe('GET /clients/[id]/modules — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await modulesGET(makeReq(), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await modulesGET(makeReq(), idCtx as any)).status).toBe(401)
  })
})

describe('PATCH /clients/[id]/modules — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await modulesPATCH(makeReq({ moduleName: 'leave', isEnabled: true }), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await modulesPATCH(makeReq({ moduleName: 'leave', isEnabled: true }), idCtx as any)).status).toBe(401)
  })
})

describe('POST /clients/[id]/modules — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await modulesPOST(makeReq({ modules: [] }), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await modulesPOST(makeReq({ modules: [] }), idCtx as any)).status).toBe(401)
  })
})

// ══ /clients/[id]/users ══════════════════════════════════════════════════════

describe('GET /clients/[id]/users — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await usersGET(makeReq(), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await usersGET(makeReq(), idCtx as any)).status).toBe(401)
  })
})

describe('POST /clients/[id]/users — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await usersPOST(makeReq({ email: 'u@t.com', role: 'employee' }), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await usersPOST(makeReq({ email: 'u@t.com', role: 'employee' }), idCtx as any)).status).toBe(401)
  })
})

describe('PATCH /clients/[id]/users — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await usersPATCH(makeReq({ userId: 'u-1', isActive: false }), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await usersPATCH(makeReq({ userId: 'u-1', isActive: false }), idCtx as any)).status).toBe(401)
  })
})

describe('DELETE /clients/[id]/users — auth guard', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null)
    expect((await usersDELETE(makeReq({ userId: 'u-1' }), idCtx as any)).status).toBe(401)
  })
  it('returns 401 for tenant_user', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)
    expect((await usersDELETE(makeReq({ userId: 'u-1' }), idCtx as any)).status).toBe(401)
  })
})

// ══ Cross-tenant isolation regression ════════════════════════════════════════

describe('Cross-tenant isolation — all 16 super-admin handlers block tenant sessions', () => {
  it('every handler returns 401 for a tenant session', async () => {
    mockGetSession.mockResolvedValue(tenantSession() as any)

    const handlers = [
      ['GET /admins',          () => adminsGET()],
      ['POST /admins',         () => adminsPOST(makeReq({ email: 'x@y.com', name: 'X', password: 'P@1!' }))],
      ['GET /clients',         () => clientsGET(makeReq())],
      ['POST /clients',        () => clientsPOST(makeReq({ name: 'C', slug: 'c', contactEmail: 'c@c.com' }))],
      ['GET /clients/[id]',    () => clientIdGET(makeReq(), idCtx as any)],
      ['PATCH /clients/[id]',  () => clientIdPATCH(makeReq({ name: 'U' }), idCtx as any)],
      ['DELETE /clients/[id]', () => clientIdDELETE(makeReq(), idCtx as any)],
      ['POST .../logo',        () => logoIdPOST(makeReq(), idCtx as any)],
      ['DELETE .../logo',      () => logoIdDELETE(makeReq(), idCtx as any)],
      ['GET .../modules',      () => modulesGET(makeReq(), idCtx as any)],
      ['PATCH .../modules',    () => modulesPATCH(makeReq({ moduleName: 'leave', isEnabled: true }), idCtx as any)],
      ['POST .../modules',     () => modulesPOST(makeReq({ modules: [] }), idCtx as any)],
      ['GET .../users',        () => usersGET(makeReq(), idCtx as any)],
      ['POST .../users',       () => usersPOST(makeReq({ email: 'u@t.com', role: 'employee' }), idCtx as any)],
      ['PATCH .../users',      () => usersPATCH(makeReq({ userId: 'u-1', isActive: false }), idCtx as any)],
      ['DELETE .../users',     () => usersDELETE(makeReq({ userId: 'u-1' }), idCtx as any)],
    ] as [string, () => Promise<{ status: number }>][]

    const results = await Promise.all(handlers.map(([, fn]) => fn()))
    results.forEach((res, i) => {
      expect(res.status, `${handlers[i][0]} should return 401`).toBe(401)
    })
  })
})
