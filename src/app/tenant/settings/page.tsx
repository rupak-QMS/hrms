'use client'

import Image from 'next/image'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useRef, useState } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'

type Settings = {
  domain?: { customDomain?: string; subdomain?: string; wwwRedirect?: boolean; sslForced?: boolean }
  email?:  { smtpHost?: string; smtpPort?: number; smtpUser?: string; smtpPass?: string; fromName?: string; fromEmail?: string; replyTo?: string; useTLS?: boolean }
  notifications?: {
    // Employee lifecycle
    emailWelcome?: boolean; emailOnboarding?: boolean; emailRoleChange?: boolean
    // Compliance & documents
    emailCompliance?: boolean; emailDocExpiry?: boolean
    // Payroll
    emailPayroll?: boolean
    // HR processes
    emailGrievance?: boolean; emailSeparation?: boolean; emailWhs?: boolean
    // Development
    emailPerformance?: boolean; emailContracts?: boolean; emailTraining?: boolean
    // Culture
    emailRecruitment?: boolean; emailRecognition?: boolean
    // Integrations
    slackWebhook?: string
  }
}

const INPUT = 'input-premium'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

type Tab = 'branding' | 'domain' | 'email' | 'notifications' | 'integrations' | 'leave'

type LeaveTypeConfig = {
  key: string; label: string; emoji: string; color: string; accrualNote: string
  entitlementDaysFT: number; entitlementDaysPT: number; entitlementDaysCasual: number
  isActive: boolean; maxCarryForwardDays: number | null
}

type XeroStatus = {
  connected: boolean
  orgName?: string
  xeroTenantId?: string
  tokenExpired?: boolean
}

type MyobStatus = {
  connected: boolean
  companyFileName?: string
  companyFileUri?: string
  tokenExpired?: boolean
}

export default function TenantSettingsPage() {
  const [tab,          setTab]          = useState<Tab>('branding')
  const [settings,     setSettings]     = useState<Settings>({})
  const [portalName,   setPortalName]   = useState('')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#1a4fff')
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [error,        setError]        = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Leave types state
  const [leaveTypes,        setLeaveTypes]        = useState<LeaveTypeConfig[]>([])
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(false)
  const [leaveTypesSaving,  setLeaveTypesSaving]  = useState(false)
  const [leaveTypesSaved,   setLeaveTypesSaved]   = useState(false)
  const [leaveTypesError,   setLeaveTypesError]   = useState('')

  // Xero integration state
  const [xeroStatus,      setXeroStatus]      = useState<XeroStatus | null>(null)
  const [xeroLoading,     setXeroLoading]     = useState(false)
  const [xeroConnecting,  setXeroConnecting]  = useState(false)
  const [xeroDisconnecting, setXeroDisconnecting] = useState(false)
  const [xeroMsg,         setXeroMsg]         = useState('')

  // MYOB integration state
  const [myobStatus,      setMyobStatus]      = useState<MyobStatus | null>(null)
  const [myobLoading,     setMyobLoading]     = useState(false)
  const [myobConnecting,  setMyobConnecting]  = useState(false)
  const [myobDisconnecting, setMyobDisconnecting] = useState(false)
  const [myobMsg,         setMyobMsg]         = useState('')
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  useEffect(() => {
    fetchWithAuth('/api/tenant/config').then(r => r.json()).then(d => {
      const t = d.tenant ?? {}
      const s = t.settings ?? {}
      setPortalName(t.name ?? '')
      setLogoUrl(t.logoUrl ?? null)
      setPrimaryColor(t.primaryColor ?? '#1a4fff')
      setSettings(typeof s === 'string' ? JSON.parse(s) : s)
      setLoading(false)
    })
  }, [])

  // Load Xero + MYOB status + handle callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'integrations') setTab('integrations')
    if (params.get('xero_success')) setXeroMsg('Xero connected successfully!')
    if (params.get('xero_error'))   setXeroMsg(`Xero error: ${params.get('xero_error')}`)
    if (params.get('myob_success')) setMyobMsg('MYOB connected successfully!')
    if (params.get('myob_error'))   setMyobMsg(`MYOB error: ${params.get('myob_error')}`)

    setXeroLoading(true)
    fetchWithAuth('/api/tenant/xero/status')
      .then(r => r.json())
      .then(d => setXeroStatus(d))
      .finally(() => setXeroLoading(false))

    setMyobLoading(true)
    fetchWithAuth('/api/tenant/myob/status')
      .then(r => r.json())
      .then(d => setMyobStatus(d))
      .finally(() => setMyobLoading(false))
  }, [])

  async function connectXero() {
    setXeroConnecting(true); setXeroMsg('')
    try {
      const res = await fetchWithAuth('/api/tenant/xero/connect')
      const d   = await res.json()
      if (!res.ok) { setXeroMsg(d.error); setXeroConnecting(false); return }
      window.location.href = d.url   // redirect to Xero
    } catch { setXeroMsg('Failed to start Xero connection'); setXeroConnecting(false) }
  }

  async function disconnectXero() {
    setConfirmState({
      message: 'Disconnect Xero? Payroll records already exported will remain exported.',
      confirmLabel: 'Disconnect',
      onConfirm: async () => {
        setXeroDisconnecting(true); setXeroMsg('')
        await fetchWithAuth('/api/tenant/xero/status', { method: 'DELETE' })
        setXeroStatus({ connected: false })
        setXeroMsg('Xero disconnected.')
        setXeroDisconnecting(false)
      }
    })
  }

  async function connectMyob() {
    setMyobConnecting(true); setMyobMsg('')
    try {
      const res = await fetchWithAuth('/api/tenant/myob/connect')
      const d   = await res.json()
      if (!res.ok) { setMyobMsg(d.error); setMyobConnecting(false); return }
      window.location.href = d.url   // redirect to MYOB
    } catch { setMyobMsg('Failed to start MYOB connection'); setMyobConnecting(false) }
  }

  async function disconnectMyob() {
    setConfirmState({
      message: 'Disconnect MYOB? Payroll records already exported will remain exported.',
      confirmLabel: 'Disconnect',
      onConfirm: async () => {
        setMyobDisconnecting(true); setMyobMsg('')
        await fetchWithAuth('/api/tenant/myob/status', { method: 'DELETE' })
        setMyobStatus({ connected: false })
        setMyobMsg('MYOB disconnected.')
        setMyobDisconnecting(false)
      }
    })
  }

  function flash() { setSaved(true); setTimeout(() => setSaved(false), 3000) }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512 * 1024) { setError('Logo must be under 512 KB'); return }
    setError(''); setLogoUploading(true)
    const reader = new FileReader()
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string
      const res  = await fetchWithAuth('/api/tenant/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: dataUrl }),
      })
      const data = await res.json()
      if (res.ok) { setLogoUrl(data.logoUrl); flash() }
      else setError(data.error ?? 'Upload failed')
      setLogoUploading(false)
    }
    reader.readAsDataURL(file)
  }

  async function removeLogo() {
    await fetchWithAuth('/api/tenant/config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl: null }),
    })
    setLogoUrl(null); flash()
  }

  async function saveBranding() {
    setSaving(true); setError('')
    const res = await fetchWithAuth('/api/tenant/config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: portalName }),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? 'Save failed')
    else flash()
    setSaving(false)
  }

  async function save(patch: Partial<Settings>) {
    setSaving(true)
    const merged = { ...settings, ...patch }
    await fetchWithAuth('/api/tenant/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: patch }),
    })
    setSettings(merged)
    setSaving(false); flash()
  }

  const domain = settings.domain ?? {}
  const email  = settings.email  ?? {}
  const notif  = settings.notifications ?? {}

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portal Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Configure your branding, domain, email delivery, and notifications</p>
      </div>

      {saved && (
        <div className="bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-lg px-4 py-2.5 text-sm text-green-700 dark:text-green-300">
          Settings saved — changes take effect on next page load
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg px-4 py-2.5 text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {/* Tab nav */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {([
          { id: 'branding',      label: 'Branding' },
          { id: 'domain',        label: 'Domain' },
          { id: 'email',         label: 'Email' },
          { id: 'notifications', label: 'Notifications' },
          { id: 'leave',         label: 'Leave' },
          { id: 'integrations',  label: 'Integrations' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === t.id ? 'border-[#0E3D52] text-[#0E3D52] dark:text-[#4ebac4]' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-600 dark:text-gray-400 text-sm">Loading…</p> : (
        <>

          {/* ── BRANDING TAB ── */}
          {tab === 'branding' && (
            <div className="space-y-6">

              {/* Logo */}
              <div className="card-premium p-6 space-y-5">
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Organisation Logo</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Shown in the sidebar header. PNG, JPG, SVG or WebP · max 512 KB · Recommended: transparent background, min 200px wide.</p>
                </div>

                <div className="flex items-start gap-5">
                  {/* Preview box */}
                  <div className="w-28 h-28 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                    {logoUrl ? (
                      <Image src={logoUrl} alt="Logo" width={200} height={80} className="max-h-full max-w-full object-contain p-2" unoptimized />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                        style={{ background: primaryColor }}
                      >
                        {portalName[0]?.toUpperCase() ?? 'H'}
                      </div>
                    )}
                  </div>

                  {/* Upload controls */}
                  <div className="flex-1 space-y-2">
                    <input ref={fileRef} type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden" onChange={handleLogoFile} />
                    <button
                      onClick={() => { setError(''); fileRef.current?.click() }}
                      disabled={logoUploading}
                      className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-700 disabled:opacity-60 text-gray-900 dark:text-white text-sm px-4 py-2.5 rounded-lg transition"
                    >
                      {logoUploading ? '⏳ Uploading…' : 'Upload Logo'}
                    </button>
                    {logoUrl && (
                      <button onClick={removeLogo}
                        className="w-full border border-red-800 text-red-400 hover:bg-red-900/30 text-sm px-4 py-2.5 rounded-lg transition">
                        Remove Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Portal name */}
              <div className="card-premium p-6 space-y-4">
                <div>
                  <label className={LABEL}>Portal Display Name</label>
                  <input value={portalName}
                    onChange={e => setPortalName(e.target.value)}
                    placeholder="e.g. Yahweh Care" className={INPUT} />
                  <p className="text-xs text-gray-500 mt-1.5 dark:text-gray-400">
                    This name appears in the sidebar, login page, browser tab, and email notifications.
                    It replaces &quot;HRMS&quot; everywhere in your portal.
                  </p>
                </div>

                {/* Live sidebar preview */}
                <div className="rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700">
                  <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">Sidebar preview</div>
                  <div className="bg-white dark:bg-gray-900 p-4">
                    <div className="w-56 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-white/10" style={{ background: '#111827' }}>
                        {logoUrl ? (
                          <Image src={logoUrl} alt="Logo" width={120} height={32} className="h-8 object-contain" unoptimized />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                              style={{ background: primaryColor }}>
                              {portalName[0]?.toUpperCase() ?? 'H'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white leading-tight">{portalName || 'Your Organisation'}</p>
                              <p className="text-xs text-white/50">HR Management</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2 space-y-1">
                        {['Dashboard', 'Employees', 'Compliance'].map((item, i) => (
                          <div key={item} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs text-white ${i === 0 ? 'opacity-100' : 'opacity-50'}`}
                            style={i === 0 ? { background: primaryColor } : {}}>
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={saveBranding} disabled={saving}
                  className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2.5 rounded-lg">
                  {saving ? 'Saving…' : 'Save Display Name'}
                </button>
              </div>
            </div>
          )}

          {/* ── DOMAIN TAB ── */}
          {tab === 'domain' && (
            <div className="card-premium p-6 space-y-5">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
                <strong>DNS Configuration:</strong> Point your custom domain CNAME to{' '}
                <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">cname.vercel-dns.com</code>, then enter it below.
                Vercel will automatically provision an SSL certificate.
              </div>

              <div>
                <label className={LABEL}>Custom Domain</label>
                <input value={domain.customDomain ?? ''} placeholder="hr.yourcompany.com.au"
                  onChange={e => setSettings(s => ({ ...s, domain: { ...s.domain, customDomain: e.target.value } }))}
                  className={INPUT} />
                <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">Leave blank to use your default subdomain.</p>
              </div>

              <div>
                <label className={LABEL}>Subdomain</label>
                <div className="flex items-center gap-2">
                  <input value={domain.subdomain ?? ''} placeholder="yahweh-care"
                    onChange={e => setSettings(s => ({ ...s, domain: { ...s.domain, subdomain: e.target.value } }))}
                    className={`${INPUT} flex-1`} />
                  <span className="text-gray-500 text-sm shrink-0 dark:text-gray-400">.yourhrms.com.au</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={domain.wwwRedirect ?? true}
                    onChange={e => setSettings(s => ({ ...s, domain: { ...s.domain, wwwRedirect: e.target.checked } }))}
                    className="accent-[#0E3D52] w-4 h-4" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Redirect www → root domain</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">www.yourdomain.com → yourdomain.com</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={domain.sslForced ?? true}
                    onChange={e => setSettings(s => ({ ...s, domain: { ...s.domain, sslForced: e.target.checked } }))}
                    className="accent-[#0E3D52] w-4 h-4" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Force HTTPS</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Redirect HTTP requests to HTTPS</p>
                  </div>
                </label>
              </div>

              <button onClick={() => save({ domain: settings.domain })} disabled={saving}
                className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2.5 rounded-lg">
                {saving ? 'Saving…' : 'Save Domain Settings'}
              </button>
            </div>
          )}

          {/* ── EMAIL TAB ── */}
          {tab === 'email' && (
            <div className="card-premium p-6 space-y-5">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
                Configure your own SMTP server to send system emails (onboarding, compliance alerts, etc.) from your own domain.
                Leave blank to use the platform default sender.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>From Name</label>
                  <input value={email.fromName ?? ''} placeholder="Yahweh Care HR"
                    onChange={e => setSettings(s => ({ ...s, email: { ...s.email, fromName: e.target.value } }))}
                    className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>From Email</label>
                  <input type="email" value={email.fromEmail ?? ''} placeholder="hr@yahwehcare.com.au"
                    onChange={e => setSettings(s => ({ ...s, email: { ...s.email, fromEmail: e.target.value } }))}
                    className={INPUT} />
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Reply-To Email</label>
                  <input type="email" value={email.replyTo ?? ''} placeholder="noreply@yahwehcare.com.au"
                    onChange={e => setSettings(s => ({ ...s, email: { ...s.email, replyTo: e.target.value } }))}
                    className={INPUT} />
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">SMTP Server</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>SMTP Host</label>
                    <input value={email.smtpHost ?? ''} placeholder="smtp.gmail.com"
                      onChange={e => setSettings(s => ({ ...s, email: { ...s.email, smtpHost: e.target.value } }))}
                      className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>Port</label>
                    <input type="number" value={email.smtpPort ?? 587} placeholder="587"
                      onChange={e => setSettings(s => ({ ...s, email: { ...s.email, smtpPort: Number(e.target.value) } }))}
                      className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>SMTP Username</label>
                    <input value={email.smtpUser ?? ''} placeholder="you@yourcompany.com"
                      onChange={e => setSettings(s => ({ ...s, email: { ...s.email, smtpUser: e.target.value } }))}
                      className={INPUT} />
                  </div>
                  <div>
                    <label className={LABEL}>SMTP Password</label>
                    <input type="password" value={email.smtpPass ?? ''} placeholder="••••••••"
                      onChange={e => setSettings(s => ({ ...s, email: { ...s.email, smtpPass: e.target.value } }))}
                      className={INPUT} />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-3">
                  <input type="checkbox" checked={email.useTLS ?? true}
                    onChange={e => setSettings(s => ({ ...s, email: { ...s.email, useTLS: e.target.checked } }))}
                    className="accent-[#0E3D52] w-4 h-4" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">Use TLS / STARTTLS</span>
                </label>
              </div>

              <button onClick={() => save({ email: settings.email })} disabled={saving}
                className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2.5 rounded-lg">
                {saving ? 'Saving…' : 'Save Email Settings'}
              </button>
            </div>
          )}

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === 'notifications' && (
            <div className="card-premium p-6 space-y-6">

              {/* Employee Lifecycle */}
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">Employee Lifecycle</p>
                <div className="space-y-3">
                  {[
                    { key: 'emailWelcome',    label: 'User invitation welcome',    desc: 'Send login credentials when a new portal user is invited' },
                    { key: 'emailOnboarding', label: 'New employee onboarding',    desc: 'Send onboarding welcome + checklist when employee is set up' },
                    { key: 'emailRoleChange', label: 'Account status changes',     desc: 'Notify user when their account is suspended or reactivated' },
                  ].map(n => (
                    <label key={n.key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" className="accent-[#0E3D52] w-4 h-4 mt-0.5"
                        checked={(notif as any)[n.key] ?? true}
                        onChange={e => setSettings(s => ({ ...s, notifications: { ...s.notifications, [n.key]: e.target.checked } }))} />
                      <div><p className="text-sm text-gray-600 dark:text-gray-300">{n.label}</p><p className="text-xs text-gray-500 dark:text-gray-400">{n.desc}</p></div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Compliance & Documents */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">Compliance & Documents</p>
                <div className="space-y-3">
                  {[
                    { key: 'emailDocExpiry',  label: 'Document expiry alerts (to employee)', desc: 'Notify employee when their compliance document is expiring or has expired' },
                    { key: 'emailCompliance', label: 'Compliance alerts (to managers)',       desc: 'Alert compliance managers & HR officers about expiring documents' },
                  ].map(n => (
                    <label key={n.key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" className="accent-[#0E3D52] w-4 h-4 mt-0.5"
                        checked={(notif as any)[n.key] ?? true}
                        onChange={e => setSettings(s => ({ ...s, notifications: { ...s.notifications, [n.key]: e.target.checked } }))} />
                      <div><p className="text-sm text-gray-600 dark:text-gray-300">{n.label}</p><p className="text-xs text-gray-500 dark:text-gray-400">{n.desc}</p></div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Payroll & Contracts */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">Payroll & Contracts</p>
                <div className="space-y-3">
                  {[
                    { key: 'emailPayroll',   label: 'Payslip notifications',   desc: 'Email employee when their pay run is marked as paid' },
                    { key: 'emailContracts', label: 'Contract notifications',   desc: 'Notify employee when contract is sent; notify HR when signed' },
                  ].map(n => (
                    <label key={n.key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" className="accent-[#0E3D52] w-4 h-4 mt-0.5"
                        checked={(notif as any)[n.key] ?? true}
                        onChange={e => setSettings(s => ({ ...s, notifications: { ...s.notifications, [n.key]: e.target.checked } }))} />
                      <div><p className="text-sm text-gray-600 dark:text-gray-300">{n.label}</p><p className="text-xs text-gray-500 dark:text-gray-400">{n.desc}</p></div>
                    </label>
                  ))}
                </div>
              </div>

              {/* HR Processes */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">HR Processes</p>
                <div className="space-y-3">
                  {[
                    { key: 'emailGrievance',  label: 'Grievance alerts',           desc: 'Confirm to lodger; alert HR when a grievance is submitted or resolved' },
                    { key: 'emailWhs',        label: 'WHS incident alerts',         desc: 'Alert managers immediately when a WHS incident is reported' },
                    { key: 'emailSeparation', label: 'Exit process notifications',  desc: 'Notify employee when their exit process is initiated' },
                  ].map(n => (
                    <label key={n.key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" className="accent-[#0E3D52] w-4 h-4 mt-0.5"
                        checked={(notif as any)[n.key] ?? true}
                        onChange={e => setSettings(s => ({ ...s, notifications: { ...s.notifications, [n.key]: e.target.checked } }))} />
                      <div><p className="text-sm text-gray-600 dark:text-gray-300">{n.label}</p><p className="text-xs text-gray-500 dark:text-gray-400">{n.desc}</p></div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Development */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">Development & Training</p>
                <div className="space-y-3">
                  {[
                    { key: 'emailPerformance', label: 'Performance review notifications', desc: 'Notify employee when review is scheduled or completed' },
                    { key: 'emailTraining',    label: 'Training notifications',           desc: 'Notify employee when training is assigned or completed' },
                  ].map(n => (
                    <label key={n.key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" className="accent-[#0E3D52] w-4 h-4 mt-0.5"
                        checked={(notif as any)[n.key] ?? true}
                        onChange={e => setSettings(s => ({ ...s, notifications: { ...s.notifications, [n.key]: e.target.checked } }))} />
                      <div><p className="text-sm text-gray-600 dark:text-gray-300">{n.label}</p><p className="text-xs text-gray-500 dark:text-gray-400">{n.desc}</p></div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Culture */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">Culture & Recruitment</p>
                <div className="space-y-3">
                  {[
                    { key: 'emailRecognition', label: 'Recognition awards',       desc: 'Notify employee when they receive a recognition award' },
                    { key: 'emailRecruitment', label: 'Recruitment stage updates', desc: 'Notify candidates when their application status changes' },
                  ].map(n => (
                    <label key={n.key} className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" className="accent-[#0E3D52] w-4 h-4 mt-0.5"
                        checked={(notif as any)[n.key] ?? true}
                        onChange={e => setSettings(s => ({ ...s, notifications: { ...s.notifications, [n.key]: e.target.checked } }))} />
                      <div><p className="text-sm text-gray-600 dark:text-gray-300">{n.label}</p><p className="text-xs text-gray-500 dark:text-gray-400">{n.desc}</p></div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Slack */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3">Slack Integration</p>
                <label className={LABEL}>Incoming Webhook URL</label>
                <input value={notif.slackWebhook ?? ''} placeholder="https://hooks.slack.com/services/..."
                  onChange={e => setSettings(s => ({ ...s, notifications: { ...s.notifications, slackWebhook: e.target.value } }))}
                  className={INPUT} />
                <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">
                  Create an Incoming Webhook in your Slack workspace to receive HR alerts in a dedicated channel.
                </p>
              </div>

              <button onClick={() => save({ notifications: settings.notifications })} disabled={saving}
                className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2.5 rounded-lg">
                {saving ? 'Saving…' : 'Save Notification Settings'}
              </button>
            </div>
          )}

          {/* ── LEAVE TAB ── */}
          {tab === 'leave' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Configure entitlements and rules for each leave type. Changes apply to all future balance calculations.
                </p>
                <button
                  onClick={async () => {
                    if (leaveTypesLoading || leaveTypes.length) return
                    setLeaveTypesLoading(true)
                    const res = await fetchWithAuth('/api/tenant/leave/types?all=1')
                    const d   = await res.json()
                    setLeaveTypes(d.types ?? [])
                    setLeaveTypesLoading(false)
                  }}
                  className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] transition"
                  style={{ display: leaveTypes.length ? 'none' : undefined }}
                >
                  Load
                </button>
              </div>

              {/* Auto-load on tab open */}
              {tab === 'leave' && leaveTypes.length === 0 && !leaveTypesLoading && (() => {
                fetchWithAuth('/api/tenant/leave/types?all=1')
                  .then(r => r.json())
                  .then(d => setLeaveTypes(d.types ?? []))
                return null
              })()}

              {leaveTypesError && (
                <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg px-4 py-2.5 text-sm text-red-700 dark:text-red-300">{leaveTypesError}</div>
              )}
              {leaveTypesSaved && (
                <div className="bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-lg px-4 py-2.5 text-sm text-green-700 dark:text-green-300">✓ Leave configuration saved</div>
              )}

              {leaveTypesLoading ? (
                <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
              ) : leaveTypes.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">No leave types found.</p>
              ) : (
                <div className="space-y-3">
                  {leaveTypes.map((lt, idx) => (
                    <div key={lt.key} className="card-premium p-5 space-y-4">
                      {/* Header row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{lt.emoji}</span>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{lt.label}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{lt.accrualNote}</p>
                          </div>
                        </div>
                        {/* Active toggle */}
                        <button
                          onClick={() => setLeaveTypes(prev => prev.map((t, i) => i === idx ? { ...t, isActive: !t.isActive } : t))}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${lt.isActive ? 'bg-[#0E3D52]' : 'bg-gray-300 dark:bg-gray-700'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${lt.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {lt.isActive && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-gray-200 dark:border-gray-800">
                          <div>
                            <label className={LABEL}>Full-Time (days/yr)</label>
                            <input
                              type="number" min="0" max="365"
                              value={lt.entitlementDaysFT}
                              onChange={e => setLeaveTypes(prev => prev.map((t, i) => i === idx ? { ...t, entitlementDaysFT: Number(e.target.value) } : t))}
                              className={INPUT}
                            />
                          </div>
                          <div>
                            <label className={LABEL}>Part-Time (days/yr)</label>
                            <input
                              type="number" min="0" max="365"
                              value={lt.entitlementDaysPT}
                              onChange={e => setLeaveTypes(prev => prev.map((t, i) => i === idx ? { ...t, entitlementDaysPT: Number(e.target.value) } : t))}
                              className={INPUT}
                            />
                          </div>
                          <div>
                            <label className={LABEL}>Casual (days/yr)</label>
                            <input
                              type="number" min="0" max="365"
                              value={lt.entitlementDaysCasual}
                              onChange={e => setLeaveTypes(prev => prev.map((t, i) => i === idx ? { ...t, entitlementDaysCasual: Number(e.target.value) } : t))}
                              className={INPUT}
                            />
                          </div>
                          <div>
                            <label className={LABEL}>Max Carry-Forward</label>
                            <input
                              type="number" min="0" max="365"
                              placeholder="∞ (blank = unlimited)"
                              value={lt.maxCarryForwardDays ?? ''}
                              onChange={e => setLeaveTypes(prev => prev.map((t, i) => i === idx ? {
                                ...t, maxCarryForwardDays: e.target.value === '' ? null : Number(e.target.value)
                              } : t))}
                              className={INPUT}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex justify-end pt-2">
                    <button
                      disabled={leaveTypesSaving}
                      onClick={async () => {
                        setLeaveTypesSaving(true); setLeaveTypesError(''); setLeaveTypesSaved(false)
                        try {
                          const res = await fetchWithAuth('/api/tenant/leave/types', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ types: leaveTypes }),
                          })
                          if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
                          setLeaveTypesSaved(true)
                          setTimeout(() => setLeaveTypesSaved(false), 3000)
                        } catch (err) {
                          setLeaveTypesError(err instanceof Error ? err.message : 'Save failed')
                        } finally {
                          setLeaveTypesSaving(false)
                        }
                      }}
                      className="px-6 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
                    >
                      {leaveTypesSaving ? 'Saving…' : 'Save Leave Settings'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── INTEGRATIONS TAB ── */}
          {tab === 'integrations' && (
            <div className="space-y-6">

              {xeroMsg && (
                <div className={`rounded-lg px-4 py-2.5 text-sm border ${xeroMsg.startsWith('') ? 'bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'}`}>
                  {xeroMsg}
                </div>
              )}

              {/* Xero */}
              <div className="card-premium p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Xero logo (blue X) */}
                    <div className="w-10 h-10 rounded-xl bg-[#13B5EA] flex items-center justify-center text-white font-black text-lg shrink-0">X</div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Xero Accounting</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Export payroll runs as manual journal entries to your Xero ledger</p>
                    </div>
                  </div>
                  {xeroLoading ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Checking…</span>
                  ) : xeroStatus?.connected ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300">
                      {xeroStatus.tokenExpired ? 'Token expired' : '● Connected'}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400">Not connected</span>
                  )}
                </div>

                {xeroStatus?.connected && (
                  <div className="bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Organisation</span>
                      <span className="text-foreground font-medium">{xeroStatus.orgName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Xero Tenant ID</span>
                      <span className="text-gray-600 dark:text-gray-300 font-mono text-xs">{xeroStatus.xeroTenantId}</span>
                    </div>
                  </div>
                )}

                {xeroStatus?.tokenExpired && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    Your Xero access token has expired. Reconnect to restore the integration.
                  </div>
                )}

                <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                  <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">
                    When you export a pay run to Xero, a Manual Journal is created with these account codes:
                    <br />
                    <span className="font-mono">493</span> Wages &amp; Salaries (DR) ·
                    <span className="font-mono"> 825</span> PAYG Withholding (CR) ·
                    <span className="font-mono"> 826</span> Superannuation Payable (CR) ·
                    <span className="font-mono"> 800</span> Net Wages Payable (CR)
                    <br />
                    You can remap these in Xero's chart of accounts.
                  </p>

                  <div className="flex gap-3">
                    {xeroStatus?.connected ? (
                      <>
                        <button onClick={connectXero} disabled={xeroConnecting}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-[#13B5EA] text-[#13B5EA] hover:bg-[#13B5EA]/10 transition disabled:opacity-60">
                          {xeroConnecting ? 'Redirecting…' : 'Reconnect Xero'}
                        </button>
                        <button onClick={disconnectXero} disabled={xeroDisconnecting}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-red-800 text-red-400 hover:bg-red-900/20 transition disabled:opacity-60">
                          {xeroDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </>
                    ) : (
                      <button onClick={connectXero} disabled={xeroConnecting}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#13B5EA] hover:bg-[#0da3d8] transition disabled:opacity-60">
                        {xeroConnecting ? 'Redirecting to Xero…' : 'Connect Xero'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* MYOB */}
              {myobMsg && (
                <div className={`rounded-lg px-4 py-2.5 text-sm border ${myobMsg.startsWith('') ? 'bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'}`}>
                  {myobMsg}
                </div>
              )}

              <div className="card-premium p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* MYOB logo (purple M) */}
                    <div className="w-10 h-10 rounded-xl bg-[#7B2D8B] flex items-center justify-center text-white font-black text-lg shrink-0">M</div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">MYOB AccountRight</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Export payroll runs as General Journal Transactions to your MYOB ledger</p>
                    </div>
                  </div>
                  {myobLoading ? (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Checking…</span>
                  ) : myobStatus?.connected ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300">
                      {myobStatus.tokenExpired ? 'Token expired' : '● Connected'}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400">Not connected</span>
                  )}
                </div>

                {myobStatus?.connected && (
                  <div className="bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Company File</span>
                      <span className="text-foreground font-medium">{myobStatus.companyFileName}</span>
                    </div>
                  </div>
                )}

                {myobStatus?.tokenExpired && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    Your MYOB access token has expired. Reconnect to restore the integration.
                  </div>
                )}

                <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                  <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">
                    When you export a pay run to MYOB, a General Journal Transaction is created with these account codes:
                    <br />
                    <span className="font-mono">6-1000</span> Wages &amp; Salaries (DR) ·
                    <span className="font-mono"> 2-1410</span> PAYG Withholding (CR) ·
                    <span className="font-mono"> 2-1420</span> Superannuation Payable (CR) ·
                    <span className="font-mono"> 2-1400</span> Net Wages Payable (CR)
                    <br />
                    You can remap these in MYOB's chart of accounts.
                  </p>

                  <div className="flex gap-3">
                    {myobStatus?.connected ? (
                      <>
                        <button onClick={connectMyob} disabled={myobConnecting}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-[#7B2D8B] text-[#c084e8] hover:bg-[#7B2D8B]/10 transition disabled:opacity-60">
                          {myobConnecting ? 'Redirecting…' : 'Reconnect MYOB'}
                        </button>
                        <button onClick={disconnectMyob} disabled={myobDisconnecting}
                          className="px-4 py-2 rounded-lg text-sm font-medium border border-red-800 text-red-400 hover:bg-red-900/20 transition disabled:opacity-60">
                          {myobDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </>
                    ) : (
                      <button onClick={connectMyob} disabled={myobConnecting}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#7B2D8B] hover:bg-[#6a2578] transition disabled:opacity-60">
                        {myobConnecting ? 'Redirecting to MYOB…' : 'Connect MYOB'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Future integrations placeholder */}
              <div className="card-premium border-dashed p-6 text-center">
                <p className="text-gray-500 text-sm dark:text-gray-400">More integrations coming soon — ADP, Workday, myGov</p>
              </div>
            </div>
          )}
        </>
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
