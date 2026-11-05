'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import ThemeToggle from '@/components/ui/ThemeToggle'

type Branding = {
  name: string
  logoUrl: string | null
  primaryColor: string
  isActive?: boolean
}

function LoginForm() {
  const router  = useRouter()
  const params  = useSearchParams()
  const [tenantSlug,   setTenantSlug]   = useState('')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [branding,     setBranding]     = useState<Branding>({ name: '', logoUrl: null, primaryColor: '#0E3D52' })
  const [brandingLoaded, setBrandingLoaded] = useState(false)
  const [form,      setForm]      = useState({ email: '', password: '' })
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [step,      setStep]      = useState<'password' | 'totp'>('password')
  const [tempToken, setTempToken] = useState('')
  const [totpCode,  setTotpCode]  = useState('')
  const [isDark,    setIsDark]    = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const deploymentTenant = process.env.NEXT_PUBLIC_TENANT_SLUG ?? ''
    const paramTenant      = params.get('tenant') ?? ''
    const slug = deploymentTenant || paramTenant || 'admin'
    const isAdmin = slug === 'admin'
    setIsSuperAdmin(isAdmin)
    setTenantSlug(slug)

    fetch(`/api/auth/tenant-branding?slug=${slug}`)
      .then(r => r.json())
      .then((d: Branding) => {
        setBranding({
          name:         d.name         ?? (isAdmin ? 'Platform Administration' : slug),
          logoUrl:      d.logoUrl      ?? null,
          primaryColor: d.primaryColor ?? '#0E3D52',
        })
        setBrandingLoaded(true)
      })
      .catch(() => {
        setBranding({
          name:         isAdmin ? 'Platform Administration' : slug,
          logoUrl:      null,
          primaryColor: '#0E3D52',
        })
        setBrandingLoaded(true)
      })
  }, [params])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      // Fallback to DOM values to handle browser/autofill cases where React
      // controlled state may not have updated (e.g. password-manager autofill)
      const emailEl = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('input[type="email"]')
      const passEl  = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('input[type="password"]')
      const resolvedEmail    = form.email    || emailEl?.value || ''
      const resolvedPassword = form.password || passEl?.value  || ''
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: resolvedEmail, password: resolvedPassword, tenantSlug }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      if (data.requires2FA && data.tempToken) {
        setTempToken(data.tempToken)
        setTotpCode('')
        setStep('totp')
        return
      }
      router.push(data.redirectTo)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (totpCode.length !== 6) { setError('Enter the 6-digit code from your authenticator app.'); return }
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/auth/totp/challenge', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tempToken, code: totpCode }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Invalid code'); return }
      router.push(data.redirectTo)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  const accent = branding.primaryColor

  // ── Derived theme tokens ──────────────────────────────────
  const pageBg        = isDark ? '#060e1c' : '#EDF1F5'
  const cardBg        = isDark ? 'rgba(10,15,34,0.85)'  : 'rgba(255,255,255,0.92)'
  const cardBorder    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
  const inputBg       = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const inputBorder   = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.14)'
  const labelColor    = isDark ? '#94a3b8' : '#475569'
  const headingColor  = isDark ? '#f1f5f9' : '#0f172a'
  const subColor      = isDark ? '#64748b' : '#64748b'
  const inputText     = isDark ? '#e2e8f4' : '#0f172a'
  const footerColor   = isDark ? '#2d3a52' : '#94a3b8'

  const inputClass = "w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all duration-150"

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 transition-colors relative overflow-hidden"
      style={{ background: pageBg }}
    >
      {/* Ambient glow layers */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70vw',
          height: '60vh',
          background: isDark
            ? `radial-gradient(ellipse at center, ${accent}22 0%, transparent 70%)`
            : `radial-gradient(ellipse at center, ${accent}12 0%, transparent 70%)`,
          filter: 'blur(40px)',
        }}
      />
      {isDark && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: '10%',
              left: '15%',
              width: '300px',
              height: '300px',
              background: `radial-gradient(ellipse at center, ${accent}08 0%, transparent 70%)`,
              filter: 'blur(60px)',
            }}
          />
          <div
            className="absolute pointer-events-none"
            style={{
              top: '30%',
              right: '10%',
              width: '200px',
              height: '200px',
              background: `radial-gradient(ellipse at center, ${accent}10 0%, transparent 70%)`,
              filter: 'blur(50px)',
            }}
          />
        </>
      )}

      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle className="p-2 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition" />
      </div>

      <div className="relative w-full max-w-[380px] z-10">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          {brandingLoaded && branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={`${branding.name} logo`}
              className="h-12 max-w-[160px] object-contain mx-auto mb-5"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-5 flex items-center justify-center text-white text-xl font-bold"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
                boxShadow: isDark ? `0 0 32px ${accent}50, 0 0 8px ${accent}30` : `0 4px 16px ${accent}40`,
              }}
            >
              {isSuperAdmin ? '⚡' : (branding.name[0]?.toUpperCase() ?? 'H')}
            </div>
          )}

          <h1
            className="text-[22px] font-bold tracking-tight leading-tight"
            style={{ color: headingColor }}
          >
            {isSuperAdmin ? 'Super Admin' : branding.name}
          </h1>
          <p className="text-sm mt-1.5" style={{ color: subColor }}>
            {isSuperAdmin ? 'Platform administration portal' : `Sign in to ${branding.name || 'your organisation'}`}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 backdrop-blur-xl"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            boxShadow: isDark
              ? '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)'
              : '0 8px 40px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {step === 'password' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  className="rounded-lg px-3.5 py-2.5 text-sm"
                  style={{
                    background: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                    border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : '#fecaca'}`,
                    color: isDark ? '#f87171' : '#dc2626',
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: labelColor }}>
                  Email
                </label>
                <input
                  type="email" required autoComplete="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                  style={{
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: inputText,
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = accent
                    e.target.style.boxShadow = `0 0 0 3px ${accent}18`
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = inputBorder
                    e.target.style.boxShadow = 'none'
                  }}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: labelColor }}>
                  Password
                </label>
                <input
                  type="password" required autoComplete="current-password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className={inputClass}
                  style={{
                    background: inputBg,
                    border: `1px solid ${inputBorder}`,
                    color: inputText,
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = accent
                    e.target.style.boxShadow = `0 0 0 3px ${accent}18`
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = inputBorder
                    e.target.style.boxShadow = 'none'
                  }}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all duration-150 disabled:opacity-50 mt-2"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  boxShadow: isDark
                    ? `0 0 20px ${accent}40, 0 4px 12px rgba(0,0,0,0.3)`
                    : `0 4px 12px ${accent}40`,
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = '' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Signing in…
                  </span>
                ) : 'Sign in'}
              </button>

              {!isSuperAdmin && (
                <p className="text-center text-xs mt-1" style={{ color: subColor }}>
                  <a href="/forgot-password" className="transition-colors hover:underline" style={{ color: accent }}>
                    Forgot your password?
                  </a>
                </p>
              )}
            </form>
          ) : (
            /* 2FA challenge */
            <form onSubmit={handleTotpSubmit} className="space-y-4">
              <div className="text-center pb-2">
                <div
                  className="w-11 h-11 rounded-xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: accent }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold" style={{ color: headingColor }}>Two-Factor Verification</p>
                <p className="text-xs mt-1" style={{ color: subColor }}>Enter the 6-digit code from your authenticator app.</p>
              </div>

              {error && (
                <div
                  className="rounded-lg px-3.5 py-2.5 text-sm"
                  style={{
                    background: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2',
                    border: `1px solid ${isDark ? 'rgba(239,68,68,0.25)' : '#fecaca'}`,
                    color: isDark ? '#f87171' : '#dc2626',
                  }}
                >
                  {error}
                </div>
              )}

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                autoFocus
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                className={`${inputClass} text-xl text-center tracking-[0.5em] font-mono`}
                style={{
                  background: inputBg,
                  border: `1px solid ${inputBorder}`,
                  color: inputText,
                }}
                onFocus={e => {
                  e.target.style.borderColor = accent
                  e.target.style.boxShadow = `0 0 0 3px ${accent}18`
                }}
                onBlur={e => {
                  e.target.style.borderColor = inputBorder
                  e.target.style.boxShadow = 'none'
                }}
                placeholder="000000"
              />

              <button
                type="submit" disabled={loading || totpCode.length !== 6}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  boxShadow: isDark ? `0 0 20px ${accent}40` : `0 4px 12px ${accent}40`,
                }}
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('password'); setError(''); setTotpCode(''); setTempToken('') }}
                className="w-full py-2 text-xs transition-colors"
                style={{ color: subColor }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = headingColor }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = subColor }}
              >
                ← Back to login
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] mt-5" style={{ color: footerColor }}>
          {isSuperAdmin ? 'HRMS · Platform Administration' : `${branding.name} · Powered by HRMS`}
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
