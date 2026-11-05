'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback, useRef } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { SkeletonPage } from '@/components/ui/Skeleton'

type Profile = {
  id:             string
  employeeNumber: string
  firstName:      string
  lastName:       string
  preferredName:  string | null
  email:          string
  phone:          string | null
  address:        string | null
  dateOfBirth:    string | null
  gender:         string | null
  photoUrl:       string | null
  entityName:     string | null
  employmentType: string
  startDate:      string
  isActive:       boolean
}

type EmergencyContact = {
  id:           string
  name:         string
  relationship: string | null
  phone:        string | null
  email:        string | null
  isPrimary:    boolean
}

const INPUT = 'input-premium'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
const ROW   = 'flex justify-between items-center py-2.5 border-b border-gray-200 dark:border-gray-800 last:border-0'

// ── 2FA Section ───────────────────────────────────────────────────────────────
type TotpStep = 'idle' | 'setup' | 'disable'

function TwoFactorSection() {
  const [enabled,      setEnabled]      = useState<boolean | null>(null)
  const [step,         setStep]         = useState<TotpStep>('idle')
  const [qrCode,       setQrCode]       = useState('')
  const [secret,       setSecret]       = useState('')
  const [code,         setCode]         = useState('')
  const [toast2fa,     setToast2fa]     = useState<ToastState>(null)
  const [busy,         setBusy]         = useState(false)

  const refreshStatus = useCallback(() => {
    fetch('/api/auth/totp/status')
      .then(r => r.json())
      .then(d => setEnabled(d.totpEnabled ?? false))
  }, [])

  useEffect(() => { refreshStatus() }, [refreshStatus])

  async function startSetup() {
    setBusy(true); setToast2fa(null)
    const res  = await fetch('/api/auth/totp/setup')
    const data = await res.json()
    if (!res.ok) { setToast2fa({ message: data.error ?? 'Failed to generate QR code', type: 'error' }); setBusy(false); return }
    setQrCode(data.qrCodeDataUrl)
    setSecret(data.secret)
    setCode('')
    setStep('setup')
    setBusy(false)
  }

  async function verifySetup() {
    if (!code.trim()) { setToast2fa({ message: 'Enter the 6-digit code from your authenticator app.', type: 'error' }); return }
    setBusy(true); setToast2fa(null)
    const res  = await fetch('/api/auth/totp/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, code: code.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setToast2fa({ message: data.error ?? 'Verification failed', type: 'error' }); setBusy(false); return }
    setToast2fa({ message: '2FA enabled successfully.', type: 'success' })
    setStep('idle'); setEnabled(true); setCode(''); setQrCode(''); setSecret('')
    setBusy(false)
  }

  async function disableTotp() {
    if (!code.trim()) { setToast2fa({ message: 'Enter your current 6-digit code to confirm.', type: 'error' }); return }
    setBusy(true); setToast2fa(null)
    const res  = await fetch('/api/auth/totp/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim() }),
    })
    const data = await res.json()
    if (!res.ok) { setToast2fa({ message: data.error ?? 'Disable failed', type: 'error' }); setBusy(false); return }
    setToast2fa({ message: '2FA has been disabled.', type: 'success' })
    setStep('idle'); setEnabled(false); setCode('')
    setBusy(false)
  }

  function cancelStep() { setStep('idle'); setCode(''); setToast2fa(null); setQrCode(''); setSecret('') }

  if (enabled === null) return null  // still loading

  return (
    <div className="card-premium rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Two-Factor Authentication</h2>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${enabled ? 'badge badge-green' : 'badge badge-gray'}`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {step === 'idle' && (
        <>
          <p className="text-sm text-gray-500 mb-4 dark:text-gray-400">
            {enabled
              ? 'Your account is protected with an authenticator app (Google Authenticator, Authy, etc.).'
              : 'Add an extra layer of security. You\'ll need an authenticator app (Google Authenticator, Authy, etc.).'}
          </p>
          <button
            onClick={enabled ? () => { setStep('disable'); setCode(''); setToast2fa(null) } : startSetup}
            disabled={busy}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
              enabled
                ? 'border border-red-700 text-red-400 hover:bg-red-900/20'
                : 'bg-[#0E3D52] hover:bg-[#1A6080] text-white'
            }`}
          >
            {busy ? 'Loading…' : enabled ? 'Disable 2FA' : 'Enable 2FA'}
          </button>
        </>
      )}

      {step === 'setup' && qrCode && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Scan this QR code with your authenticator app, then enter the 6-digit code below.</p>
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl inline-block dark:bg-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="TOTP QR Code" width={180} height={180} />
            </div>
          </div>
          <p className="text-xs text-gray-600 text-center dark:text-gray-400">
            Can&apos;t scan? Enter the secret manually: <code className="text-[#1A6080] dark:text-[#4ebac4] font-mono">{secret}</code>
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6-digit code"
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white text-center tracking-widest font-mono focus:outline-none focus:border-[#0E3D52]"
          />
          <div className="flex gap-3">
            <button onClick={verifySetup} disabled={busy || code.length !== 6}
              className="flex-1 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
              {busy ? 'Verifying…' : 'Verify & Enable'}
            </button>
            <button onClick={cancelStep}
              className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'disable' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Enter the 6-digit code from your authenticator app to confirm disabling 2FA.</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6-digit code"
            className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white text-center tracking-widest font-mono focus:outline-none focus:border-red-500"
          />
          <div className="flex gap-3">
            <button onClick={disableTotp} disabled={busy || code.length !== 6}
              className="flex-1 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
              {busy ? 'Processing…' : 'Confirm Disable'}
            </button>
            <button onClick={cancelStep}
              className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}
      <Toast state={toast2fa} onClose={() => setToast2fa(null)} />
    </div>
  )
}

// ── Emergency contact form (blank state) ────────────────────────────────────
const BLANK_CONTACT = { name: '', relationship: '', phone: '', email: '', isPrimary: false }

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyProfilePage() {
  const [profile,    setProfile]    = useState<Profile | null>(null)
  const [contacts,   setContacts]   = useState<EmergencyContact[]>([])
  const [linked,     setLinked]     = useState(true)
  const [loading,    setLoading]    = useState(true)

  // Edit form
  const [editing,    setEditing]    = useState(false)
  const [form,       setForm]       = useState({ preferredName: '', phone: '', address: '' })
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState<ToastState>(null)

  // Photo upload
  const [photoSaving, setPhotoSaving] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Emergency contacts
  const [contactForm,    setContactForm]    = useState(BLANK_CONTACT)
  const [editingContact, setEditingContact] = useState<string | null>(null) // id or 'new'
  const [contactSaving,  setContactSaving]  = useState(false)
  const [contactError,   setContactError]   = useState('')
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  useEffect(() => {
    fetchWithAuth('/api/tenant/my-profile')
      .then(r => r.json())
      .then(d => {
        setLinked(d.employeeLinked)
        if (d.profile) {
          setProfile(d.profile)
          setForm({
            preferredName: d.profile.preferredName ?? '',
            phone:         d.profile.phone         ?? '',
            address:       d.profile.address        ?? '',
          })
        }
        setContacts(d.emergencyContacts ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setToast(null)
    try {
      const res  = await fetchWithAuth('/api/tenant/my-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setToast({ message: data.error ?? 'Save failed', type: 'error' }); return }
      setProfile(prev => prev ? { ...prev, ...data.profile } : prev)
      setToast({ message: 'Profile updated successfully.', type: 'success' })
      setEditing(false)
    } catch {
      setToast({ message: 'Save failed — please try again.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function savePhoto(file: File) {
    setPhotoSaving(true)
    try {
      // Upload to Vercel Blob via the existing upload endpoint
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) { setToast({ message: 'Photo upload failed', type: 'error' }); return }
      const { url } = await uploadRes.json()
      const res = await fetchWithAuth('/api/tenant/my-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: url }),
      })
      const data = await res.json()
      if (res.ok) setProfile(prev => prev ? { ...prev, photoUrl: data.profile.photoUrl } : prev)
    } catch {
      setToast({ message: 'Photo upload failed', type: 'error' })
    } finally {
      setPhotoSaving(false)
    }
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault()
    if (!contactForm.name.trim()) { setContactError('Name is required'); return }
    setContactSaving(true); setContactError('')
    try {
      const isNew = editingContact === 'new'
      const res = await fetch(
        isNew
          ? '/api/tenant/my-profile/emergency-contacts'
          : '/api/tenant/my-profile/emergency-contacts',
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isNew ? contactForm : { id: editingContact, ...contactForm }),
        }
      )
      const data = await res.json()
      if (!res.ok) { setContactError(data.error ?? 'Failed'); return }
      if (isNew) {
        setContacts(c => [...c, data.contact])
      } else {
        setContacts(c => c.map(x => x.id === editingContact ? data.contact : x))
      }
      setEditingContact(null)
      setContactForm(BLANK_CONTACT)
    } catch { setContactError('Request failed') }
    finally { setContactSaving(false) }
  }

  async function deleteContact(id: string) {
    setConfirmState({
      message: 'Remove this emergency contact?',
      onConfirm: async () => {
        await fetchWithAuth(`/api/tenant/my-profile/emergency-contacts?id=${id}`, { method: 'DELETE' })
        setContacts(c => c.filter(x => x.id !== id))
        if (editingContact === id) setEditingContact(null)
      }
    })
  }

  function openEditContact(c: EmergencyContact) {
    setEditingContact(c.id)
    setContactForm({ name: c.name, relationship: c.relationship ?? '', phone: c.phone ?? '', email: c.email ?? '', isPrimary: c.isPrimary })
    setContactError('')
  }

  function fmt(dateStr: string | null | undefined) {
    if (!dateStr) return '—'
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (loading) return <SkeletonPage rows={3} />

  if (!linked || !profile) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="card-premium rounded-2xl p-10 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Profile Not Linked</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Your user account has not yet been linked to an employee profile.
            Please contact your HR administrator to set this up.
          </p>
        </div>
      </div>
    )
  }

  const employmentTypeLabel: Record<string, string> = {
    full_time:  'Full-Time', part_time: 'Part-Time',
    casual:     'Casual',    contractor: 'Contractor',
    volunteer:  'Volunteer',
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar with photo upload */}
          <div className="flex flex-col items-center gap-1">
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photoUrl} alt={profile.firstName} className="w-16 h-16 rounded-full object-cover border-2 border-[#0E3D52]" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0E3D52] to-blue-600 flex items-center justify-center text-2xl font-bold text-white">
                {profile.firstName[0]}{profile.lastName[0]}
              </div>
            )}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoSaving}
              className="text-[10px] text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] disabled:opacity-50 transition">
              {photoSaving ? 'Uploading…' : '📷 Change'}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) savePhoto(f) }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {profile.preferredName || profile.firstName} {profile.lastName}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              #{profile.employeeNumber} · {profile.entityName ?? 'HRMS'} ·{' '}
              <span className={`${profile.isActive ? 'text-green-400' : 'text-red-400'}`}>
                {profile.isActive ? 'Active' : 'Inactive'}
              </span>
            </p>
          </div>
        </div>

        {!editing && (
          <button
            onClick={() => { setEditing(true); setToast(null) }}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-[#0E3D52] text-[#1A6080] dark:text-[#4ebac4] hover:bg-[#0E3D52]/20 transition"
          >
             Edit Contact Info
          </button>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="card-premium border-[#0E3D52]/30 p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Update Contact Information</h2>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className={LABEL}>Preferred Name</label>
              <input type="text" value={form.preferredName} onChange={e => setForm(f => ({ ...f, preferredName: e.target.value }))}
                className={INPUT} placeholder={profile.firstName} />
            </div>
            <div>
              <label className={LABEL}>Phone Number</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className={INPUT} placeholder="+61 4XX XXX XXX" />
            </div>
            <div>
              <label className={LABEL}>Residential Address</label>
              <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className={INPUT + ' min-h-[70px] resize-none'} placeholder="Street, Suburb, State, Postcode" />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg">
                Cancel
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-600 mt-3 dark:text-gray-400">
            Name, employment type, salary, and start date are managed by HR and cannot be self-updated.
          </p>
        </div>
      )}

      {/* Personal Information */}
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">Personal Information</h2>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Full Name</span><span className="text-foreground text-sm font-medium">{profile.firstName} {profile.lastName}</span></div>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Preferred Name</span><span className="text-foreground text-sm">{profile.preferredName || '—'}</span></div>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Email</span><span className="text-foreground text-sm">{profile.email}</span></div>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Phone</span><span className="text-foreground text-sm">{profile.phone || '—'}</span></div>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Address</span><span className="text-foreground text-sm text-right max-w-xs">{profile.address || '—'}</span></div>
        {profile.dateOfBirth && (
          <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Date of Birth</span><span className="text-foreground text-sm">{fmt(profile.dateOfBirth)}</span></div>
        )}
      </div>

      {/* Employment Details */}
      <div className="card-premium rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">Employment Details</h2>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Employee Number</span><span className="text-foreground text-sm font-mono">#{profile.employeeNumber}</span></div>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Organisation</span><span className="text-foreground text-sm">{profile.entityName || '—'}</span></div>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Employment Type</span><span className="text-foreground text-sm">{employmentTypeLabel[profile.employmentType] ?? profile.employmentType}</span></div>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Start Date</span><span className="text-foreground text-sm">{fmt(profile.startDate)}</span></div>
        <div className={ROW}><span className="text-gray-500 text-sm dark:text-gray-400">Status</span>
          <span className={profile.isActive ? 'badge badge-green' : 'badge badge-red'}>
            {profile.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div className="card-premium rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Emergency Contacts</h2>
          {editingContact !== 'new' && (
            <button
              onClick={() => { setEditingContact('new'); setContactForm(BLANK_CONTACT); setContactError('') }}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#0E3D52] text-[#1A6080] dark:text-[#4ebac4] hover:bg-[#0E3D52]/20 transition">
              + Add contact
            </button>
          )}
        </div>

        {/* Inline add/edit form */}
        {editingContact && (
          <form onSubmit={saveContact} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              {editingContact === 'new' ? 'New Emergency Contact' : 'Edit Contact'}
            </p>
            {contactError && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{contactError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Full Name *</label>
                <input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith" className={INPUT} required />
              </div>
              <div>
                <label className={LABEL}>Relationship</label>
                <input value={contactForm.relationship} onChange={e => setContactForm(f => ({ ...f, relationship: e.target.value }))}
                  placeholder="Partner, Parent…" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Phone</label>
                <input type="tel" value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+61 4XX XXX XXX" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <input type="email" value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com" className={INPUT} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input type="checkbox" checked={contactForm.isPrimary} onChange={e => setContactForm(f => ({ ...f, isPrimary: e.target.checked }))}
                className="rounded border-gray-600" />
              Set as primary contact
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={contactSaving}
                className="px-4 py-2 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                {contactSaving ? 'Saving…' : editingContact === 'new' ? 'Add Contact' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => { setEditingContact(null); setContactForm(BLANK_CONTACT) }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-lg hover:text-white transition">
                Cancel
              </button>
            </div>
          </form>
        )}

        {contacts.length === 0 && editingContact !== 'new' ? (
          <p className="text-gray-600 text-sm text-center py-4 dark:text-gray-400">No emergency contacts on file. Add one using the button above.</p>
        ) : (
          <div className="space-y-3">
            {contacts.map(c => (
              <div key={c.id} className="bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{c.name}</p>
                    {c.isPrimary && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#0E3D52]/40 border border-[#1A6080] text-[#4ebac4]">Primary</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditContact(c)}
                      className="text-xs text-gray-500 hover:text-[#1A6080] dark:text-[#4ebac4] transition dark:text-gray-400">Edit</button>
                    <button onClick={() => deleteContact(c.id)}
                      className="text-xs text-gray-500 hover:text-red-400 transition dark:text-gray-400">Remove</button>
                  </div>
                </div>
                {c.relationship && <p className="text-xs text-gray-500 mb-1 dark:text-gray-400">{c.relationship}</p>}
                <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two-Factor Authentication */}
      <TwoFactorSection />

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
