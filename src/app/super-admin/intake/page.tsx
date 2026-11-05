'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { COUNTRIES, getCurrency, getCurrencySymbol, getDefaultTimezone, COUNTRY_TIMEZONES } from '@/lib/integrations/payroll'

const MODULES_LIST = [
  { id: 2,  name: 'Employee Management' },
  { id: 3,  name: 'Roles & Access' },
  { id: 4,  name: 'Audit Logs' },
  { id: 5,  name: 'Documents' },
  { id: 6,  name: 'Compliance - Screening' },
  { id: 7,  name: 'Compliance - Lock' },
  { id: 8,  name: 'Compliance - Tracking' },
  { id: 9,  name: 'Onboarding' },
  { id: 10, name: 'Training' },
  { id: 11, name: 'Competencies' },
  { id: 12, name: 'Supervision' },
  { id: 13, name: 'Workforce Planning' },
  { id: 14, name: 'Recruitment' },
  { id: 15, name: 'Contracts' },
  { id: 16, name: 'Performance Reviews' },
  { id: 17, name: 'WHS & Safety' },
  { id: 18, name: 'Grievances' },
  { id: 19, name: 'Separation' },
  { id: 20, name: 'Analytics' },
  { id: 21, name: 'Benefits' },
  { id: 22, name: 'Recognition' },
  { id: 23, name: 'Referrals' },
  { id: 24, name: 'DEI' },
  { id: 25, name: 'Engagement' },
  { id: 26, name: 'Assets' },
  { id: 27, name: 'Rostering' },
  { id: 28, name: 'Payroll' },
  { id: 29, name: 'Leave Management' },
  { id: 30, name: 'Public Holidays' },
]

type Tab = 'fill' | 'upload'

const INPUT = 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

const INITIAL = {
  tradingName: '', legalName: '', registrationNumber: '', industry: '',
  country: 'AU', currency: 'AUD', timezone: 'Australia/Sydney',
  headcount: '', addressLine1: '', city: '', state: '', postcode: '',
  contactName: '', contactTitle: '', contactEmail: '', contactPhone: '',
  billingEmail: '', billingPhone: '',
  adminEmail: '', adminPassword: '',
  tier: 'enterprise',
  primaryColor: '#6d28d9',
  selectedModules: [] as number[],
  notes: '',
}

export default function IntakePage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab,     setTab]     = useState<Tab>('fill')
  const [form,    setForm]    = useState(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  function set(key: keyof typeof INITIAL, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleCountry(code: string) {
    set('country', code)
    set('currency', getCurrency(code))
    set('timezone', getDefaultTimezone(code))
  }

  function toggleModule(id: number) {
    setForm(f => ({
      ...f,
      selectedModules: f.selectedModules.includes(id)
        ? f.selectedModules.filter(m => m !== id)
        : [...f.selectedModules, id],
    }))
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${form.tradingName.replace(/\s+/g, '-').toLowerCase() || 'client'}-intake.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadPrintable() {
    const html = buildPrintableHTML(form)
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    win?.print()
    URL.revokeObjectURL(url)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      setForm({ ...INITIAL, ...data })
      setTab('fill')
      setSuccess('Intake form loaded from file. Review and submit.')
    } catch {
      setError('Invalid JSON file — please upload the downloaded intake form')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tradingName || !form.contactEmail) {
      setError('Trading name and contact email are required')
      return
    }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/super-admin/intake', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create client')
      setSuccess(`Client "${form.tradingName}" created successfully!`)
      setTimeout(() => router.push(`/super-admin/clients/${data.tenant.id}/modules`), 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const timezones = COUNTRY_TIMEZONES[form.country] ?? ['UTC']
  const currSymbol = getCurrencySymbol(form.currency)

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Client Intake Form</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Fill in online and submit, or download as JSON for the client to complete offline
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadPrintable}
            className="px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:text-gray-900 dark:text-white transition">
            Print / PDF
          </button>
          <button onClick={downloadJSON}
            className="px-3 py-2 text-xs border border-[#b8d4e0] dark:border-[#1A6080] text-[#0E3D52] dark:text-[#7dcfd7] rounded-lg hover:bg-[#E0EEF4] dark:bg-[#E0EEF4] dark:bg-[#0E3D52]/20 transition">
            ⬇ Download Form
          </button>
        </div>
      </div>

      {/* Tab */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {([['fill', 'Fill Online'], ['upload', 'Upload Completed Form']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === id ? 'border-[#0E3D52] text-[#0E3D52] dark:text-[#4ebac4]' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {success && <div className="bg-green-50 dark:bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">{success}</div>}
      {error   && <div className="bg-red-50 dark:bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      {tab === 'upload' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center space-y-4">
          <div className="text-4xl"></div>
          <p className="text-gray-900 dark:text-white font-medium">Upload a completed intake form</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Share the <strong>Download Form</strong> button above with the client.
            They fill it and return the JSON file. Upload it here to auto-populate the form.
          </p>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
          <button onClick={() => fileRef.current?.click()}
            className="px-6 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm rounded-lg transition">
            Choose File (.json)
          </button>
        </div>
      )}

      {tab === 'fill' && (
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Organisation */}
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Organisation</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={LABEL}>Trading Name *</label>
                <input required value={form.tradingName} onChange={e => { set('tradingName', e.target.value); if (!form.legalName) set('legalName', e.target.value) }}
                  placeholder="Yahweh Care" className={INPUT} /></div>
              <div><label className={LABEL}>Legal / Registered Name</label>
                <input value={form.legalName} onChange={e => set('legalName', e.target.value)}
                  placeholder="Yahweh Care Pty Ltd" className={INPUT} /></div>
              <div><label className={LABEL}>ABN / Registration Number</label>
                <input value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)}
                  placeholder="12 345 678 901" className={INPUT} /></div>
              <div><label className={LABEL}>Industry</label>
                <select value={form.industry} onChange={e => set('industry', e.target.value)} className={INPUT}>
                  <option value="">Select…</option>
                  {['Aged Care','Disability Services','Healthcare','Property Services','Construction','Retail',
                    'Hospitality','Education','Finance','Technology','Manufacturing','Logistics','Not-for-Profit','Other'
                  ].map(i => <option key={i}>{i}</option>)}
                </select></div>
              <div><label className={LABEL}>Approximate Headcount</label>
                <input type="number" min="1" value={form.headcount} onChange={e => set('headcount', e.target.value)}
                  placeholder="50" className={INPUT} /></div>
            </div>
          </section>

          {/* Region */}
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Region & Address</h2>
            <div className="grid grid-cols-3 gap-4">
              <div><label className={LABEL}>Country *</label>
                <select value={form.country} onChange={e => handleCountry(e.target.value)} className={INPUT}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select></div>
              <div><label className={LABEL}>Currency (auto)</label>
                <input readOnly value={`${form.currency} (${currSymbol})`} className={`${INPUT} opacity-60 cursor-not-allowed`} /></div>
              <div><label className={LABEL}>Timezone</label>
                <select value={form.timezone} onChange={e => set('timezone', e.target.value)} className={INPUT}>
                  {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select></div>
            </div>
            <div><label className={LABEL}>Street Address</label>
              <input value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)}
                placeholder="123 Example Street" className={INPUT} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><label className={LABEL}>City</label>
                <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Sydney" className={INPUT} /></div>
              <div><label className={LABEL}>State</label>
                <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="NSW" className={INPUT} /></div>
              <div><label className={LABEL}>Postcode</label>
                <input value={form.postcode} onChange={e => set('postcode', e.target.value)} placeholder="2000" className={INPUT} /></div>
            </div>
          </section>

          {/* Contacts */}
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Primary Contact</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={LABEL}>Full Name *</label>
                <input required value={form.contactName} onChange={e => set('contactName', e.target.value)}
                  placeholder="Jane Smith" className={INPUT} /></div>
              <div><label className={LABEL}>Title / Position</label>
                <input value={form.contactTitle} onChange={e => set('contactTitle', e.target.value)}
                  placeholder="CEO / HR Manager" className={INPUT} /></div>
              <div><label className={LABEL}>Email *</label>
                <input required type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)}
                  placeholder="jane@company.com" className={INPUT} /></div>
              <div><label className={LABEL}>Phone</label>
                <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)}
                  placeholder="+61 400 000 000" className={INPUT} /></div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
              <p className="text-xs text-gray-500 mb-3 dark:text-gray-400">Billing Contact (leave blank to use above)</p>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={LABEL}>Billing Email</label>
                  <input type="email" value={form.billingEmail} onChange={e => set('billingEmail', e.target.value)}
                    placeholder={form.contactEmail || 'billing@company.com'} className={INPUT} /></div>
                <div><label className={LABEL}>Billing Phone</label>
                  <input type="tel" value={form.billingPhone} onChange={e => set('billingPhone', e.target.value)}
                    placeholder={form.contactPhone || ''} className={INPUT} /></div>
              </div>
            </div>
          </section>

          {/* Required Modules */}
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Required Modules</h2>
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => setForm(f => ({ ...f, selectedModules: MODULES_LIST.map(m => m.id) }))}
                  className="text-[#4ebac4] hover:text-[#0E3D52] dark:text-[#7dcfd7]">Select All</button>
                <span className="text-gray-600 dark:text-gray-400">·</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, selectedModules: [] }))}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:text-gray-300">Clear</button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MODULES_LIST.map(m => (
                <label key={m.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition ${
                  form.selectedModules.includes(m.id) ? 'border-[#0E3D52] bg-[#E0EEF4] dark:bg-[#E0EEF4] dark:bg-[#0E3D52]/20 text-[#0E3D52] dark:text-[#7dcfd7]' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-600'
                }`}>
                  <input type="checkbox" checked={form.selectedModules.includes(m.id)} onChange={() => toggleModule(m.id)}
                    className="accent-purple-500" />
                  {m.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{form.selectedModules.length} of {MODULES_LIST.length} modules selected</p>
          </section>

          {/* Admin Account */}
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Portal Admin Account</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={LABEL}>Admin Email</label>
                <input type="email" value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)}
                  placeholder="admin@client.com" className={INPUT} /></div>
              <div><label className={LABEL}>Temporary Password {form.adminEmail && <span className="text-red-600 dark:text-red-400">*</span>}</label>
                <input type="text" value={form.adminPassword} onChange={e => set('adminPassword', e.target.value)}
                  placeholder="min 8 characters" className={INPUT} /></div>
            </div>
            {form.adminEmail && (
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
                A welcome email with login credentials will be sent to <strong>{form.adminEmail}</strong> once email integration is active.
              </div>
            )}
          </section>

          {/* Notes */}
          <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Internal Notes</h2>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
              placeholder="Any special requirements, SLA agreements, go-live dates…"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52] resize-none" />
          </section>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition">
              {loading ? 'Creating Client…' : 'Create Client & Send Welcome Email →'}
            </button>
            <button type="button" onClick={downloadJSON}
              className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white text-sm px-4 py-2.5 rounded-lg transition">
              ⬇ Save as Draft
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function buildPrintableHTML(form: typeof INITIAL) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Client Intake Form — ${form.tradingName || 'New Client'}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #111; font-size: 13px; }
  h1 { color: #6d28d9; font-size: 22px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-top: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }
  .field { margin-bottom: 12px; }
  label { font-size: 11px; color: #666; display: block; margin-bottom: 2px; }
  .value { border-bottom: 1px solid #d1d5db; padding: 4px 0; min-height: 24px; }
  .modules { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
  .module { border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 8px; font-size: 11px; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>HRMS Client Intake Form</h1>
<p style="color:#666; font-size:12px;">Please complete all required (*) fields and return this form to your HRMS representative.</p>

<h2>Organisation</h2>
<div class="grid">
  <div class="field"><label>Trading Name *</label><div class="value">${form.tradingName}</div></div>
  <div class="field"><label>Legal / Registered Name</label><div class="value">${form.legalName}</div></div>
  <div class="field"><label>ABN / Registration Number</label><div class="value">${form.registrationNumber}</div></div>
  <div class="field"><label>Industry / Sector</label><div class="value">${form.industry}</div></div>
  <div class="field"><label>Approximate Headcount</label><div class="value">${form.headcount}</div></div>
</div>

<h2>Region</h2>
<div class="grid">
  <div class="field"><label>Country *</label><div class="value">${form.country}</div></div>
  <div class="field"><label>Currency</label><div class="value">${form.currency}</div></div>
  <div class="field"><label>Timezone</label><div class="value">${form.timezone}</div></div>
</div>
<div class="field"><label>Street Address</label><div class="value">${form.addressLine1}</div></div>
<div class="grid">
  <div class="field"><label>City</label><div class="value">${form.city}</div></div>
  <div class="field"><label>State</label><div class="value">${form.state}</div></div>
  <div class="field"><label>Postcode / ZIP</label><div class="value">${form.postcode}</div></div>
</div>

<h2>Primary Contact</h2>
<div class="grid">
  <div class="field"><label>Full Name *</label><div class="value">${form.contactName}</div></div>
  <div class="field"><label>Title / Position</label><div class="value">${form.contactTitle}</div></div>
  <div class="field"><label>Email *</label><div class="value">${form.contactEmail}</div></div>
  <div class="field"><label>Phone</label><div class="value">${form.contactPhone}</div></div>
  <div class="field"><label>Billing Email</label><div class="value">${form.billingEmail || '(same as above)'}</div></div>
  <div class="field"><label>Billing Phone</label><div class="value">${form.billingPhone || '(same as above)'}</div></div>
</div>

<h2>Required Modules</h2>
<div class="modules">
${[
  'Employee Management','Roles & Access','Audit Logs','Documents',
  'Compliance - Screening','Compliance - Lock','Compliance - Tracking',
  'Onboarding','Training','Competencies','Supervision','Workforce Planning',
  'Recruitment','Contracts','Performance Reviews','WHS & Safety',
  'Grievances','Separation','Analytics','Benefits','Recognition',
  'Referrals','DEI','Engagement','Assets','Rostering','Payroll',
  'Leave Management','Public Holidays'
].map(m => `<div class="module">${m}</div>`).join('')}
</div>

<h2>Admin Portal Account</h2>
<div class="grid">
  <div class="field"><label>Admin Email</label><div class="value">${form.adminEmail}</div></div>
  <div class="field"><label>Temporary Password</label><div class="value">&nbsp;</div></div>
</div>

<h2>Notes / Special Requirements</h2>
<div class="field"><div class="value" style="min-height:60px">${form.notes}</div></div>

<p style="margin-top:32px; font-size:11px; color:#999; border-top:1px solid #e5e7eb; padding-top:12px;">
  HRMS Platform — Confidential Client Intake Document · Generated ${new Date().toLocaleDateString('en-AU')}
</p>
</body></html>`
}
