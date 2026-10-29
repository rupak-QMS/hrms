import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

/**
 * Middleware — multi-tenant routing + JWT auth guard.
 *
 * Works in two modes:
 *
 * A) Separate-project mode (current approach):
 *    Each Vercel project sets NEXT_PUBLIC_TENANT_SLUG (NEXT_PUBLIC_ required — used in login page client component):
 *      superadmin-hrms  →  NEXT_PUBLIC_TENANT_SLUG=admin
 *      yahwehcare-hrms  →  NEXT_PUBLIC_TENANT_SLUG=yahweh-care
 *      yahwehpc-hrms    →  NEXT_PUBLIC_TENANT_SLUG=yahweh-property-care
 *
 * B) Subdomain mode (future, with a custom domain):
 *    superadmin.yourdomain.com, yahwehcare.yourdomain.com, etc.
 *    Set ROOT_DOMAIN=yourdomain.com in Vercel (server-side only, no NEXT_PUBLIC_ prefix).
 */

const SESSION_COOKIE = 'hrms_session'

// Sliding-window refresh: re-issue the token when < this many seconds remain
const REFRESH_THRESHOLD_SECS = 60 * 60 // 1 hour

// Subdomains that identify the super admin portal (used in subdomain mode)
const SUPER_ADMIN_SUBDOMAINS = ['superadmin', 'admin']

// Subdomain → DB tenant slug mapping.
// Convention: subdomain IS the slug (set when creating tenant in Super Admin).
// Add manual overrides here only for legacy subdomains that differ from their slug.
const SUBDOMAIN_TENANT_MAP: Record<string, string> = {
  yahwehcare: 'yahweh-care',          // legacy: subdomain differs from slug
  yahwehpc:   'yahweh-property-care', // legacy: subdomain differs from slug
  // New tenants: subdomain === slug, so no entry needed here
}

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  '/_next',
  '/favicon',
  '/icons',
  '/images',
  '/manifest',
]

function getSecret() {
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production-min-32-chars!!'
  return new TextEncoder().encode(secret)
}

type SessionPayload = {
  role: string
  tenantId?: string
  tenantSlug?: string
  [key: string]: unknown
}

/**
 * Verify the JWT and return the payload.
 * Also returns a refreshed token string if the token is within the
 * REFRESH_THRESHOLD_SECS window — caller should set it as the new cookie.
 */
async function verifySession(
  token: string,
): Promise<{ payload: SessionPayload | null; refreshedToken: string | null }> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const sessionPayload = payload as unknown as SessionPayload

    // Sliding-window: re-sign if expiry is within 1 hour
    const exp = typeof payload.exp === 'number' ? payload.exp : 0
    const now = Math.floor(Date.now() / 1000)
    const remaining = exp - now

    let refreshedToken: string | null = null
    if (remaining > 0 && remaining < REFRESH_THRESHOLD_SECS) {
      // Re-sign with all the same claims, fresh 8h window
      const { exp: _exp, iat: _iat, ...claims } = payload as Record<string, unknown>
      void _exp; void _iat
      refreshedToken = await new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('8h')
        .sign(getSecret())
    }

    return { payload: sessionPayload, refreshedToken }
  } catch {
    return { payload: null, refreshedToken: null }
  }
}

/** Apply the refreshed session cookie to a response (if one was issued). */
function applyRefreshedToken(res: NextResponse, token: string | null) {
  if (!token) return
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  })
}

function extractSubdomain(hostname: string): string | null {
  const host       = hostname.split(':')[0]
  const rootDomain = process.env.ROOT_DOMAIN ?? ''

  if (rootDomain) {
    if (host === rootDomain) return null
    if (host.endsWith(`.${rootDomain}`)) {
      return host.slice(0, host.length - rootDomain.length - 1).split('.')[0]
    }
    return null
  }

  if (host === 'localhost' || host === '127.0.0.1') return null
  return null   // no root domain configured → subdomain mode inactive
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  const hostname = request.headers.get('host') ?? ''

  // ── Public paths always pass through ──────────────────────────────────────
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // ── Deployment-level tenant (NEXT_PUBLIC_TENANT_SLUG env var) ─────────────
  const deploymentTenant = process.env.NEXT_PUBLIC_TENANT_SLUG ?? ''

  // ── Subdomain detection (future custom domain support) ─────────────────────
  const subdomain = extractSubdomain(hostname)

  // ── Determine if this is a super admin context ────────────────────────────
  const isSuperAdmin =
    deploymentTenant === 'admin' ||
    (subdomain !== null && SUPER_ADMIN_SUBDOMAINS.includes(subdomain))

  // ── Super Admin routing + auth guard ──────────────────────────────────────
  if (isSuperAdmin || pathname.startsWith('/super-admin')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    const { payload: session, refreshedToken } = token
      ? await verifySession(token)
      : { payload: null, refreshedToken: null }

    if (!session || session.role !== 'super_admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('tenant', 'admin')
      return NextResponse.redirect(url)
    }

    if (isSuperAdmin && !pathname.startsWith('/super-admin') && !pathname.startsWith('/api')) {
      const url = request.nextUrl.clone()
      url.pathname = `/super-admin${pathname === '/' ? '' : pathname}`
      const res = NextResponse.rewrite(url)
      applyRefreshedToken(res, refreshedToken)
      return res
    }

    const res = NextResponse.next()
    applyRefreshedToken(res, refreshedToken)
    return res
  }

  // ── Tenant routing + auth guard ───────────────────────────────────────────
  let tenantSlug: string | null | undefined =
    (deploymentTenant && deploymentTenant !== 'admin' ? deploymentTenant : null) ??
    (subdomain ? (SUBDOMAIN_TENANT_MAP[subdomain] ?? subdomain) : null) ??
    searchParams.get('tenant') ??
    request.cookies.get('tenant_slug')?.value

  // Last resort: read tenantSlug from the JWT itself (covers deployments where
  // NEXT_PUBLIC_TENANT_SLUG isn't configured and tenant_slug cookie has expired)
  if (!tenantSlug) {
    const token = request.cookies.get(SESSION_COOKIE)?.value
    if (token) {
      const { payload: jwtPayload } = await verifySession(token)
      if (jwtPayload?.role === 'tenant_user' && jwtPayload.tenantSlug) {
        tenantSlug = jwtPayload.tenantSlug as string
      }
    }
  }

  if (tenantSlug) {
    if (pathname.startsWith('/tenant') || !pathname.startsWith('/api')) {
      const token = request.cookies.get(SESSION_COOKIE)?.value
      const { payload: session, refreshedToken } = token
        ? await verifySession(token)
        : { payload: null, refreshedToken: null }

      if (!session || session.role !== 'tenant_user') {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('tenant', tenantSlug)
        return NextResponse.redirect(url)
      }

      if (pathname.startsWith('/tenant') || pathname.startsWith('/api/tenant')) {
        const reqHeaders = new Headers(request.headers)
        reqHeaders.set('x-tenant-slug', tenantSlug)
        const res = NextResponse.next({ request: { headers: reqHeaders } })
        // Refresh tenant_slug cookie so it stays alive across navigation
        res.cookies.set('tenant_slug', tenantSlug, {
          path: '/', httpOnly: false, sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 8,
        })
        applyRefreshedToken(res, refreshedToken)
        return res
      }
    }

    const url = request.nextUrl.clone()
    url.pathname = `/tenant${pathname === '/' ? '/dashboard' : pathname}`
    const reqHeaders = new Headers(request.headers)
    reqHeaders.set('x-tenant-slug', tenantSlug)
    const res = NextResponse.rewrite(url, { request: { headers: reqHeaders } })
    res.cookies.set('tenant_slug', tenantSlug, { path: '/', httpOnly: false, maxAge: 60 * 60 * 8 })
    return res
  }

  // ── Root → login ──────────────────────────────────────────────────────────
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
