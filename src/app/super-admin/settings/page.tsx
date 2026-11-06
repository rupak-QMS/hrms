'use client'

import { useState, useEffect } from 'react'

type Section = 'general' | 'email' | 'security' | 'maintenance'

export default function PlatformSettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('general')
  const [saved, setSaved]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // General
  const [platformName,      setPlatformName]      = useState('HRMS')
  const [supportEmail,      setSupportEmail]      = useState('support@yahwehhrms.com')
  const [defaultTier,       setDefaultTier]       = useState('starter')
  const [maxUsersPerTenant, setMaxUsersPerTenant] = useState('500')

  // Email / SMTP
  const [smtpHost,  setSmtpHost]  = useState('smtp-relay.brevo.com')
  const [smtpPort,  setSmtpPort]  = useState('587')
  const [smtpUser,  setSmtpUser]  = useState('')
  const [smtpPass,  setSmtpPass]  = useState('')
  const [fromEmail, setFromEmail] = useState('noreply@yahwehhrms.com')
  const [fromName,  setFromName]  = useState('HRMS Platform')

  // Security
  const [sessionHours,    setSessionHours]    = useState('8')
  const [require2FA,      setRequire2FA]      = useState(false)
  const [auditRetainDays, setAuditRetainDays] = useState('365')

  // Maintenance
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMsg,  setMaintenanceMsg]  = useState('The platform is undergoing scheduled maintenance. We will be back shortly.')

  // Load settings on mount
  useEffect(() => {
    fetch('/api/super-admin/settings')
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(({ settings: s }) => {
        if (!s) return
        setPlatformName(s.platformName      ?? 'HRMS')
        setSupportEmail(s.supportEmail      ?? 'support@yahwehhrms.com')
        setDefaultTier(s.defaultTier        ?? 'starter')
        setMaxUsersPerTenant(String(s.maxUsersPerTenant ?? 500))
        setSmtpHost(s.smtpHost             ?? 'smtp-relay.brevo.com')
        setSmtpPort(String(s.smtpPort      ?? 587))
        setSmtpUser(s.smtpUser             ?? '')
        setSmtpPass(s.smtpPass             ?? '')
        setFromEmail(s.fromEmail           ?? 'noreply@yahwehhrms.com')
        setFromName(s.fromName             ?? 'HRMS Platform')
        setSessionHours(String(s.sessionHours ?? 8))
        setRequire2FA(!!s.require2FA)
        setAuditRetainDays(String(s.auditRetainDays ?? 365))
        setMaintenanceMode(!!s.maintenanceMode)
        setMaintenanceMsg(s.maintenanceMsg  ?? 'The platform is undergoing scheduled maintenance. We will be back shortly.')
      })
      .catch(err => setLoadError(err.message))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/super-admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformName,
          supportEmail,
          defaultTier,
          maxUsersPerTenant: parseInt(maxUsersPerTenant, 10) || 500,
          smtpHost,
          smtpPort: parseInt(smtpPort, 10) || 587,
          smtpUser,
          smtpPass,
          fromEmail,
          fromName,
          sessionHours: parseInt(sessionHours, 10) || 8,
          require2FA,
          auditRetainDays: parseInt(auditRetainDays, 10) || 365,
          maintenanceMode,
          maintenanceMsg,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('Save failed — ' + (err instanceof Error ? err.message : 'unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const SECTIONS: { key: Section; label: string; icon: string }[] = [
    { key: 'general',     label: 'General',     icon: '️' },
    { key: 'email',       label: 'Email / SMTP', icon: '️' },
    { key: 'security',    label: 'Security',     icon: '' },
    { key: 'maintenance', label: 'Maintenance',  icon: '' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Global configuration for the HRMS platform</p>
      </div>

      {loadError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          Could not load saved settings ({loadError}) — showing defaults.
        </div>
      )}

      {saved && (
        <div className="bg-green-50 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
          Settings saved successfully.
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-48 shrink-0 space-y-1">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition ${
                activeSection === s.key
                  ? 'bg-[#E0EEF4] dark:bg-[#E0EEF4] dark:bg-[#0E3D52]/50 text-gray-900 dark:text-white border border-[#b8d4e0] dark:border-[#1A6080]'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:bg-gray-800 hover:text-gray-900 dark:text-white'
              }`}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6">

          {activeSection === 'general' && (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-3">General Settings</h2>
              <Field label="Platform Name" hint="Displayed in the browser tab and emails">
                <Input value={platformName} onChange={setPlatformName} />
              </Field>
              <Field label="Support Email" hint="Shown in footer and error pages">
                <Input type="email" value={supportEmail} onChange={setSupportEmail} />
              </Field>
              <Field label="Default Subscription Tier" hint="Applied when creating a new client">
                <select
                  value={defaultTier}
                  onChange={e => setDefaultTier(e.target.value)}
                  className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52] w-full"
                >
                  <option value="starter">Starter (11 modules)</option>
                  <option value="professional">Professional (20 modules)</option>
                  <option value="enterprise">Enterprise (28 modules)</option>
                </select>
              </Field>
              <Field label="Max Users Per Tenant" hint="Hard limit per tenant across all roles">
                <Input type="number" value={maxUsersPerTenant} onChange={setMaxUsersPerTenant} />
              </Field>

              {/* Platform info (read-only) */}
              <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400  mb-3">Platform Info</h3>
                <InfoRow label="Version"         value="v1.0.0" />
                <InfoRow label="Framework"       value="Next.js 15 + .NET 8" />
                <InfoRow label="Database"        value="PostgreSQL (Neon Serverless)" />
                <InfoRow label="Infrastructure"  value="Azure App Service + Blob Storage" />
                <InfoRow label="Auth"            value="JWT / bcrypt (custom)" />
                <InfoRow label="Email Provider"  value="Brevo SMTP (300/day free)" />
              </div>
            </>
          )}

          {activeSection === 'email' && (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-3">Email / SMTP Configuration</h2>
              <div className="bg-[#E0EEF4] dark:bg-[#E0EEF4] dark:bg-[#0E3D52]/15 border border-[#1A6080]/30 dark:border-[#1A6080]/60 rounded-lg p-3 text-xs text-[#0E3D52] dark:text-[#4ebac4]">
                Brevo SMTP provides 300 emails/day (9,000/month) on the free tier — covering all HRMS notifications, reminders, and alerts.
              </div>
              <Field label="SMTP Host">
                <Input value={smtpHost} onChange={setSmtpHost} placeholder="smtp-relay.brevo.com" />
              </Field>
              <Field label="SMTP Port">
                <Input value={smtpPort} onChange={setSmtpPort} placeholder="587" />
              </Field>
              <Field label="SMTP Username">
                <Input value={smtpUser} onChange={setSmtpUser} placeholder="your@email.com" />
              </Field>
              <Field label="SMTP Password / API Key">
                <Input type="password" value={smtpPass} onChange={setSmtpPass} placeholder="••••••••••••" />
              </Field>
              <Field label="From Email Address">
                <Input type="email" value={fromEmail} onChange={setFromEmail} />
              </Field>
              <Field label="From Display Name">
                <Input value={fromName} onChange={setFromName} />
              </Field>
              <div className="pt-2">
                <button
                  className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-gray-500 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white px-4 py-2 rounded-lg transition"
                  onClick={() => alert('Test email sent (not wired in this UI demo)')}
                >
                  Send Test Email
                </button>
              </div>
            </>
          )}

          {activeSection === 'security' && (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-3">Security Settings</h2>
              <Field label="Session Duration (hours)" hint="JWT expiry. Users re-authenticate after this period.">
                <Input type="number" value={sessionHours} onChange={setSessionHours} />
              </Field>
              <Field label="Audit Log Retention (days)" hint="Audit records older than this are archived">
                <Input type="number" value={auditRetainDays} onChange={setAuditRetainDays} />
              </Field>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Require 2FA for All Users</p>
                  <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">Enforce TOTP authentication platform-wide (Google Authenticator)</p>
                </div>
                <Toggle value={require2FA} onChange={setRequire2FA} />
              </div>
            </>
          )}

          {activeSection === 'maintenance' && (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-3">Maintenance Mode</h2>
              {maintenanceMode && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                  ️ Maintenance mode is ON. All tenant users see the maintenance message below. Super admins can still log in.
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Enable Maintenance Mode</p>
                  <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">Blocks all tenant access while allowing super admin login</p>
                </div>
                <Toggle value={maintenanceMode} onChange={setMaintenanceMode} />
              </div>
              <Field label="Maintenance Message" hint="Shown to users when maintenance mode is active">
                <textarea
                  value={maintenanceMsg}
                  onChange={e => setMaintenanceMsg(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52] resize-none"
                />
              </Field>
            </>
          )}

          <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            <button
              onClick={() => setActiveSection(activeSection)}
              className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white text-sm px-4 py-2.5 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helper components ──────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-1.5 dark:text-gray-400">{hint}</p>}
      {children}
    </div>
  )
}

function Input({
  value, onChange, type = 'text', placeholder,
}: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]"
    />
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${value ? 'bg-[#0E3D52]' : 'bg-gray-200 dark:bg-gray-700'}`}
    >
      <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform  dark:bg-gray-900${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-gray-700 dark:text-gray-200 font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{value}</span>
    </div>
  )
}
