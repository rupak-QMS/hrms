import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware — hostname-based tenant slug detection + API rate limiting.
 *
 * Priority order (slug):
 *  1. NEXT_PUBLIC_TENANT_SLUG env var (set per Vercel project)
 *  2. Hostname pattern: {slug}-hrmsapp.vercel.app  → slug
 *  3. Hostname pattern: superadmin-hrmsapp.vercel.app → admin
 *  4. Fallback: 'admin'
 *
 * Rate limiting:
 *  - In-memory per-IP sliding window (NOTE: resets on cold start — use Upstash Redis for multi-instance prod)
 *  - 120 req / 60 s per IP on /api routes
 *  - Stricter: 10 req / 60 s on /api/auth routes (login brute-force protection)
 */

// ── In-memory rate limit store (edge-compatible Map) ─────────────────────────
type WindowEntry = { count: number; resetAt: number }
const rateLimitStore = new Map<string, WindowEntry>()

const WINDOW_MS       = 60_000   // 1 minute
const API_LIMIT       = 120      // general API requests per window
const AUTH_LIMIT      = process.env.NODE_ENV === 'development' ? 200 : 10  // auth endpoint requests per window

function rateLimit(key: string, limit: number): { allowed: boolean; remaining: number; resetAt: number } {
  const now  = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    const resetAt = now + WINDOW_MS
    rateLimitStore.set(key, { count: 1, resetAt })
    // Prune old entries occasionally to prevent memory leak
    if (rateLimitStore.size > 10_000) {
      for (const [k, v] of rateLimitStore) {
        if (v.resetAt < now) rateLimitStore.delete(k)
      }
    }
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  entry.count++
  return {
    allowed:   entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt:   entry.resetAt,
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // ── Rate limiting on /api/* paths ─────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const isAuth  = pathname.startsWith('/api/auth/')
    const limit   = isAuth ? AUTH_LIMIT : API_LIMIT
    const key     = `${isAuth ? 'auth' : 'api'}:${ip}`
    const result  = rateLimit(key, limit)

    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type':      'application/json',
            'Retry-After':       String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(result.resetAt),
          },
        }
      )
    }
  }

  // ── Tenant slug detection ─────────────────────────────────────────────────
  const slug = resolveTenantSlug(request)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-slug', slug)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

function resolveTenantSlug(request: NextRequest): string {
  // 1. Deployment-level env var (set per Vercel project)
  const envSlug = process.env.NEXT_PUBLIC_TENANT_SLUG
  if (envSlug && envSlug !== '') return envSlug

  // 2. Extract from hostname
  const host = request.headers.get('host') ?? ''
  const hostname = host.split(':')[0] // strip port

  // superadmin-hrmsapp.vercel.app → admin
  if (hostname.startsWith('superadmin-')) return 'admin'

  // {slug}-hrmsapp.vercel.app → slug
  // e.g. yahweh-care-hrmsapp.vercel.app → yahweh-care
  const hrmsappMatch = hostname.match(/^(.+)-hrmsapp\./)
  if (hrmsappMatch) return hrmsappMatch[1]

  // Custom domain: tenant.yourdomain.com → tenant
  // e.g. yahwehcare.yahwehhrms.com.au → yahwehcare
  const parts = hostname.split('.')
  if (parts.length >= 3) return parts[0]

  return 'admin'
}

export const config = {
  matcher: [
    // Run on all routes except static files, _next internals, and api/upload
    '/((?!_next/static|_next/image|favicon.ico|icons|images|api/upload).*)',
  ],
}
