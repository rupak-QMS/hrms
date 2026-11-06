'use client'

import { useState, useMemo } from 'react'

// ── SCHADS Award 2024-25 Pay Rates (effective 1 July 2024) ───────────────────
// Source: Social, Community, Home Care and Disability Services Industry Award 2010
// These are minimum base hourly rates. Employers must pay at least these rates.

type Classification = {
  level: string
  description: string
  baseRate: number  // $ per hour
}

// Schedule B — Social and Community Services Employee (SACS)
const SACS_CLASSIFICATIONS: Classification[] = [
  { level: 'SACS Level 1.1', description: 'Entry level — no prior experience', baseRate: 24.58 },
  { level: 'SACS Level 1.2', description: 'Entry level — 3 months experience', baseRate: 25.12 },
  { level: 'SACS Level 1.3', description: 'Entry level — 12 months experience', baseRate: 25.68 },
  { level: 'SACS Level 2.1', description: 'Cert III or equivalent', baseRate: 26.89 },
  { level: 'SACS Level 2.2', description: 'Cert III — 12 months experience', baseRate: 27.52 },
  { level: 'SACS Level 2.3', description: 'Cert III — 24 months experience', baseRate: 28.19 },
  { level: 'SACS Level 3.1', description: 'Cert IV or equivalent', baseRate: 29.61 },
  { level: 'SACS Level 3.2', description: 'Cert IV — 12 months experience', baseRate: 30.34 },
  { level: 'SACS Level 3.3', description: 'Cert IV — 24 months experience', baseRate: 31.09 },
  { level: 'SACS Level 4.1', description: 'Diploma or equivalent', baseRate: 32.68 },
  { level: 'SACS Level 4.2', description: 'Diploma — 12 months experience', baseRate: 33.52 },
  { level: 'SACS Level 4.3', description: 'Diploma — 24 months experience', baseRate: 34.40 },
  { level: 'SACS Level 5',   description: 'Advanced Diploma / Degree', baseRate: 37.89 },
  { level: 'SACS Level 6',   description: 'Degree with significant experience', baseRate: 42.47 },
  { level: 'SACS Level 7',   description: 'Senior professional / team leader', baseRate: 46.97 },
  { level: 'SACS Level 8',   description: 'Manager / specialist', baseRate: 51.47 },
]

// Schedule C — Home Care Employee
const HOME_CARE_CLASSIFICATIONS: Classification[] = [
  { level: 'Home Care Level 1', description: 'Entry level — no qualifications required', baseRate: 24.58 },
  { level: 'Home Care Level 2', description: 'Cert II or 3 months experience', baseRate: 25.68 },
  { level: 'Home Care Level 3', description: 'Cert III or equivalent', baseRate: 26.89 },
  { level: 'Home Care Level 4', description: 'Cert IV or equivalent', baseRate: 29.61 },
  { level: 'Home Care Level 5', description: 'Diploma or equivalent', baseRate: 32.68 },
  { level: 'Home Care Level 6', description: 'Advanced Diploma / team leader', baseRate: 37.89 },
]

// Schedule D — Crisis Accommodation Employee
const CRISIS_CLASSIFICATIONS: Classification[] = [
  { level: 'Crisis Level 1', description: 'Entry level', baseRate: 25.12 },
  { level: 'Crisis Level 2', description: 'Some experience / qualifications', baseRate: 26.89 },
  { level: 'Crisis Level 3', description: 'Cert III or equivalent', baseRate: 29.61 },
  { level: 'Crisis Level 4', description: 'Cert IV or equivalent', baseRate: 32.68 },
  { level: 'Crisis Level 5', description: 'Diploma or equivalent', baseRate: 37.89 },
]

const CLASSIFICATION_GROUPS = [
  { label: 'SACS (Social & Community Services)', options: SACS_CLASSIFICATIONS },
  { label: 'Home Care', options: HOME_CARE_CLASSIFICATIONS },
  { label: 'Crisis Accommodation', options: CRISIS_CLASSIFICATIONS },
]

// ── Penalty rates (as multipliers of base rate) ───────────────────────────────
type PenaltyType = {
  key: string
  label: string
  multiplier: number
  description: string
}

const PENALTY_TYPES: PenaltyType[] = [
  { key: 'ordinary',     label: 'Ordinary Time',              multiplier: 1.00, description: 'Mon–Fri 6am–8pm' },
  { key: 'early_late',   label: 'Early/Late (Mon–Fri)',        multiplier: 1.00, description: 'Mon–Fri before 6am or after 8pm — same rate but shift allowance applies' },
  { key: 'saturday',     label: 'Saturday',                   multiplier: 1.50, description: 'All hours Saturday' },
  { key: 'sunday',       label: 'Sunday',                     multiplier: 2.00, description: 'All hours Sunday' },
  { key: 'public_hol',   label: 'Public Holiday',             multiplier: 2.50, description: 'All hours on a public holiday' },
  { key: 'overtime_1',   label: 'Overtime (first 2 hrs)',      multiplier: 1.50, description: 'First 2 hours of overtime' },
  { key: 'overtime_2',   label: 'Overtime (after 2 hrs)',      multiplier: 2.00, description: 'Overtime beyond first 2 hours' },
  { key: 'sleepover',    label: 'Sleepover Allowance',        multiplier: 0,    description: 'Flat $65.03 per sleepover (2024–25 rate)' },
]

// ── Allowances ────────────────────────────────────────────────────────────────
const ALLOWANCES = [
  { key: 'broken_shift',   label: 'Broken Shift Allowance',      amount: 25.31, per: 'shift',   description: 'When shift split into 2+ parts' },
  { key: 'on_call',        label: 'On-Call Allowance',           amount: 2.65,  per: 'hour',    description: 'For each hour on-call' },
  { key: 'meal',           label: 'Meal Allowance',              amount: 17.44, per: 'instance', description: 'Per occasion required to work >1hr overtime' },
  { key: 'first_aid',      label: 'First Aid Allowance',         amount: 3.87,  per: 'week',    description: 'If appointed first aid officer' },
  { key: 'vehicle',        label: 'Km Reimbursement',            amount: 0.99,  per: 'km',      description: 'Per km for use of own vehicle' },
  { key: 'sleepover_flat', label: 'Sleepover Flat Rate',         amount: 65.03, per: 'night',   description: '2024–25 sleepover engagement rate' },
]

// ── Employment types ──────────────────────────────────────────────────────────
type EmploymentType = 'full_time' | 'part_time' | 'casual'

const CASUAL_LOADING = 0.25  // 25% casual loading on top of base rate

// ── Superannuation rate (2024–25) ──────────────────────────────────────────────
const SUPER_RATE = 0.115  // 11.5%

// ── Main Component ────────────────────────────────────────────────────────────

type AllClassification = Classification & { group: string }

function getAllClassifications(): AllClassification[] {
  return CLASSIFICATION_GROUPS.flatMap(g => g.options.map(o => ({ ...o, group: g.label })))
}

type CalculationLine = {
  type: string
  hours: number
  rate: number
  amount: number
}

export default function SCHADSCalculatorPage() {
  const [classificationLevel, setClassificationLevel] = useState('SACS Level 2.1')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time')

  // Hours per penalty type
  const [hours, setHours] = useState<Record<string, string>>({
    ordinary: '', saturday: '', sunday: '', public_hol: '',
    overtime_1: '', overtime_2: '', sleepover: '',
  })

  // Allowances to include
  const [allowances, setAllowances] = useState<Record<string, string>>({
    broken_shift: '', on_call: '', meal: '', first_aid: '', vehicle: '',
  })

  const allClassifications = useMemo(() => getAllClassifications(), [])
  const classification = allClassifications.find(c => c.level === classificationLevel) ?? allClassifications[4]

  // Base rate with casual loading if applicable
  const effectiveBaseRate = useMemo(() => {
    const base = classification.baseRate
    return employmentType === 'casual' ? base * (1 + CASUAL_LOADING) : base
  }, [classification, employmentType])

  // Calculation
  const lines = useMemo<CalculationLine[]>(() => {
    const result: CalculationLine[] = []

    for (const pt of PENALTY_TYPES) {
      if (pt.key === 'early_late') continue  // same rate, informational only
      const h = parseFloat(hours[pt.key] || '0')
      if (!h) continue

      if (pt.key === 'sleepover') {
        // Flat rate per sleepover
        result.push({ type: pt.label, hours: h, rate: 65.03, amount: h * 65.03 })
      } else {
        const rate = effectiveBaseRate * pt.multiplier
        result.push({ type: pt.label, hours: h, rate, amount: h * rate })
      }
    }

    // Allowances
    for (const al of ALLOWANCES) {
      if (al.key === 'sleepover_flat') continue  // handled above
      const qty = parseFloat(allowances[al.key] || '0')
      if (!qty) continue
      result.push({ type: `${al.label} (${qty} ${al.per})`, hours: qty, rate: al.amount, amount: qty * al.amount })
    }

    return result
  }, [hours, allowances, effectiveBaseRate])

  const grossTotal   = lines.reduce((s, l) => s + l.amount, 0)
  const superAmount  = grossTotal * SUPER_RATE
  const totalPackage = grossTotal + superAmount

  const setHour = (key: string, val: string) => setHours(h => ({ ...h, [key]: val }))
  const setAllow = (key: string, val: string) => setAllowances(a => ({ ...a, [key]: val }))

  function reset() {
    setHours({ ordinary: '', saturday: '', sunday: '', public_hol: '', overtime_1: '', overtime_2: '', sleepover: '' })
    setAllowances({ broken_shift: '', on_call: '', meal: '', first_aid: '', vehicle: '' })
  }

  function copyResult() {
    const text = [
      `SCHADS Award Rate Calculation`,
      `Classification: ${classification.level} — ${classification.description}`,
      `Employment: ${employmentType.replace('_', ' ')}`,
      `Base Rate: $${effectiveBaseRate.toFixed(2)}/hr${employmentType === 'casual' ? ' (incl. 25% casual loading)' : ''}`,
      ``,
      ...lines.map(l => `${l.type}: ${l.hours}h × $${l.rate.toFixed(2)} = $${l.amount.toFixed(2)}`),
      ``,
      `Gross Total: $${grossTotal.toFixed(2)}`,
      `Superannuation (${(SUPER_RATE * 100).toFixed(1)}%): $${superAmount.toFixed(2)}`,
      `Total Package: $${totalPackage.toFixed(2)}`,
    ].join('\n')
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="page-premium-title">SCHADS Award Rate Calculator</h1>
        <p className="page-premium-subtitle mt-0.5">
          Social, Community, Home Care &amp; Disability Services Industry Award 2010 — rates effective 1 July 2024
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          <strong>Disclaimer:</strong> This calculator provides indicative minimum award rates only. Always verify against the current Fair Work Commission determination and your enterprise agreement. Rates are updated annually on 1 July. This tool does not constitute legal or payroll advice.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Inputs */}
        <div className="lg:col-span-2 space-y-5">

          {/* Classification & Employment Type */}
          <div className="card-premium rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Classification</h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Award Classification</label>
              <select
                value={classificationLevel}
                onChange={e => setClassificationLevel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                {CLASSIFICATION_GROUPS.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map(opt => (
                      <option key={opt.level} value={opt.level}>
                        {opt.level} — ${opt.baseRate.toFixed(2)}/hr
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {classification && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{classification.description}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Employment Type</label>
              <div className="flex gap-3">
                {(['full_time', 'part_time', 'casual'] as const).map(et => (
                  <label key={et} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="empType" value={et}
                      checked={employmentType === et}
                      onChange={() => setEmploymentType(et)}
                      className="accent-indigo-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{et.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
              {employmentType === 'casual' && (
                <p className="mt-1 text-xs text-[#1A6080] dark:text-[#4ebac4]">25% casual loading applied — effective rate: ${effectiveBaseRate.toFixed(2)}/hr</p>
              )}
            </div>

            <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Base Rate</span>
                <span className="page-premium-title">${effectiveBaseRate.toFixed(2)}<span className="text-sm font-normal text-gray-500">/hr</span></span>
              </div>
            </div>
          </div>

          {/* Hours by penalty type */}
          <div className="card-premium rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Hours Worked</h2>
            <div className="space-y-3">
              {PENALTY_TYPES.filter(pt => pt.key !== 'early_late').map(pt => {
                const h = parseFloat(hours[pt.key] || '0')
                const rate = pt.key === 'sleepover' ? 65.03 : effectiveBaseRate * pt.multiplier
                const subtotal = h * rate
                return (
                  <div key={pt.key} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-5">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{pt.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{pt.description}</p>
                    </div>
                    <div className="col-span-2 text-right text-xs text-gray-500 dark:text-gray-400">
                      {pt.key === 'sleepover' ? '$65.03 flat' : `×${pt.multiplier.toFixed(2)} = $${rate.toFixed(2)}`}
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number" min="0" step="0.5"
                        value={hours[pt.key] ?? ''}
                        onChange={e => setHour(pt.key, e.target.value)}
                        placeholder={pt.key === 'sleepover' ? '# nights' : '# hours'}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-right"
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {subtotal > 0 ? `$${subtotal.toFixed(2)}` : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Allowances */}
          <div className="card-premium rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Allowances</h2>
            <div className="space-y-3">
              {ALLOWANCES.filter(a => a.key !== 'sleepover_flat').map(al => {
                const qty = parseFloat(allowances[al.key] || '0')
                const subtotal = qty * al.amount
                return (
                  <div key={al.key} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-5">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{al.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{al.description}</p>
                    </div>
                    <div className="col-span-2 text-right text-xs text-gray-500 dark:text-gray-400">
                      ${al.amount.toFixed(2)}/{al.per}
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number" min="0" step={al.key === 'vehicle' ? '1' : '0.5'}
                        value={allowances[al.key] ?? ''}
                        onChange={e => setAllow(al.key, e.target.value)}
                        placeholder={`# ${al.per}s`}
                        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm text-right"
                      />
                    </div>
                    <div className="col-span-2 text-right text-sm font-medium text-gray-900 dark:text-white">
                      {subtotal > 0 ? `$${subtotal.toFixed(2)}` : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right — Summary */}
        <div className="space-y-5">
          <div className="card-premium rounded-2xl p-5 space-y-4 sticky top-6">
            <h2 className="font-semibold text-gray-900 dark:text-white">Pay Summary</h2>

            {lines.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Enter hours above to calculate</p>
            ) : (
              <>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <div className="text-xs text-gray-600 dark:text-gray-400 flex-1">{l.type}</div>
                      <div className="text-xs font-medium text-gray-900 dark:text-white whitespace-nowrap">${l.amount.toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Gross Earnings</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">${grossTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Super ({(SUPER_RATE * 100).toFixed(1)}%)</span>
                    <span className="text-sm text-gray-900 dark:text-white">${superAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Total Package</span>
                    <span className="text-lg font-bold text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]">${totalPackage.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <button onClick={copyResult}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    📋 Copy Result
                  </button>
                  <button onClick={reset}
                    className="w-full px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                    Reset
                  </button>
                </div>
              </>
            )}

            {/* Classification summary */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400  mb-2">Rate Reference</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Base</span>
                  <span className="text-gray-900 dark:text-white">${effectiveBaseRate.toFixed(2)}/hr</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Saturday (×1.5)</span>
                  <span className="text-gray-900 dark:text-white">${(effectiveBaseRate * 1.5).toFixed(2)}/hr</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Sunday (×2.0)</span>
                  <span className="text-gray-900 dark:text-white">${(effectiveBaseRate * 2.0).toFixed(2)}/hr</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Public Holiday (×2.5)</span>
                  <span className="text-gray-900 dark:text-white">${(effectiveBaseRate * 2.5).toFixed(2)}/hr</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Casual (base ×1.25)</span>
                  <span className="text-gray-900 dark:text-white">${(classification.baseRate * 1.25).toFixed(2)}/hr</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick penalty rate table */}
          <div className="card-premium rounded-2xl p-5">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">All Penalty Rates</h2>
            <table className="table-premium">
              <thead>
                <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left pb-2">Period</th>
                  <th className="text-right pb-2">%</th>
                  <th className="text-right pb-2">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {PENALTY_TYPES.map(pt => (
                  <tr key={pt.key}>
                    <td className="py-1.5 text-gray-700 dark:text-gray-300">{pt.label}</td>
                    <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">
                      {pt.key === 'sleepover' ? 'flat' : `${(pt.multiplier * 100).toFixed(0)}%`}
                    </td>
                    <td className="py-1.5 text-right font-medium text-gray-900 dark:text-white">
                      {pt.key === 'sleepover' ? '$65.03' : `$${(effectiveBaseRate * pt.multiplier).toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
