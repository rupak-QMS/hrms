'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

type Holiday = {
  id: string
  name: string
  date: string
  country: string
  state: string | null
  isNational: boolean
}

type FormState = {
  name: string
  date: string
  country: string
  state: string
  isNational: boolean
}

const BLANK_FORM: FormState = { name: '', date: '', country: 'AU', state: '', isNational: true }

/** Converts a 2-letter ISO country code to its flag emoji */
function countryFlag(cc: string): string {
  const upper = cc.toUpperCase().slice(0, 2)
  if (upper.length < 2) return ''
  const [a, b] = upper.split('')
  return String.fromCodePoint(
    0x1F1E6 + a.charCodeAt(0) - 65,
    0x1F1E6 + b.charCodeAt(0) - 65,
  )
}

const COUNTRY_NAMES: Record<string, string> = {
  AU: 'Australia', NZ: 'New Zealand', US: 'United States', CA: 'Canada',
  GB: 'United Kingdom', IE: 'Ireland', IN: 'India', SG: 'Singapore',
  MY: 'Malaysia', PH: 'Philippines', AE: 'UAE', SA: 'Saudi Arabia',
  DE: 'Germany', FR: 'France', ES: 'Spain', IT: 'Italy', NL: 'Netherlands',
  BE: 'Belgium', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', CH: 'Switzerland',
  JP: 'Japan', KR: 'South Korea', CN: 'China', HK: 'Hong Kong', ZA: 'South Africa',
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const MANAGER_ROLES = ['director', 'hr_officer', 'operations_manager', 'compliance_manager']

const INPUT = 'input-premium'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

function fmt(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

export default function PublicHolidaysPage() {
  const currentYear = new Date().getFullYear()
  const [year,       setYear]       = useState(currentYear)
  const [holidays,   setHolidays]   = useState<Holiday[]>([])
  const [loading,    setLoading]    = useState(true)
  const [canManage,  setCanManage]  = useState(false)
  const [tenantCountry, setTenantCountry] = useState('AU')

  // Import from Nager.Date
  const [importing,  setImporting]  = useState(false)
  const [importMsg,  setImportMsg]  = useState('')

  // Form / modal state
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<Holiday | null>(null)
  const [form,       setForm]       = useState<FormState>(BLANK_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)

  // Role detection + tenant country
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setCanManage(MANAGER_ROLES.includes(d.userRole ?? '')))
      .catch(() => {})
    fetchWithAuth('/api/tenant/config')
      .then(r => r.json())
      .then(d => {
        const s = d.tenant?.settings ?? {}
        const cc = (typeof s === 'string' ? JSON.parse(s) : s)?.country ?? 'AU'
        setTenantCountry(cc.toUpperCase())
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async (y: number) => {
    setLoading(true)
    const res  = await fetchWithAuth(`/api/tenant/public-holidays?year=${y}`)
    const data = await res.json()
    setHolidays(data.holidays ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load(year) }, [year, load])

  function openAdd() {
    setEditing(null)
    setForm({ ...BLANK_FORM, country: tenantCountry, date: `${year}-01-01` })
    setFormError(null)
    setShowForm(true)
  }

  async function importHolidays() {
    setImporting(true); setImportMsg('')
    try {
      const res = await fetchWithAuth('/api/tenant/public-holidays/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, countryCode: tenantCountry }),
      })
      const d = await res.json()
      if (!res.ok) { setImportMsg(`${d.error}`); return }
      setImportMsg(`Imported ${d.imported} holiday(s) for ${d.year} · ${d.skipped} already existed.`)
      load(year)
    } catch {
      setImportMsg('Import failed — check connection.')
    } finally {
      setImporting(false)
    }
  }

  function openEdit(h: Holiday) {
    setEditing(h)
    setForm({ name: h.name, date: h.date, country: h.country, state: h.state ?? '', isNational: h.isNational })
    setFormError(null)
    setShowForm(true)
  }

  async function saveHoliday(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      const payload = { ...form, state: form.state || null }
      const res = editing
        ? await fetchWithAuth('/api/tenant/public-holidays', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editing.id, ...payload }),
          })
        : await fetchWithAuth('/api/tenant/public-holidays', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setFormError(d.error ?? `Failed (${res.status})`)
        return
      }
      setShowForm(false)
      load(year)
    } catch {
      setFormError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteHoliday(id: string) {
    setDeleting(id)
    try {
      await fetchWithAuth('/api/tenant/public-holidays', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      setHolidays(prev => prev.filter(h => h.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  // Group by month
  const byMonth: Record<number, Holiday[]> = {}
  for (const h of holidays) {
    const m = new Date(h.date + 'T00:00:00').getMonth()
    if (!byMonth[m]) byMonth[m] = []
    byMonth[m].push(h)
  }

  const nextHoliday = holidays.find(h => daysUntil(h.date) >= 0)

  function exportHolidays() {
    exportCsv({
      filename: 'public-holidays',
      columns: [
        { header: 'Name', key: 'name' },
        { header: 'Date', key: 'date', format: v => fmtCsvDate(v) },
        { header: 'Country', key: 'country' },
        { header: 'State / Territory', key: 'state', format: v => v ?? '' },
        { header: 'National', key: 'isNational', format: v => v ? 'Yes' : 'No' },
      ],
      rows: holidays,
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{countryFlag(tenantCountry)} Public Holidays</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {canManage
              ? `Manage public holidays for your organisation (${COUNTRY_NAMES[tenantCountry] ?? tenantCountry})`
              : `${COUNTRY_NAMES[tenantCountry] ?? tenantCountry} national public holidays`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <ExportButton onClick={exportHolidays} disabled={holidays.length === 0} />
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setYear(y => y - 1)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white hover:border-gray-500 transition-colors"
            >←</button>
            <span className="px-4 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-semibold min-w-[80px] text-center">
              {year}
            </span>
            <button
              onClick={() => setYear(y => y + 1)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white hover:border-gray-500 transition-colors"
            >→</button>
          </div>

          {/* Import button — managers only */}
          {canManage && (
            <button
              onClick={importHolidays}
              disabled={importing}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-900 dark:text-white text-sm font-medium rounded-lg transition-colors"
              title={`Auto-import ${year} public holidays from Nager.Date for ${tenantCountry}`}
            >
              {importing ? 'Importing…' : `Import ${year}`}
            </button>
          )}

          {/* Add button — managers only */}
          {canManage && (
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium rounded-lg transition-colors"
            >
              + Add Holiday
            </button>
          )}
        </div>
      </div>

      {importMsg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm border ${importMsg.startsWith('') ? 'bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300'}`}>
          {importMsg}
        </div>
      )}

      {/* Next holiday banner */}
      {nextHoliday && year === currentYear && (
        <div className="bg-[#f0f7fb] dark:bg-[#0E3D52]/30 border border-[#b8d4e0] dark:border-[#1A6080] rounded-xl px-5 py-4 flex items-center gap-4">
          <span className="text-3xl"></span>
          <div>
            <p className="text-xs text-[#1A6080] dark:text-[#4ebac4] font-medium uppercase tracking-wider">Next Public Holiday</p>
            <p className="text-foreground font-semibold">{nextHoliday.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {fmt(nextHoliday.date)}
              {daysUntil(nextHoliday.date) === 0 ? ' — Today!'
                : daysUntil(nextHoliday.date) === 1 ? ' — Tomorrow!'
                : ` — in ${daysUntil(nextHoliday.date)} days`}
            </p>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="modal-overlay">
          <form
            onSubmit={saveHoliday}
            className="card-premium rounded-2xl p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-foreground">
                {editing ? 'Edit Holiday' : 'Add Public Holiday'}
              </h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-xl leading-none dark:text-gray-400">×</button>
            </div>

            <div>
              <label className={LABEL}>Holiday Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={INPUT}
                placeholder="e.g. Christmas Day"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={INPUT}
                  required
                />
              </div>
              <div>
                <label className={LABEL}>Country *</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value.toUpperCase().slice(0, 10) }))}
                  className={INPUT}
                  placeholder="AU"
                  maxLength={10}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>State / Territory (optional)</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase().slice(0, 10) }))}
                  className={INPUT}
                  placeholder="e.g. NSW, VIC"
                  maxLength={10}
                />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isNational}
                    onChange={e => setForm(f => ({ ...f, isNational: e.target.checked }))}
                    className="w-4 h-4 rounded accent-[#0E3D52]"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">National holiday</span>
                </label>
              </div>
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Holiday'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Holiday list */}
      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">Loading…</div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-16 bg-gray-100 dark:bg-gray-800/50 rounded-2xl border border-gray-300 dark:border-gray-700">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">No public holidays found for {year}</p>
          {canManage && (
            <button onClick={openAdd} className="mt-4 px-4 py-2 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm rounded-lg">
              + Add First Holiday
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byMonth)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([monthIdx, monthHolidays]) => {
              const m = Number(monthIdx)
              const isPastMonth = new Date(year, m + 1, 1) < new Date()
              return (
                <div key={m}>
                  <h2 className={`text-xs font-semibold uppercase tracking-widest mb-3 ${isPastMonth ? 'text-gray-600' : 'text-[#1A6080] dark:text-[#4ebac4]'}`}>
                    {MONTHS[m]}
                  </h2>
                  <div className="space-y-2">
                    {monthHolidays.map(h => {
                      const diff    = daysUntil(h.date)
                      const isToday = diff === 0
                      const isPast  = diff < 0
                      const isBusy  = deleting === h.id
                      return (
                        <div
                          key={h.id}
                          className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-colors ${
                            isToday ? 'bg-[#E0EEF4] dark:bg-[#0E3D52]/40 border-[#4ebac4] dark:border-[#0E3D52]'
                            : isPast ? 'bg-gray-800/30 border-gray-800 opacity-50'
                            : 'bg-gray-800/60 border-gray-700'
                          }`}
                        >
                          {/* Date block */}
                          <div className="text-center w-14 shrink-0">
                            <p className="text-xs text-gray-500 uppercase dark:text-gray-400">
                              {new Date(h.date + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short' })}
                            </p>
                            <p className={`text-2xl font-bold leading-none ${isToday ? 'text-[#4ebac4]' : isPast ? 'text-gray-400 dark:text-gray-600' : 'text-foreground'}`}>
                              {new Date(h.date + 'T00:00:00').getDate()}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(h.date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short' })}
                            </p>
                          </div>

                          {/* Name + badges */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${isPast ? 'text-gray-400 dark:text-gray-600' : 'text-foreground'}`}>{h.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800">
                                {h.country}
                              </span>
                              {h.isNational && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                                  National
                                </span>
                              )}
                              {h.state && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-600">
                                  {h.state}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Countdown + manager actions */}
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs">
                              {isToday ? <span className="text-[#4ebac4] font-semibold">Today </span>
                                : isPast ? <span className="text-gray-600 dark:text-gray-400">Passed</span>
                                : diff === 1 ? <span className="text-yellow-400">Tomorrow</span>
                                : <span className="text-gray-500 dark:text-gray-400">{diff}d away</span>}
                            </span>

                            {canManage && (
                              <>
                                <button
                                  onClick={() => openEdit(h)}
                                  className="text-xs text-gray-500 hover:text-[#1A6080] dark:text-[#4ebac4] transition-colors px-1 dark:text-gray-400"
                                  title="Edit"
                                ></button>
                                <button
                                  onClick={() => deleteHoliday(h.id)}
                                  disabled={isBusy}
                                  className="text-xs text-gray-500 hover:text-red-400 disabled:opacity-40 transition-colors px-1 dark:text-gray-400"
                                  title="Delete"
                                >
                                  {isBusy ? '…' : ''}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      <p className="text-xs text-gray-600 pt-2 dark:text-gray-400">
        {canManage
          ? 'Add, edit or remove holidays as needed. Changes apply immediately to all employees.'
          : 'Dates reflect national observed holidays. Some states may observe additional or substituted dates.'}
      </p>
    </div>
  )
}
