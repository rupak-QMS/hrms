'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  COUNTRIES, COUNTRY_TIMEZONES, getCurrency, getCurrencySymbol,
  getDefaultTimezone,
} from '@/lib/integrations/payroll'

const TIERS = [
  { value: 'starter',      label: 'Starter',      modules: 11,  price: 57,  desc: 'Core + Compliance — 11 modules' },
  { value: 'professional', label: 'Professional',  modules: 20, price: 120, desc: '+ Talent, Learning, Performance, Safety — 20 modules' },
  { value: 'enterprise',   label: 'Enterprise',    modules: 30, price: 217, desc: 'All 30 modules — full platform' },
]

const INPUT  = 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500'
const LABEL  = 'block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1'
const GRID2  = 'grid grid-cols-2 gap-4'

export default function NewClientPage() {
  const router = useRouter()

  const [form, setForm] = useState({
    // Organisation
    name:               '',
    slug:               '',
    vercelProjectName:  '',
    legalName:          '',
    registrationNumber: '',
    industry:           '',
    country:            'AU',
    currency:           'AUD',
    timezone:           'Australia/Sydney',
    headcount:          '',
    // Branding
    tier:               'enterprise',
    primaryColor:       '#6d28d9',
    // Primary Contact
    contactName:        '',
    contactTitle:       '',
    contactEmail:       '',
    contactPhone:       '',
    // Billing Contact (optional — defaults to primary)
    billingEmail:       '',
    billingPhone:       '',
    // Address
    addressLine1:       '',
    addressLine2:       '',
    city:               '',
    state:              '',
    postcode:           '',
    // Subdomain (defaults to slug)
    subdomain:          '',
    // Admin Account
    adminEmail:         '',
    adminPassword:      '',
  })

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function set(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleName(v: string) {
    const slug = v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setForm(f => ({
      ...f,
      name:              v,
      legalName:         f.legalName || v,
      slug,
      vercelProjectName: f.vercelProjectName || `${slug}-hrmsapp`,
    }))
  }

  function handleCountry(code: string) {
    const currency = getCurrency(code)
    const timezone = getDefaultTimezone(code)
    setForm(f => ({ ...f, country: code, currency, timezone }))
  }

  const timezones = COUNTRY_TIMEZONES[form.country] ?? ['UTC']
  const currencySymbol = getCurrencySymbol(form.currency)
  const selectedTier = TIERS.find(t => t.value === form.tier)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.slug || !form.contactEmail) {
      setError('Organisation name, slug and primary contact email are required')
      return
    }
    if (form.adminEmail && !form.adminPassword) {
      setError('Please provide a password for the admin account')
      return
    }
    setLoading(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        name:         form.name,
        slug:         form.slug,
        subdomain:    form.subdomain || form.slug,  // default subdomain = slug
        tier:         form.tier,
        primaryColor: form.primaryColor,
        adminEmail:   form.adminEmail || undefined,
        adminPassword:form.adminPassword || undefined,
        deploymentUrl: form.vercelProjectName
          ? `https://${form.vercelProjectName}.vercel.app`
          : undefined,
        settings: {
          country:   form.country,
          currency:  form.currency,
          timezone:  form.timezone,
          headcount: form.headcount ? Number(form.headcount) : undefined,
          legalName: form.legalName,
          registrationNumber: form.registrationNumber,
          industry:  form.industry,
          contact: {
            name:   form.contactName,
            title:  form.contactTitle,
            email:  form.contactEmail,
            phone:  form.contactPhone,
          },
          billing: {
            email: form.billingEmail || form.contactEmail,
            phone: form.billingPhone || form.contactPhone,
          },
          address: {
            line1:    form.addressLine1,
            line2:    form.addressLine2,
            city:     form.city,
            state:    form.state,
            postcode: form.postcode,
            country:  form.country,
          },
        },
      }

      const res  = await fetch('/api/super-admin/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create client')
      router.push(`/super-admin/clients/${data.tenant.id}/modules`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Client</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Onboard a new organisation onto the HRMS platform</p>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Organisation ── */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Organisation Details</h2>

          <div className={GRID2}>
            <div>
              <label className={LABEL}>Trading Name *</label>
              <input required value={form.name} onChange={e => handleName(e.target.value)}
                placeholder="Yahweh Care" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Legal / Registered Name</label>
              <input value={form.legalName} onChange={e => set('legalName', e.target.value)}
                placeholder="Yahweh Care Pty Ltd" className={INPUT} />
            </div>
          </div>

          <div className={GRID2}>
            <div>
              <label className={LABEL}>URL Slug *</label>
              <input required value={form.slug}
                onChange={e => {
                  const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                  setForm(f => ({ ...f, slug, vercelProjectName: `${slug}-hrmsapp` }))
                }}
                placeholder="yahweh-care" className={INPUT} />
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Used for login routing</p>
            </div>
            <div>
              <label className={LABEL}>ABN / Company Reg. Number</label>
              <input value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)}
                placeholder="12 345 678 901" className={INPUT} />
            </div>
          </div>

          {/* Custom subdomain */}
          <div>
            <label className={LABEL}>Custom Subdomain</label>
            <div className="flex items-center gap-2">
              <input
                value={form.subdomain}
                onChange={e => set('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder={form.slug || 'slug'}
                className={INPUT}
              />
              <span className="text-xs text-gray-500 whitespace-nowrap dark:text-gray-400">.{'{your-domain}'}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
              Leave blank to use the slug. Used for wildcard domain routing (e.g. <span className="text-purple-600 dark:text-purple-400">{form.subdomain || form.slug || 'slug'}.yahwehhrms.com.au</span>).
            </p>
          </div>

          {/* Vercel deployment subdomain */}
          <div>
            <label className={LABEL}>Vercel Project Name</label>
            <div className="flex items-center gap-2">
              <input
                value={form.vercelProjectName}
                onChange={e => set('vercelProjectName', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder={`${form.slug || 'slug'}-hrmsapp`}
                className={INPUT}
              />
              <span className="text-xs text-gray-500 whitespace-nowrap dark:text-gray-400">.vercel.app</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">
              Tenant URL:{' '}
              <span className="text-purple-600 dark:text-purple-400">
                https://{form.vercelProjectName || `${form.slug || 'slug'}-hrmsapp`}.vercel.app
              </span>
              {' '}— auto-created if Vercel API token is configured.
            </p>
          </div>

          <div className={GRID2}>
            <div>
              <label className={LABEL}>Industry / Sector</label>
              <select value={form.industry} onChange={e => set('industry', e.target.value)} className={INPUT}>
                <option value="">Select industry…</option>
                {['Aged Care', 'Disability Services', 'Healthcare', 'Property Services',
                  'Construction', 'Retail', 'Hospitality', 'Education', 'Finance',
                  'Technology', 'Manufacturing', 'Logistics', 'Not-for-Profit', 'Other'
                ].map(i => <option key={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Approximate Headcount</label>
              <input type="number" min="1" value={form.headcount} onChange={e => set('headcount', e.target.value)}
                placeholder="50" className={INPUT} />
            </div>
          </div>
        </section>

        {/* ── Country / Currency / Timezone ── */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Region & Currency</h2>

          <div className={GRID2}>
            <div>
              <label className={LABEL}>Country *</label>
              <select value={form.country} onChange={e => handleCountry(e.target.value)} className={INPUT}>
                {COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Currency</label>
              <input readOnly value={`${form.currency} (${currencySymbol})`}
                className={`${INPUT} cursor-not-allowed opacity-70`} />
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Auto-set from country</p>
            </div>
          </div>

          <div>
            <label className={LABEL}>Timezone</label>
            <select value={form.timezone} onChange={e => set('timezone', e.target.value)} className={INPUT}>
              {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          {/* Address */}
          <div>
            <label className={LABEL}>Address Line 1</label>
            <input value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)}
              placeholder="123 Example Street" className={INPUT} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={LABEL}>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)}
                placeholder="Sydney" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>State / Province</label>
              <input value={form.state} onChange={e => set('state', e.target.value)}
                placeholder="NSW" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Postcode / ZIP</label>
              <input value={form.postcode} onChange={e => set('postcode', e.target.value)}
                placeholder="2000" className={INPUT} />
            </div>
          </div>
        </section>

        {/* ── Primary Contact ── */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Primary Contact</h2>

          <div className={GRID2}>
            <div>
              <label className={LABEL}>Full Name *</label>
              <input required value={form.contactName} onChange={e => set('contactName', e.target.value)}
                placeholder="Jane Smith" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Title / Position</label>
              <input value={form.contactTitle} onChange={e => set('contactTitle', e.target.value)}
                placeholder="CEO / HR Manager" className={INPUT} />
            </div>
          </div>
          <div className={GRID2}>
            <div>
              <label className={LABEL}>Email *</label>
              <input required type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)}
                placeholder="jane@company.com" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Phone</label>
              <input type="tel" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)}
                placeholder="+61 400 000 000" className={INPUT} />
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Billing Contact <span className="font-normal normal-case text-gray-600 dark:text-gray-400">(leave blank to use primary contact)</span></p>
            <div className={GRID2}>
              <div>
                <label className={LABEL}>Billing Email</label>
                <input type="email" value={form.billingEmail} onChange={e => set('billingEmail', e.target.value)}
                  placeholder={form.contactEmail || 'billing@company.com'} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Billing Phone</label>
                <input type="tel" value={form.billingPhone} onChange={e => set('billingPhone', e.target.value)}
                  placeholder={form.contactPhone || '+61 400 000 000'} className={INPUT} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Subscription Tier ── */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Subscription Tier *</h2>
          {TIERS.map(t => (
            <label key={t.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              form.tier === t.value ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/30' : 'border-gray-300 dark:border-gray-700 hover:border-gray-600'
            }`}>
              <input type="radio" name="tier" value={t.value} checked={form.tier === t.value}
                onChange={() => set('tier', t.value)} className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t.label}</p>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {currencySymbol}{convertAUD(t.price, form.currency)}/mo · {t.modules} modules
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{t.desc}</p>
              </div>
            </label>
          ))}
        </section>

        {/* ── Branding ── */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Branding</h2>
          <div>
            <label className={LABEL}>Brand Primary Colour</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.primaryColor}
                onChange={e => set('primaryColor', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
              <input type="text" value={form.primaryColor}
                onChange={e => set('primaryColor', e.target.value)}
                className="w-32 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500" />
              <div className="flex-1 h-10 rounded-lg"
                style={{ background: `linear-gradient(135deg, ${form.primaryColor}, ${form.primaryColor}88)` }} />
            </div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
            Logo upload is available after creation via <strong className="text-gray-600 dark:text-gray-300">Edit Client → Logo & Branding</strong>
          </div>
        </section>

        {/* ── Admin Account ── */}
        <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Admin Account (optional)</h2>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Creates a Director-level login for the client portal immediately.</p>
          </div>
          <div className={GRID2}>
            <div>
              <label className={LABEL}>Admin Email</label>
              <input type="email" value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)}
                placeholder="admin@client.com" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Temp Password {form.adminEmail && <span className="text-red-600 dark:text-red-400">*</span>}</label>
              <input type="text" value={form.adminPassword} onChange={e => set('adminPassword', e.target.value)}
                placeholder="min 8 characters" className={INPUT} />
            </div>
          </div>

          {form.adminEmail && form.adminPassword && (
            <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
              A Director account will be created for <strong>{form.adminEmail}</strong>.
              A welcome email with login details will be sent once email integration is active.
            </div>
          )}
        </section>

        {/* Summary */}
        {form.name && (
          <div className="bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800/50 rounded-xl p-5">
            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3">Summary</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Organisation</span><span className="text-gray-900 dark:text-white">{form.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Country</span><span className="text-gray-900 dark:text-white">{COUNTRIES.find(c => c.code === form.country)?.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Currency</span><span className="text-gray-900 dark:text-white">{form.currency}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Tier</span><span className="text-gray-900 dark:text-white">{selectedTier?.label}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Est. Monthly</span><span className="text-green-600 dark:text-green-400 font-semibold">{currencySymbol}{convertAUD(selectedTier?.price ?? 0, form.currency)}</span></div>
              {form.contactEmail && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Contact</span><span className="text-gray-900 dark:text-white">{form.contactEmail}</span></div>}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition">
            {loading ? 'Creating…' : 'Create Client & Configure Modules →'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

// Local FX helper — kept in sync with src/lib/integrations/payroll.ts FX_RATES
function convertAUD(amountAUD: number, currency: string): number {
  const FX: Record<string, number> = {
    AUD: 1.00, NZD: 1.08, USD: 0.64, CAD: 0.87,
    GBP: 0.51, EUR: 0.59, SGD: 0.87, MYR: 3.02,
    PHP: 36.5, INR: 53.8, AED: 2.35, SAR: 2.40,
    ZAR: 12.0, JPY: 98.0, HKD: 5.01, CNY: 4.64,
    KRW: 870,  THB: 23.1, SEK: 6.85, NOK: 6.92,
    DKK: 4.42, CHF: 0.57,
  }
  return Math.round(amountAUD * (FX[currency] ?? 1) * 100) / 100
}
