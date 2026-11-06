'use client'

import { useEffect, useState } from 'react'

type ModuleStat = {
  id: number
  name: string
  category: string
  enabledCount: number
  totalTenants: number
  percentage: number
  enabledFor: string[]
}

const CATEGORY_COLORS: Record<string, string> = {
  Core:         'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Compliance:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  Learning:     'bg-[#E0EEF4] dark:bg-[#0E3D52]/20 text-[#0E3D52] dark:text-[#7dcfd7] border-[#b8d4e0] dark:border-[#1A6080] dark:border-[#1A6080]',
  Talent:       'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  Performance:  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  Safety:       'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  Intelligence: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  Experience:   'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  Operations:   'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
}

const BAR_COLORS: Record<string, string> = {
  Core: 'bg-blue-500', Compliance: 'bg-green-500', Learning: 'bg-[#E0EEF4]0',
  Talent: 'bg-yellow-500', Performance: 'bg-orange-500', Safety: 'bg-red-500',
  Intelligence: 'bg-cyan-500', Experience: 'bg-pink-500', Operations: 'bg-teal-500',
}

export default function ModulesPage() {
  const [modules, setModules]       = useState<ModuleStat[]>([])
  const [tenantCount, setTenantCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [expanded, setExpanded]     = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/super-admin/modules')
      .then(async r => {
        if (!r.ok) {
          const msg = r.status === 401
            ? 'Not authenticated — please log in to the super admin portal.'
            : `Server error (HTTP ${r.status})`
          throw new Error(msg)
        }
        return r.json()
      })
      .then(d => {
        setModules(d.modules ?? [])
        setTenantCount(d.tenantCount ?? 0)
        setLoading(false)
      })
      .catch(err => {
        setFetchError(err instanceof Error ? err.message : 'Failed to load module data.')
        setLoading(false)
      })
  }, [])

  const categories = ['All', ...Array.from(new Set(modules.map(m => m.category)))]
  const filtered = categoryFilter === 'All' ? modules : modules.filter(m => m.category === categoryFilter)

  const totalEnabled = modules.reduce((s, m) => s + m.enabledCount, 0)
  const maxPossible  = modules.length * tenantCount

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Module Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Usage of all 28 feature modules across {tenantCount} client{tenantCount !== 1 ? 's' : ''}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Modules</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">28</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Active Toggles</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalEnabled}</p>
          <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">of {maxPossible} possible</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Avg Modules/Client</p>
          <p className="text-2xl font-bold text-[#0E3D52] dark:text-[#4ebac4]">
            {tenantCount ? Math.round(totalEnabled / tenantCount) : 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Platform Adoption</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {maxPossible ? Math.round((totalEnabled / maxPossible) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              categoryFilter === cat
                ? 'bg-[#1A6080] border-[#0E3D52] text-white'
                : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:border-gray-500'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Module list */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400  w-8">#</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Module</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Adoption</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400  w-48">Usage</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">Loading…</td></tr>
            ) : fetchError ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <p className="text-2xl mb-2">⚠️</p>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{fetchError}</p>
                </td>
              </tr>
            ) : filtered.map(mod => (
              <>
                <tr
                  key={mod.id}
                  className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/20 cursor-pointer transition"
                  onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                >
                  <td className="px-4 py-3 text-gray-600 text-xs dark:text-gray-400">{mod.id}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200 font-medium">{mod.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[mod.category] ?? ''}`}>
                      {mod.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-semibold ${mod.percentage === 100 ? 'text-green-600 dark:text-green-400' : mod.percentage > 50 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {mod.enabledCount}/{tenantCount}
                    </span>
                    <span className="text-xs text-gray-500 ml-1 dark:text-gray-400">({mod.percentage}%)</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${BAR_COLORS[mod.category] ?? 'bg-[#E0EEF4]0'}`}
                          style={{ width: `${mod.percentage}%` }}
                        />
                      </div>
                      {mod.enabledFor.length > 0 && (
                        <span className="text-[#0E3D52] dark:text-[#4ebac4] text-xs">{expanded === mod.id ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded === mod.id && mod.enabledFor.length > 0 && (
                  <tr key={`${mod.id}-clients`} className="bg-gray-100 dark:bg-gray-800/20 border-b border-gray-200 dark:border-gray-800/50">
                    <td colSpan={5} className="px-6 py-2">
                      <p className="text-xs text-gray-500 mb-1 dark:text-gray-400">Enabled for:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {mod.enabledFor.map(name => (
                          <span key={name} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                            {name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
