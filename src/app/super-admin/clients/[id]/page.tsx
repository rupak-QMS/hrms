'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const TIERS = [
  { value: 'starter',      label: 'Starter',      modules: 9,  desc: '9 modules — Core + Compliance' },
  { value: 'professional', label: 'Professional',  modules: 19, desc: '19 modules — + Learning, Talent, Safety' },
  { value: 'enterprise',   label: 'Enterprise',    modules: 28, desc: '28 modules — full platform' },
]

const STARTER_MODULES    = [1,2,3,4,5,6,7,8,9]
const PRO_MODULES        = [...STARTER_MODULES, 10,11,12,13,14,15,16,17,18,19]
const ENTERPRISE_MODULES = Array.from({ length: 28 }, (_, i) => i + 1)
const TIER_MODULE_MAP: Record<string, number[]> = {
  starter: STARTER_MODULES, professional: PRO_MODULES, enterprise: ENTERPRISE_MODULES,
}

const FONT_OPTIONS = ['Inter', 'Poppins', 'Roboto', 'DM Sans', 'Nunito', 'Lato', 'Open Sans']
const RADIUS_OPTIONS = [
  { value: '0',      label: 'Sharp' },
  { value: '4px',    label: 'Subtle' },
  { value: '8px',    label: 'Rounded' },
  { value: '12px',   label: 'Soft' },
  { value: '9999px', label: 'Pill' },
]
const PRESET_THEMES = [
  { label: 'Ocean',    primaryColor: '#0E3D52', accentColor: '#E8973A' },
  { label: 'Forest',   primaryColor: '#16a34a', accentColor: '#0d9488' },
  { label: 'Sunrise',  primaryColor: '#ea580c', accentColor: '#d97706' },
  { label: 'Midnight', primaryColor: '#6d28d9', accentColor: '#db2777' },
  { label: 'Teal',     primaryColor: '#0d9488', accentColor: '#0891b2' },
  { label: 'Slate',    primaryColor: '#334155', accentColor: '#0ea5e9' },
]

const INPUT = 'w-full bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]'
const LABEL = 'block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1'

type TabId = 'general' | 'branding' | 'theme' | 'errorPages' | 'config'

function EditClientInner() {
  const { id }       = useParams<{ id: string }>()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const fileRef      = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '', slug: '', tier: 'enterprise',
    primaryColor: '#0E3D52', isActive: true,
  })
  const [theme, setTheme] = useState({
    accentColor: '#E8973A', fontFamily: 'Inter', borderRadius: '8px', sidebarDark: true,
  })
  const [logoUrl,       setLogoUrl]       = useState<string>('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [deploymentUrl, setDeploymentUrl] = useState<string>('')
  const [originalTier,  setOriginalTier]  = useState('enterprise')

  // ── 404 / Error page config ──────────────────────────────
  const [notFound, setNotFound] = useState({
    headline: 'Page not found',
    message:  "The page you're looking for doesn't exist or has been moved.",
    ctaLabel: 'Go to dashboard',
    ctaHref:  '/tenant/dashboard',
  })

  // ── Configuration (email / SMTP / limits) ────────────────
  const [emailConfig, setEmailConfig] = useState({
    emailFrom:    '',   // e.g. "Yahweh Care <noreply@yahwehcare.com.au>"
    supportEmail: '',
    replyTo:      '',
  })
  const [smtpConfig, setSmtpConfig] = useState({
    resendApiKey: '',
    useSmtp:      false,
    smtpHost:     '',
    smtpPort:     '587',
    smtpUser:     '',
    smtpPass:     '',
  })
  const [limits, setLimits] = useState({
    maxEmployees:   '',
    maxStorageMb:   '',
    allowedFileTypes: 'pdf,docx,xlsx,png,jpg',
  })
  const [resendKeyVisible, setResendKeyVisible] = useState(false)
  const [smtpPassVisible,  setSmtpPassVisible]  = useState(false)

  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [applyingTier, setApplyingTier] = useState(false)
  const initialTab = (searchParams.get('tab') as TabId) ?? 'general'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch(`/api/super-admin/clients/${id}`)
      .then(r => r.json())
      .then(data => {
        const t = data.tenant
        if (!t) { setError('Client not found'); setLoading(false); return }
        const tier = t.tier ?? 'enterprise'
        setForm({ name: t.name ?? '', slug: t.slug ?? '', tier, primaryColor: t.primaryColor ?? '#0E3D52', isActive: t.isActive ?? true })
        setOriginalTier(tier)
        setLogoUrl(t.logoUrl ?? '')
        const s = typeof t.settings === 'string' ? JSON.parse(t.settings) : (t.settings ?? {})
        const themeSettings = s.theme ?? s
        setDeploymentUrl(s.deploymentUrl ?? '')
        setTheme({
          accentColor:  themeSettings.accentColor  ?? s.accentColor  ?? '#E8973A',
          fontFamily:   themeSettings.fontFamily   ?? s.fontFamily   ?? 'Inter',
          borderRadius: themeSettings.borderRadius ?? s.borderRadius ?? '8px',
          sidebarDark:  (themeSettings.sidebarDark ?? s.sidebarDark) !== false,
        })
        // notFound config
        if (s.notFound && typeof s.notFound === 'object') {
          setNotFound(prev => ({ ...prev, ...s.notFound }))
        }
        // email config
        if (s.email && typeof s.email === 'object') {
          setEmailConfig(prev => ({ ...prev, ...s.email }))
        }
        // smtp config
        if (s.smtp && typeof s.smtp === 'object') {
          setSmtpConfig(prev => ({ ...prev, ...s.smtp }))
        }
        // limits
        if (s.limits && typeof s.limits === 'object') {
          setLimits(prev => ({ ...prev, ...s.limits }))
        }
        setLoading(false)
      })
      .catch(err => { console.error('[edit-client] fetch error:', err); setError('Failed to load client'); setLoading(false) })
  }, [id])

  // ── Logo upload ───────────────────────────────────────────
  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) { setError('Logo must be under 512 KB'); return }
    setLogoUploading(true)
    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      const res  = await fetch(`/api/super-admin/clients/${id}/logo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Upload failed') }
      else { setLogoUrl(data.logoUrl); setSuccess('Logo updated.') }
      setLogoUploading(false)
    }
    reader.readAsDataURL(file)
  }

  async function removeLogo() {
    await fetch(`/api/super-admin/clients/${id}/logo`, { method: 'DELETE' })
    setLogoUrl(''); setSuccess('Logo removed.')
  }

  // ── Save general ──────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      const res  = await fetch(`/api/super-admin/clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ name: form.name, slug: form.slug, tier: form.tier, isActive: form.isActive }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      setOriginalTier(form.tier)
      setSuccess('Changes saved.')
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setSuccess(''), 3000) }
  }

  // ── Save theme ────────────────────────────────────────────
  async function saveTheme() {
    setSaving(true); setError(''); setSuccess('')
    const settings = { ...theme, primaryColor: form.primaryColor, logoUrl }
    try {
      const res  = await fetch(`/api/super-admin/clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor: form.primaryColor, settings }),
      })
      if (!res.ok) throw new Error('Theme save failed')
      setSuccess('Theme saved — changes reflect immediately in tenant portal.')
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setSuccess(''), 4000) }
  }

  // ── Save notFound (Error Pages tab) ──────────────────────
  async function saveNotFound() {
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`/api/super-admin/clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { notFound } }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSuccess('404 page updated — changes are live immediately.')
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setSuccess(''), 4000) }
  }

  // ── Save configuration ────────────────────────────────────
  async function saveConfig() {
    setSaving(true); setError(''); setSuccess('')
    try {
      const res = await fetch(`/api/super-admin/clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            deploymentUrl: deploymentUrl.trim(),
            email:  emailConfig,
            smtp:   smtpConfig,
            limits: {
              ...limits,
              maxEmployees: limits.maxEmployees ? Number(limits.maxEmployees) : undefined,
              maxStorageMb: limits.maxStorageMb ? Number(limits.maxStorageMb) : undefined,
            },
          },
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSuccess('Configuration saved — email and limits apply immediately.')
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false); setTimeout(() => setSuccess(''), 4000) }
  }

  // ── Apply tier modules ────────────────────────────────────
  async function applyTierDefaults() {
    setApplyingTier(true); setError('')
    const modules = ENTERPRISE_MODULES.map(moduleId => ({
      moduleId, isEnabled: (TIER_MODULE_MAP[form.tier] ?? ENTERPRISE_MODULES).includes(moduleId),
    }))
    const res  = await fetch(`/api/super-admin/clients/${id}/modules`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setApplyingTier(false); return }
    setSuccess(`Applied ${form.tier} defaults.`)
    setApplyingTier(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  if (loading) return <div className="text-gray-600 dark:text-gray-400 p-6">Loading client…</div>

  const tierChanged = form.tier !== originalTier
  const TABS: { id: TabId; label: string }[] = [
    { id: 'general',    label: 'General' },
    { id: 'branding',   label: 'Logo & Branding' },
    { id: 'theme',      label: 'Theme & Colours' },
    { id: 'errorPages', label: 'Error Pages' },
    { id: 'config',     label: 'Configuration' },
  ]

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-contain bg-gray-100 dark:bg-[#0A1929] p-1" />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-900 dark:text-white text-sm font-bold"
              style={{ background: form.primaryColor }}>
              {form.name[0] ?? 'C'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{form.name}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{form.slug} · {form.tier}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/super-admin/clients/${id}/users`}        className="text-xs border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:bg-green-900/30 px-3 py-1.5 rounded-lg transition">Users</Link>
          <Link href={`/super-admin/clients/${id}/modules`}      className="text-xs border border-[#b8d4e0] dark:border-[#1A6080] text-[#0E3D52] dark:text-[#7dcfd7] hover:bg-[#E0EEF4] dark:bg-[#0E3D52]/20 px-3 py-1.5 rounded-lg transition">Modules</Link>
          <Link href={`/super-admin/clients/${id}/integrations`} className="text-xs border border-[#1A6080]/50 dark:border-[#1A6080] text-[#0E3D52] dark:text-[#4ebac4] hover:bg-[#E0EEF4] dark:bg-[#0E3D52]/20 px-3 py-1.5 rounded-lg transition">Integrations</Link>
        </div>
      </div>

      {/* Alerts */}
      {error   && <div className="bg-red-50 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      {success && <div className="bg-green-50 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">{success}</div>}

      {/* Tier-change banner */}
      {tierChanged && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Tier changed → {form.tier}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Save, then apply module defaults ({TIER_MODULE_MAP[form.tier].length} modules enabled).</p>
          </div>
          <button onClick={applyTierDefaults} disabled={applyingTier}
            className="shrink-0 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg">
            {applyingTier ? 'Applying…' : `Apply ${form.tier} modules`}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 dark:border-[#1A6080]/20 gap-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === t.id ? 'border-[#0E3D52] text-[#0E3D52] dark:text-[#4ebac4]' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GENERAL TAB ── */}
      {activeTab === 'general' && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-6 space-y-5">

          {/* Active toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-[#1A6080]/20">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Account Status</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Inactive clients cannot log in</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${form.isActive ? 'bg-green-600' : 'bg-gray-200 dark:bg-[#0E3D52]/60'}`}>
              <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div>
            <label className={LABEL}>Organisation Name</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={INPUT} />
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">This name appears on the client login page and throughout their portal.</p>
          </div>

          <div>
            <label className={LABEL}>URL Slug</label>
            <input required value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
              className={INPUT} />
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
              Portal URL: <span className="text-[#0E3D52] dark:text-[#4ebac4]">{form.slug}.yourdomain.com</span>
            </p>
          </div>

          <div>
            <label className={LABEL}>Subscription Tier</label>
            <div className="space-y-2 mt-2">
              {TIERS.map(t => (
                <label key={t.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  form.tier === t.value ? 'border-[#0E3D52] bg-[#E0EEF4] dark:bg-[#0E3D52]/20' : 'border-gray-300 dark:border-[#1A6080]/30 hover:border-[#1A6080]/40'}`}>
                  <input type="radio" name="tier" value={t.value} checked={form.tier === t.value}
                    onChange={() => setForm(f => ({ ...f, tier: t.value }))} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t.label}</p>
                      <span className="text-xs text-gray-600 dark:text-gray-400">{t.modules} modules</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{t.desc}</p>
                  </div>
                  {originalTier === t.value && <span className="text-xs text-gray-500 shrink-0 mt-0.5 dark:text-gray-400">current</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Deployment URL read-only summary */}
          <div className="rounded-lg bg-gray-100 dark:bg-[#0A1929]/60 border border-gray-300 dark:border-[#1A6080]/30 px-4 py-3">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Vercel Deployment URL</p>
            {deploymentUrl ? (
              <div className="flex items-center gap-2">
                <a href={deploymentUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[#0E3D52] dark:text-[#4ebac4] hover:underline truncate flex-1">
                  {deploymentUrl}
                </a>
                <a href={`${deploymentUrl}/login`} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 text-xs border border-[#b8d4e0] dark:border-[#1A6080] text-[#0E3D52] dark:text-[#7dcfd7] hover:bg-[#E0EEF4] dark:hover:bg-[#0E3D52]/20 px-2.5 py-1 rounded-lg transition">
                  Open Portal →
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic dark:text-gray-400">
                Not set — add it in the <button type="button" onClick={() => setActiveTab('config')} className="underline text-[#0E3D52] dark:text-[#4ebac4]">Configuration tab</button>.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="w-full sm:w-auto bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => router.push('/super-admin/clients')}
              className="border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-4 py-2.5 rounded-lg transition">
              ← Clients
            </button>
          </div>
        </form>
      )}

      {/* ── BRANDING TAB ── */}
      {activeTab === 'branding' && (
        <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-6 space-y-6">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Organisation Logo</p>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-xl bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
                ) : (
                  <span className="text-3xl text-gray-400">🖼</span>
                )}
              </div>
              <div className="space-y-2 flex-1">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden" onChange={handleLogoFile} />
                <button onClick={() => fileRef.current?.click()} disabled={logoUploading}
                  className="w-full bg-gray-100 dark:bg-[#0A1929] hover:bg-gray-200 dark:hover:bg-[#0E3D52]/40 border border-gray-300 dark:border-[#1A6080]/30 disabled:opacity-60 text-gray-900 dark:text-white text-sm px-4 py-2.5 rounded-lg transition">
                  {logoUploading ? '⏳ Uploading…' : 'Upload Logo'}
                </button>
                {logoUrl && (
                  <button onClick={removeLogo}
                    className="w-full border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 text-sm px-4 py-2.5 rounded-lg transition">
                    Remove Logo
                  </button>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, SVG or WebP · max 512 KB · Recommended: 200×60px on transparent background</p>
              </div>
            </div>
          </div>

          <div>
            <label className={LABEL}>Portal Display Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={INPUT} />
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Shown on login page, browser tab, and portal header.</p>
          </div>

          <div className="rounded-xl overflow-hidden border border-gray-300 dark:border-[#1A6080]/30">
            <div className="bg-gray-100 dark:bg-[#0A1929] px-3 py-2 text-xs text-gray-500 font-medium dark:text-gray-400">Login page preview</div>
            <div className="bg-gray-50 dark:bg-[#070F1A] flex items-center justify-center py-8 px-4">
              <div className="w-64 space-y-3 text-center">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-12 mx-auto object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-white text-xl font-bold"
                    style={{ background: form.primaryColor }}>
                    {form.name[0] ?? 'C'}
                  </div>
                )}
                <p className="text-gray-900 dark:text-white font-bold text-lg">{form.name || 'Your Organisation'}</p>
                <p className="text-gray-600 dark:text-gray-400 text-xs">Sign in to {form.name || 'your organisation'}</p>
                <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-3 space-y-2 mt-2">
                  <div className="h-7 bg-gray-100 dark:bg-[#0A1929] rounded-lg" />
                  <div className="h-7 bg-gray-100 dark:bg-[#0A1929] rounded-lg" />
                  <div className="h-7 rounded-lg" style={{ background: form.primaryColor }} />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={async () => {
              setSaving(true); setError(''); setSuccess('')
              try {
                const res = await fetch(`/api/super-admin/clients/${id}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: form.name }),
                })
                if (!res.ok) throw new Error('Save failed')
                setSuccess('Branding saved.')
              } catch (err: any) { setError(err.message) }
              finally { setSaving(false); setTimeout(() => setSuccess(''), 3000) }
            }}
            disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition"
          >
            {saving ? 'Saving…' : 'Save Display Name'}
          </button>
        </div>
      )}

      {/* ── THEME TAB ── */}
      {activeTab === 'theme' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-5">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Preset Themes</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_THEMES.map(p => (
                <button key={p.label}
                  onClick={() => { setForm(f => ({ ...f, primaryColor: p.primaryColor })); setTheme(t => ({ ...t, accentColor: p.accentColor })) }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                    form.primaryColor === p.primaryColor ? 'border-[#0E3D52] bg-[#E0EEF4] dark:bg-[#0E3D52]/20 text-[#0E3D52] dark:text-[#7dcfd7]' : 'border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 hover:border-gray-500'}`}>
                  <span className="w-3 h-3 rounded-full" style={{ background: p.primaryColor }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Primary Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primaryColor}
                    onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                  <input type="text" value={form.primaryColor}
                    onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="flex-1 bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]" />
                </div>
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Sidebar, header accent, buttons</p>
              </div>
              <div>
                <label className={LABEL}>Accent Colour</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={theme.accentColor}
                    onChange={e => setTheme(t => ({ ...t, accentColor: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
                  <input type="text" value={theme.accentColor}
                    onChange={e => setTheme(t => ({ ...t, accentColor: e.target.value }))}
                    className="flex-1 bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]" />
                </div>
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Badges, highlights, secondary elements</p>
              </div>
            </div>

            <div>
              <label className={LABEL}>Font Family</label>
              <div className="flex flex-wrap gap-2">
                {FONT_OPTIONS.map(f => (
                  <button key={f} onClick={() => setTheme(t => ({ ...t, fontFamily: f }))}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition ${theme.fontFamily === f ? 'border-[#0E3D52] bg-[#E0EEF4] dark:bg-[#0E3D52]/20 text-[#0E3D52] dark:text-[#7dcfd7]' : 'border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 hover:border-[#1A6080]/40'}`}
                    style={{ fontFamily: f }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={LABEL}>Border Radius</label>
              <div className="flex gap-2">
                {RADIUS_OPTIONS.map(r => (
                  <button key={r.value} onClick={() => setTheme(t => ({ ...t, borderRadius: r.value }))}
                    className={`flex-1 py-2 text-xs border transition ${theme.borderRadius === r.value ? 'border-[#0E3D52] bg-[#E0EEF4] dark:bg-[#0E3D52]/20 text-[#0E3D52] dark:text-[#7dcfd7]' : 'border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 hover:border-[#1A6080]/40'}`}
                    style={{ borderRadius: r.value }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Dark Sidebar</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Use dark background for sidebar navigation</p>
              </div>
              <button onClick={() => setTheme(t => ({ ...t, sidebarDark: !t.sidebarDark }))}
                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${theme.sidebarDark ? 'bg-[#0E3D52]' : 'bg-gray-200 dark:bg-[#0E3D52]/60'}`}>
                <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform ${theme.sidebarDark ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Live mini-preview */}
            <div className="rounded-xl overflow-hidden border border-gray-300 dark:border-[#1A6080]/30" style={{ fontFamily: theme.fontFamily }}>
              <div className="bg-gray-100 dark:bg-[#0A1929] px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">Live preview</div>
              <div className="flex h-48">
                <div className="w-32 flex flex-col text-white text-xs" style={{ background: theme.sidebarDark ? '#111827' : form.primaryColor }}>
                  <div className="px-3 py-2.5 border-b border-white/10 font-bold truncate" style={{ borderRadius: theme.borderRadius }}>
                    {form.name || 'Client Portal'}
                  </div>
                  {['Dashboard', 'Employees', 'Payroll'].map((item, i) => (
                    <div key={item} className="px-3 py-1.5 text-xs"
                      style={i === 0 ? { background: 'rgba(255,255,255,0.15)', borderRadius: theme.borderRadius } : {}}>
                      {item}
                    </div>
                  ))}
                </div>
                <div className="flex-1 bg-gray-50 dark:bg-[#070F1A] p-3 space-y-2">
                  <div className="flex gap-2">
                    {[{ label: '48 Staff', bg: form.primaryColor }, { label: '3 Leave', bg: theme.accentColor }, { label: '2 Due', bg: '#64748b' }].map(s => (
                      <div key={s.label} className="flex-1 rounded py-1.5 text-center text-white text-xs font-semibold"
                        style={{ background: s.bg, borderRadius: theme.borderRadius }}>{s.label}</div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Recent Activity</div>
                  <div className="bg-white dark:bg-[#0F1E2E] rounded p-2 text-xs text-gray-500 dark:text-gray-400" style={{ borderRadius: theme.borderRadius }}>John Smith — Leave Approved</div>
                  <button className="text-xs text-white px-3 py-1 font-medium"
                    style={{ background: form.primaryColor, borderRadius: theme.borderRadius }}>+ Add Employee</button>
                </div>
              </div>
              <div className="bg-white dark:bg-[#0F1E2E] border-t border-gray-200 dark:border-[#1A6080]/20 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                {theme.fontFamily} · radius {theme.borderRadius} · {theme.sidebarDark ? 'dark' : 'colour'} sidebar
              </div>
            </div>
          </div>

          <button onClick={saveTheme} disabled={saving}
            className="w-full sm:w-auto bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition">
            {saving ? 'Saving…' : 'Save Theme — applies immediately to tenant portal'}
          </button>
        </div>
      )}

      {/* ── ERROR PAGES TAB ── */}
      {activeTab === 'errorPages' && (
        <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-6 space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">404 Page Content</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Customise what users see when they hit a page that doesn't exist. Changes are live immediately — no redeploy needed.</p>
          </div>

          <div>
            <label className={LABEL}>Headline</label>
            <input value={notFound.headline} onChange={e => setNotFound(n => ({ ...n, headline: e.target.value }))} className={INPUT} placeholder="Page not found" />
          </div>

          <div>
            <label className={LABEL}>Message</label>
            <textarea rows={3} value={notFound.message} onChange={e => setNotFound(n => ({ ...n, message: e.target.value }))}
              className={INPUT + ' resize-none'} placeholder="The page you're looking for doesn't exist or has been moved." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Button Label</label>
              <input value={notFound.ctaLabel} onChange={e => setNotFound(n => ({ ...n, ctaLabel: e.target.value }))} className={INPUT} placeholder="Go to dashboard" />
            </div>
            <div>
              <label className={LABEL}>Button URL</label>
              <input value={notFound.ctaHref} onChange={e => setNotFound(n => ({ ...n, ctaHref: e.target.value }))} className={INPUT} placeholder="/tenant/dashboard" />
            </div>
          </div>

          {/* Live mini-preview */}
          <div className="rounded-xl overflow-hidden border border-gray-300 dark:border-[#1A6080]/30">
            <div className="bg-gray-100 dark:bg-[#0A1929] px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 font-medium">404 page preview</div>
            <div className="bg-gray-50 dark:bg-[#070F1A] flex flex-col items-center justify-center py-8 px-4 text-center gap-2">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-10 object-contain mb-1" />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg mb-1"
                  style={{ background: form.primaryColor }}>
                  {form.name[0] ?? 'H'}
                </div>
              )}
              <p className="text-5xl font-extrabold text-gray-200 dark:text-gray-700 select-none">404</p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">{notFound.headline || 'Page not found'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">{notFound.message}</p>
              <div className="flex gap-2 mt-2">
                <span className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium text-white" style={{ background: form.primaryColor }}>
                  {notFound.ctaLabel}
                </span>
                <span className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-[#0A1929] border border-gray-200 dark:border-[#1A6080]/30">
                  Back to login
                </span>
              </div>
            </div>
          </div>

          <button onClick={saveNotFound} disabled={saving}
            className="w-full sm:w-auto bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition">
            {saving ? 'Saving…' : 'Save 404 Page'}
          </button>
        </div>
      )}

      {/* ── CONFIGURATION TAB ── */}
      {activeTab === 'config' && (
        <div className="space-y-5">

          {/* Section: Deployment */}
          <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Deployment</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">The public URL for this client's portal — used in email notification links.</p>
            </div>
            <div>
              <label className={LABEL}>Portal URL</label>
              <input
                value={deploymentUrl}
                onChange={e => setDeploymentUrl(e.target.value)}
                className={INPUT}
                placeholder="https://yahwehcare-hrmsapp.vercel.app"
              />
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Include the full URL with https://</p>
            </div>
          </div>

          {/* Section: Email */}
          <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Email Settings</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Controls the From / Reply-To addresses on all emails sent for this client.</p>
            </div>
            <div>
              <label className={LABEL}>From Address</label>
              <input
                value={emailConfig.emailFrom}
                onChange={e => setEmailConfig(c => ({ ...c, emailFrom: e.target.value }))}
                className={INPUT}
                placeholder='Yahweh Care HR <noreply@yahwehcare.com.au>'
              />
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Format: <code className="text-xs text-gray-600 dark:text-gray-400">Name &lt;email@domain.com&gt;</code></p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Support Email</label>
                <input
                  value={emailConfig.supportEmail}
                  onChange={e => setEmailConfig(c => ({ ...c, supportEmail: e.target.value }))}
                  className={INPUT}
                  placeholder="support@yahwehcare.com.au"
                />
              </div>
              <div>
                <label className={LABEL}>Reply-To</label>
                <input
                  value={emailConfig.replyTo}
                  onChange={e => setEmailConfig(c => ({ ...c, replyTo: e.target.value }))}
                  className={INPUT}
                  placeholder="noreply@yahwehcare.com.au"
                />
              </div>
            </div>
          </div>

          {/* Section: SMTP / Resend */}
          <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Email Provider</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Leave blank to use the platform default Resend key. Set a per-client key for complete email isolation.</p>
              </div>
              {/* SMTP toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-600 dark:text-gray-400">Resend</span>
                <button
                  onClick={() => setSmtpConfig(c => ({ ...c, useSmtp: !c.useSmtp }))}
                  className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${smtpConfig.useSmtp ? 'bg-[#0E3D52]' : 'bg-gray-200 dark:bg-[#0E3D52]/60'}`}>
                  <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform ${smtpConfig.useSmtp ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs text-gray-600 dark:text-gray-400">SMTP</span>
              </div>
            </div>

            {!smtpConfig.useSmtp ? (
              <div>
                <label className={LABEL}>Resend API Key</label>
                <div className="flex gap-2">
                  <input
                    type={resendKeyVisible ? 'text' : 'password'}
                    value={smtpConfig.resendApiKey}
                    onChange={e => setSmtpConfig(c => ({ ...c, resendApiKey: e.target.value }))}
                    className={INPUT}
                    placeholder="re_••••••••••••••••••••••••"
                    autoComplete="off"
                  />
                  <button type="button" onClick={() => setResendKeyVisible(v => !v)}
                    className="shrink-0 border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg text-xs transition">
                    {resendKeyVisible ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                  Get your key at <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#0E3D52] dark:text-[#4ebac4] underline">resend.com/api-keys</a>. Stored securely in tenant settings.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL}>SMTP Host</label>
                    <input value={smtpConfig.smtpHost} onChange={e => setSmtpConfig(c => ({ ...c, smtpHost: e.target.value }))}
                      className={INPUT} placeholder="smtp.sendgrid.net" />
                  </div>
                  <div>
                    <label className={LABEL}>SMTP Port</label>
                    <input value={smtpConfig.smtpPort} onChange={e => setSmtpConfig(c => ({ ...c, smtpPort: e.target.value }))}
                      className={INPUT} placeholder="587" type="number" />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>SMTP Username</label>
                  <input value={smtpConfig.smtpUser} onChange={e => setSmtpConfig(c => ({ ...c, smtpUser: e.target.value }))}
                    className={INPUT} placeholder="apikey" autoComplete="off" />
                </div>
                <div>
                  <label className={LABEL}>SMTP Password</label>
                  <div className="flex gap-2">
                    <input
                      type={smtpPassVisible ? 'text' : 'password'}
                      value={smtpConfig.smtpPass}
                      onChange={e => setSmtpConfig(c => ({ ...c, smtpPass: e.target.value }))}
                      className={INPUT}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setSmtpPassVisible(v => !v)}
                      className="shrink-0 border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-lg text-xs transition">
                      {smtpPassVisible ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section: Feature Limits */}
          <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Feature Limits</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Optional caps enforced by the tenant portal. Leave blank for unlimited.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Max Employees</label>
                <input
                  type="number" min="1"
                  value={limits.maxEmployees}
                  onChange={e => setLimits(l => ({ ...l, maxEmployees: e.target.value }))}
                  className={INPUT}
                  placeholder="e.g. 500"
                />
              </div>
              <div>
                <label className={LABEL}>Max Storage (MB)</label>
                <input
                  type="number" min="1"
                  value={limits.maxStorageMb}
                  onChange={e => setLimits(l => ({ ...l, maxStorageMb: e.target.value }))}
                  className={INPUT}
                  placeholder="e.g. 5120"
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Allowed File Types</label>
              <input
                value={limits.allowedFileTypes}
                onChange={e => setLimits(l => ({ ...l, allowedFileTypes: e.target.value }))}
                className={INPUT}
                placeholder="pdf,docx,xlsx,png,jpg"
              />
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Comma-separated extensions without dots. Controls what employees can upload in documents and HR modules.</p>
            </div>
          </div>

          <button onClick={saveConfig} disabled={saving}
            className="w-full sm:w-auto bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition">
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function EditClientPage() {
  return (
    <Suspense fallback={<div className="text-gray-600 dark:text-gray-400 p-6">Loading…</div>}>
      <EditClientInner />
    </Suspense>
  )
}
