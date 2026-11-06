'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ── SOW-accurate module catalogue ────────────────────────────────────────────
const ALL_MODULES = [
  { id:  1, name: 'Enterprise Dashboard',               category: 'Core',         starterOn: true,  proOn: true,  enterpriseOn: true  },
  { id:  2, name: 'Employee Master Profiles',            category: 'Core',         starterOn: true,  proOn: true,  enterpriseOn: true  },
  { id:  3, name: 'RBAC & Custom Authentication',        category: 'Core',         starterOn: true,  proOn: true,  enterpriseOn: true  },
  { id:  4, name: 'Audit Logging',                      category: 'Core',         starterOn: true,  proOn: true,  enterpriseOn: true  },
  { id:  5, name: 'Document Management System',          category: 'Core',         starterOn: true,  proOn: true,  enterpriseOn: true  },
  { id:  6, name: 'Pre-Employment Screening',            category: 'Compliance',   starterOn: true,  proOn: true,  enterpriseOn: true  },
  { id:  7, name: 'Compliance Lock System',              category: 'Compliance',   starterOn: true,  proOn: true,  enterpriseOn: true  },
  { id:  8, name: 'Ongoing Compliance Tracking',         category: 'Compliance',   starterOn: true,  proOn: true,  enterpriseOn: true  },
  { id:  9, name: 'Onboarding & Induction',              category: 'Compliance',   starterOn: true,  proOn: true,  enterpriseOn: true  },
  { id: 10, name: 'Training Management & LMS',           category: 'Learning',     starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 11, name: 'Competency Management',               category: 'Learning',     starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 12, name: 'Supervision Management',              category: 'Learning',     starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 13, name: 'Workforce Planning & Role Design',    category: 'Talent',       starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 14, name: 'Recruitment & Applicant Tracking',    category: 'Talent',       starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 15, name: 'Employment Contracting & E-Sign',     category: 'Talent',       starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 16, name: 'Probation & Performance Management',  category: 'Performance',  starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 17, name: 'WHS & Injury Management',             category: 'Safety',       starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 18, name: 'Grievance & Investigation Mgmt',      category: 'Safety',       starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 19, name: 'Separation & Exit Management',        category: 'Compliance',   starterOn: false, proOn: true,  enterpriseOn: true  },
  { id: 20, name: 'Reporting & Analytics',               category: 'Intelligence', starterOn: false, proOn: false, enterpriseOn: true  },
  { id: 21, name: 'Employee Experience & Benefits',      category: 'Experience',   starterOn: false, proOn: false, enterpriseOn: true  },
  { id: 22, name: 'Recognition & Rewards',               category: 'Experience',   starterOn: false, proOn: false, enterpriseOn: true  },
  { id: 23, name: 'Referral Program',                    category: 'Experience',   starterOn: false, proOn: false, enterpriseOn: true  },
  { id: 24, name: 'Diversity, Equity & Inclusion',       category: 'Experience',   starterOn: false, proOn: false, enterpriseOn: true  },
  { id: 25, name: 'Employee Voice & Engagement',         category: 'Experience',   starterOn: false, proOn: false, enterpriseOn: true  },
  { id: 26, name: 'Asset & Equipment Register',          category: 'Operations',   starterOn: false, proOn: false, enterpriseOn: true  },
  { id: 27, name: 'Rostering & Attendance Integration',  category: 'Operations',   starterOn: false, proOn: false, enterpriseOn: true  },
  { id: 28, name: 'Payroll & Award Compliance',          category: 'Operations',   starterOn: false, proOn: false, enterpriseOn: true  },
]

const CATEGORIES = ['Core', 'Compliance', 'Learning', 'Talent', 'Performance', 'Safety', 'Intelligence', 'Experience', 'Operations'] as const

const CATEGORY_STYLE: Record<string, { border: string; header: string; badge: string }> = {
  Core:         { border: 'border-[#1A6080]/30 dark:border-[#1A6080]/60',   header: 'bg-[#E0EEF4] dark:bg-[#0E3D52]/30',   badge: 'bg-[#E0EEF4] dark:bg-[#0E3D52]/30 text-[#0E3D52] dark:text-[#7dcfd7]' },
  Compliance:   { border: 'border-green-200 dark:border-green-800',  header: 'bg-green-50 dark:bg-green-950/60',  badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200' },
  Learning:     { border: 'border-[#b8d4e0] dark:border-[#1A6080] dark:border-[#1A6080]', header: 'bg-[#E0EEF4] dark:bg-[#0E3D52]/40', badge: 'bg-[#E0EEF4] dark:bg-[#0E3D52] text-[#0E3D52] dark:text-[#9ccfda]' },
  Talent:       { border: 'border-yellow-200 dark:border-yellow-800', header: 'bg-yellow-50 dark:bg-yellow-950/60', badge: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200' },
  Performance:  { border: 'border-orange-200 dark:border-orange-800', header: 'bg-orange-50 dark:bg-orange-950/60', badge: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200' },
  Safety:       { border: 'border-red-200 dark:border-red-800',    header: 'bg-red-50 dark:bg-red-950/60',    badge: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200' },
  Intelligence: { border: 'border-cyan-200 dark:border-cyan-800',   header: 'bg-cyan-50 dark:bg-cyan-950/60',   badge: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-200' },
  Experience:   { border: 'border-pink-200 dark:border-pink-800',   header: 'bg-pink-50 dark:bg-pink-950/60',   badge: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-200' },
  Operations:   { border: 'border-teal-200 dark:border-teal-800',   header: 'bg-teal-50 dark:bg-teal-950/60',   badge: 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-200' },
}

const TIER_DEFAULTS: Record<string, number[]> = {
  starter:      ALL_MODULES.filter(m => m.starterOn).map(m => m.id),
  professional: ALL_MODULES.filter(m => m.proOn).map(m => m.id),
  enterprise:   ALL_MODULES.filter(m => m.enterpriseOn).map(m => m.id),
}

function tierBadge(mod: typeof ALL_MODULES[0]) {
  if (mod.starterOn)      return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700">Starter</span>
  if (mod.proOn)          return <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E0EEF4] dark:bg-[#0E3D52]/30 text-[#0E3D52] dark:text-[#4ebac4] border border-[#1A6080]/50 dark:border-[#1A6080]">Pro</span>
  if (mod.enterpriseOn)   return <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E0EEF4] dark:bg-[#0E3D52]/60 text-[#0E3D52] dark:text-[#7dcfd7] border border-[#b8d4e0] dark:border-[#1A6080]">Enterprise</span>
  return null
}

type State = { id: number; isEnabled: boolean }

export default function ModulesPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [states,      setStates]      = useState<State[]>([])
  const [tenantName,  setTenantName]  = useState('')
  const [tenantTier,  setTenantTier]  = useState('enterprise')
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [search,      setSearch]      = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/super-admin/clients/${id}`).then(r => r.json()),
      fetch(`/api/super-admin/clients/${id}/modules`).then(r => r.json()),
    ]).then(([clientData, modData]) => {
      setTenantName(clientData.tenant?.name ?? '')
      setTenantTier(clientData.tenant?.tier ?? 'enterprise')
      const dbStates: State[] = modData.modules?.map((m: any) => ({ id: m.moduleId, isEnabled: m.isEnabled })) ?? []
      // Ensure all 28 modules are represented
      const merged = ALL_MODULES.map(m => {
        const db = dbStates.find(s => s.id === m.id)
        return { id: m.id, isEnabled: db ? db.isEnabled : m.starterOn }
      })
      setStates(merged)
      setLoading(false)
    })
  }, [id])

  function toggle(moduleId: number) {
    if (moduleId <= 5) return // Core modules locked
    setStates(s => s.map(x => x.id === moduleId ? { ...x, isEnabled: !x.isEnabled } : x))
  }

  function applyTierDefaults() {
    const defaults = TIER_DEFAULTS[tenantTier] ?? TIER_DEFAULTS.enterprise
    setStates(s => s.map(x => ({ ...x, isEnabled: x.id <= 5 ? true : defaults.includes(x.id) })))
  }

  function setCategoryAll(category: string, on: boolean) {
    const ids = ALL_MODULES.filter(m => m.category === category && m.id > 5).map(m => m.id)
    setStates(s => s.map(x => ids.includes(x.id) ? { ...x, isEnabled: on } : x))
  }

  async function saveModules(andContinue = false) {
    setSaving(true)
    await fetch(`/api/super-admin/clients/${id}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modules: states.map(s => ({ moduleId: s.id, isEnabled: s.isEnabled })) }),
    })
    setSaving(false)
    if (andContinue) {
      router.push(`/super-admin/clients/${id}?tab=theme`)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const enabledCount = states.filter(s => s.isEnabled).length
  const searchLower  = search.toLowerCase()

  if (loading) return <div className="text-gray-600 dark:text-gray-400 py-10">Loading modules…</div>

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href={`/super-admin/clients/${id}`} className="text-gray-500 hover:text-gray-600 dark:text-gray-300 text-sm transition dark:text-gray-400">← Edit Client</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Module Configuration</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            <span className="text-[#0E3D52] dark:text-[#7dcfd7] font-medium">{tenantName}</span>
            {' · '}
            <span className={`text-xs font-semibold  ${
              tenantTier === 'enterprise' ? 'text-[#0E3D52] dark:text-[#4ebac4]' : tenantTier === 'professional' ? 'text-[#1A6080] dark:text-[#4ebac4]' : 'text-green-600 dark:text-green-400'
            }`}>{tenantTier}</span>
            {' · '}
            <span className="text-gray-900 dark:text-white font-semibold">{enabledCount}</span>
            <span className="text-gray-500 dark:text-gray-400"> / 28 modules enabled</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={applyTierDefaults}
            className="text-xs border border-[#b8d4e0] dark:border-[#1A6080] text-[#0E3D52] dark:text-[#7dcfd7] hover:bg-[#E0EEF4] dark:bg-[#0E3D52]/20 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
          >
            ↺ Apply {tenantTier.charAt(0).toUpperCase() + tenantTier.slice(1)} Defaults
          </button>
          <button
            onClick={() => saveModules(false)}
            disabled={saving}
            className="text-xs bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition"
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tier legend */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-4 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-semibold text-gray-600 dark:text-gray-300">Tier includes:</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Starter — modules 01–09</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1A6080]" />Professional — modules 01–19</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E0EEF4]0" />Enterprise — all 28 modules</span>
        <span className="flex items-center gap-1.5"><span className="text-gray-500 dark:text-gray-400"></span> Core modules always on</span>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search modules…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-[#1A6080]/30 rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]"
      />

      {/* Module categories */}
      <div className="space-y-4">
        {CATEGORIES.map(category => {
          const mods = ALL_MODULES.filter(m =>
            m.category === category &&
            (!searchLower || m.name.toLowerCase().includes(searchLower) || category.toLowerCase().includes(searchLower))
          )
          if (mods.length === 0) return null
          const isCore  = category === 'Core'
          const style   = CATEGORY_STYLE[category]
          const enabled = mods.filter(m => states.find(s => s.id === m.id)?.isEnabled).length

          return (
            <div key={category} className={`border ${style.border} rounded-xl overflow-hidden`}>
              {/* Category header */}
              <div className={`flex items-center justify-between px-5 py-3 ${style.header} border-b ${style.border}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{category}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{enabled}/{mods.length} enabled</span>
                </div>
                {!isCore && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCategoryAll(category, true)}
                      className="text-xs text-green-400 hover:text-green-700 dark:text-green-300 transition"
                    >All On</button>
                    <span className="text-gray-700 dark:text-gray-300">|</span>
                    <button
                      onClick={() => setCategoryAll(category, false)}
                      className="text-xs text-red-400 hover:text-red-700 dark:text-red-300 transition"
                    >All Off</button>
                  </div>
                )}
              </div>

              {/* Modules list */}
              <div className="divide-y divide-gray-200 dark:divide-[#1A6080]/20/60 bg-white dark:bg-gray-900">
                {mods.map(mod => {
                  const state   = states.find(s => s.id === mod.id)
                  const enabled = state?.isEnabled ?? false
                  const locked  = isCore
                  const num     = String(mod.id).padStart(2, '0')

                  return (
                    <div key={mod.id} className={`flex items-center justify-between px-5 py-3 transition ${!locked && !enabled ? 'opacity-60' : ''} hover:bg-gray-100 dark:hover:bg-[#0E3D52]/30/20`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-gray-500 shrink-0 w-6 dark:text-gray-400">{num}</span>
                        <span className={`text-sm ${enabled ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}>{mod.name}</span>
                        <span className="shrink-0">{tierBadge(mod)}</span>
                        {locked && <span className="text-gray-600 text-xs shrink-0 dark:text-gray-400">always on</span>}
                      </div>

                      <button
                        onClick={() => toggle(mod.id)}
                        disabled={locked}
                        aria-label={`Toggle ${mod.name}`}
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none ml-4 ${
                          enabled ? 'bg-[#0E3D52]' : 'bg-gray-200 dark:bg-gray-700'
                        } ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        <span className={`inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow transition-transform  dark:bg-gray-900${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer actions */}
      <div className="flex gap-3 pb-6">
        <button
          onClick={() => saveModules(false)}
          disabled={saving}
          className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition"
        >
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
        <button
          onClick={() => saveModules(true)}
          disabled={saving}
          className="border border-[#b8d4e0] dark:border-[#1A6080] text-[#0E3D52] dark:text-[#7dcfd7] hover:bg-[#E0EEF4] dark:bg-[#0E3D52]/20 text-sm font-medium px-6 py-2.5 rounded-lg transition"
        >
          Save & Configure Theme →
        </button>
        <Link
          href="/super-admin/clients"
          className="border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white text-sm px-4 py-2.5 rounded-lg transition"
        >
          Done
        </Link>
      </div>
    </div>
  )
}
