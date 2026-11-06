import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const metadata: Metadata = {
  title: '404 — Page Not Found',
}

interface NotFoundConfig {
  headline?: string
  message?: string
  ctaLabel?: string
  ctaHref?: string
}

interface TenantBranding {
  name: string
  logoUrl: string | null
  primaryColor: string
  notFound: NotFoundConfig
}

async function getTenantBranding(): Promise<TenantBranding | null> {
  const slug = process.env.NEXT_PUBLIC_TENANT_SLUG
  if (!slug) return null
  try {
    const [tenant] = await db
      .select({
        name:         tenants.name,
        logoUrl:      tenants.logoUrl,
        primaryColor: tenants.primaryColor,
        settings:     tenants.settings,
      })
      .from(tenants)
      .where(eq(tenants.slug, slug))
    if (!tenant) return null
    const s = (tenant.settings ?? {}) as Record<string, unknown>
    return {
      name:         tenant.name,
      logoUrl:      tenant.logoUrl ?? null,
      primaryColor: tenant.primaryColor ?? '#0E3D52',
      notFound:     (s.notFound ?? {}) as NotFoundConfig,
    }
  } catch {
    return null
  }
}

export default async function NotFound() {
  const branding = await getTenantBranding()

  const orgName    = branding?.name ?? 'HRMS'
  const logoUrl    = branding?.logoUrl ?? null
  const color      = branding?.primaryColor ?? '#0E3D52'
  const cfg        = branding?.notFound ?? {}
  const headline   = cfg.headline  ?? 'Page not found'
  const message    = cfg.message   ?? "The page you're looking for doesn't exist or has been moved."
  const ctaLabel   = cfg.ctaLabel  ?? 'Go to dashboard'
  const ctaHref    = cfg.ctaHref   ?? '/tenant/dashboard'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">

      {/* Logo / brand mark */}
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={orgName}
          className="h-14 w-auto object-contain mb-8"
        />
      ) : (
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mb-8 shadow-md text-white font-bold text-xl"
          style={{ background: color }}
        >
          {orgName[0] ?? 'H'}
        </div>
      )}

      {/* Ghost 404 */}
      <p className="text-8xl font-extrabold tracking-tight text-gray-200 dark:text-gray-800 select-none mb-2">
        404
      </p>

      {/* Headline */}
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3 text-center">
        {headline}
      </h1>

      {/* Custom or default message */}
      <p className="text-gray-500 dark:text-gray-400 text-sm text-center max-w-xs mb-8">
        {message}
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{ background: color }}
        >
          {ctaLabel}
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-[#1A6080]/30 shadow-sm hover:bg-gray-50 dark:hover:bg-[#0E3D52]/40 transition-colors focus:outline-none"
        >
          Back to login
        </Link>
      </div>

      {/* Org name footer */}
      {branding && (
        <p className="mt-12 text-xs text-gray-400 dark:text-gray-600">
          {orgName} · Powered by HRMS
        </p>
      )}
    </div>
  )
}
