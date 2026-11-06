'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
type LeaveTypeRow = {
  key: string
  label: string
  emoji: string
  color: string
  accrualNote: string
  entitlementDaysFT: number
  entitlementDaysPT: number
  entitlementDaysCasual: number
  isActive: boolean
  /** null = unlimited carry-forward; 0 = no carry-forward; N = cap at N days */
  maxCarryForwardDays: number | null
  // edit state
  _dirty?: boolean
}

const INPUT = 'w-full bg-white dark:bg-[#0F1E2E] border border-gray-300 dark:border-[#1A6080]/30 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]'
const LABEL = 'block text-xs font-medium text-gray-500 mb-1'

export default function LeaveSettingsPage() {
  const [types,   setTypes]   = useState<LeaveTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    // Load all types including inactive — use ?all=1 to bypass active filter
    fetchWithAuth('/api/tenant/leave/types?all=1')
      .then(r => r.json())
      .then(d => setTypes((d.types ?? []).map((t: LeaveTypeRow) => ({ ...t, _dirty: false }))))
      .catch(() => setError('Failed to load leave types.'))
      .finally(() => setLoading(false))
  }, [])

  function update(key: string, field: keyof LeaveTypeRow, value: unknown) {
    setTypes(prev =>
      prev.map(t => t.key === key ? { ...t, [field]: value, _dirty: true } : t)
    )
    setSaved(false)
  }

  async function save() {
    setSaving(true); setError(null); setSaved(false)
    try {
      const payload = types.map(({ _dirty: _, ...rest }) => rest)
      const res  = await fetchWithAuth('/api/tenant/leave/types', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ types: payload }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? `Save failed (${res.status}).`)
        return
      }
      const d = await res.json()
      setTypes((d.types ?? []).map((t: LeaveTypeRow) => ({ ...t, _dirty: false })))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Network error — please try again.')
    } finally { setSaving(false) }
  }

  const isDirty = types.some(t => t._dirty)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/tenant/leave"
            className="text-gray-500 hover:text-white transition dark:text-gray-400">
            ← Leave
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Leave Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-green-400 font-medium">Saved</span>
          )}
          <button
            onClick={save}
            disabled={saving || !isDirty}
            className="px-5 py-2 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Configure leave type entitlements and availability for your organisation.
        Changes apply to all future balance calculations.
        Leave types are based on Australian Fair Work Act 2009 defaults.
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">Loading…</div>
      ) : types.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">No leave types found.</div>
      ) : (
        <div className="space-y-4">
          {types.map(t => (
            <div
              key={t.key}
              className={`card-premium overflow-hidden transition ${
                t._dirty ? 'border-[#1A6080]/60' : t.isActive ? 'border-gray-800' : 'border-gray-800/40 opacity-60'
              }`}
            >
              {/* Row header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#1A6080]/20">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{t.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5 dark:text-gray-400">{t.accrualNote}</p>
                  </div>
                  {t._dirty && (
                    <span className="text-xs text-[#1A6080] dark:text-[#4ebac4] bg-[#0E3D52]/30 border border-[#1A6080] px-2 py-0.5 rounded-full">
                      unsaved
                    </span>
                  )}
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t.isActive ? 'Active' : 'Inactive'}</span>
                  <button
                    type="button"
                    onClick={() => update(t.key, 'isActive', !t.isActive)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      t.isActive ? 'bg-[#0E3D52]' : 'bg-gray-700'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform  dark:bg-[#0F1E2E]${
                      t.isActive ? 'translate-x-4' : 'translate-x-1'
                    }`} />
                  </button>
                </label>
              </div>

              {/* Entitlement + carry-forward fields */}
              {t.isActive && (
                <div className="px-5 py-4 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className={LABEL}>Full-Time Entitlement (days/year)</label>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={t.entitlementDaysFT}
                        onChange={e => update(t.key, 'entitlementDaysFT', parseInt(e.target.value) || 0)}
                        className={INPUT}
                      />
                      <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">0 = no entitlement · 999 = unlimited</p>
                    </div>
                    <div>
                      <label className={LABEL}>Part-Time Entitlement (days/year)</label>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={t.entitlementDaysPT}
                        onChange={e => update(t.key, 'entitlementDaysPT', parseInt(e.target.value) || 0)}
                        className={INPUT}
                      />
                      <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Usually same as FT (pro-rata calculated separately)</p>
                    </div>
                    <div>
                      <label className={LABEL}>Casual Entitlement (days/year)</label>
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={t.entitlementDaysCasual}
                        onChange={e => update(t.key, 'entitlementDaysCasual', parseInt(e.target.value) || 0)}
                        className={INPUT}
                      />
                      <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Often 0 or 2 per occasion</p>
                    </div>
                  </div>

                  {/* Carry-forward */}
                  <div className="border-t border-gray-100 dark:border-[#1A6080]/20 pt-4">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Year-end carry-forward
                    </p>
                    <div className="flex flex-wrap gap-3 items-start">
                      {/* Radio buttons for the three modes */}
                      {[
                        { id: 'unlimited', label: 'Unlimited', desc: 'All unused days roll over (FWA default for annual & personal leave)', value: null },
                        { id: 'none',      label: 'No carry-forward', desc: 'Use-it-or-lose-it — balance resets each year', value: 0 },
                        { id: 'capped',    label: 'Cap at', desc: 'Carry forward up to a set number of days', value: 'custom' as const },
                      ].map(opt => {
                        const isCapped  = opt.value === 'custom'
                        const isChecked = isCapped
                          ? (t.maxCarryForwardDays !== null && t.maxCarryForwardDays > 0)
                          : t.maxCarryForwardDays === opt.value

                        return (
                          <label
                            key={opt.id}
                            className={`flex-1 min-w-[160px] flex items-start gap-3 border rounded-xl px-4 py-3 cursor-pointer transition ${
                              isChecked
                                ? 'border-[#0E3D52] bg-[#E0EEF4] dark:bg-[#0E3D52]/20'
                                : 'border-gray-200 dark:border-[#1A6080]/30 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`cf-${t.key}`}
                              className="mt-0.5 accent-[#0E3D52] shrink-0"
                              checked={isChecked}
                              onChange={() => {
                                if (opt.value === 'custom') {
                                  // Default cap to the FT entitlement when switching to capped
                                  update(t.key, 'maxCarryForwardDays', t.entitlementDaysFT || 20)
                                } else {
                                  update(t.key, 'maxCarryForwardDays', opt.value)
                                }
                              }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800 dark:text-white">{opt.label}</span>
                                {isCapped && isChecked && (
                                  <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={t.maxCarryForwardDays ?? ''}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => update(t.key, 'maxCarryForwardDays', Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-16 bg-white dark:bg-[#0F1E2E] border border-[#4ebac4] rounded-md px-2 py-0.5 text-sm text-gray-900 dark:text-white focus:outline-none"
                                  />
                                )}
                                {isCapped && isChecked && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">days</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.desc}</p>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && types.length > 0 && (
        <div className="bg-white dark:bg-[#0F1E2E]/60 border border-gray-200 dark:border-[#1A6080]/20 rounded-xl px-5 py-4 text-xs text-gray-600 leading-relaxed dark:text-gray-400">
          <p className="font-medium text-gray-500 mb-1 dark:text-gray-400">Notes</p>
          <p>• Setting a type to <strong className="text-gray-600 dark:text-gray-400">Inactive</strong> hides it from the leave request form. Existing requests are not affected.</p>
          <p>• Entitlement changes apply to balance calculations going forward. Historical requests are recalculated on the next view.</p>
          <p>• <strong className="text-gray-600 dark:text-gray-400">999</strong> is used internally to represent unlimited leave (e.g. Unpaid Leave). It displays as ∞ in the balances view.</p>
        </div>
      )}
    </div>
  )
}
