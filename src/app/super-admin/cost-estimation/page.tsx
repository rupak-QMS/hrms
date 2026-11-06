'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type ModuleBreakdown = { id: number; name: string; priceAUD: number }

type ClientCost = {
  id:                  string
  name:                string
  slug:                string
  tier:                string
  isActive:            boolean
  country:             string
  countryName:         string
  currency:            string
  symbol:              string
  headcount:           number
  enabledModules:      number
  moduleBreakdown:     ModuleBreakdown[]
  perSeatMonthlyAUD:   number
  perSeatMonthlyCurr:  number
  totalMonthlyAUD:     number
  totalMonthlyCurr:    number
  totalAnnualAUD:      number
  totalAnnualCurr:     number
}

function fmt(n: number, symbol: string) {
  return `${symbol}${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtAUD(n: number) {
  return `A$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function CostEstimationPage() {
  const [clients,   setClients]   = useState<ClientCost[]>([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [filter,    setFilter]    = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy,    setSortBy]    = useState<'name' | 'monthly' | 'annual' | 'modules' | 'headcount'>('annual')

  useEffect(() => {
    fetch('/api/super-admin/cost-estimation')
      .then(r => r.json())
      .then(d => { setClients(d.clients ?? []); setLoading(false) })
  }, [])

  const filtered = clients
    .filter(c => filter === 'all' ? true : filter === 'active' ? c.isActive : !c.isActive)
    .sort((a, b) => {
      if (sortBy === 'name')      return a.name.localeCompare(b.name)
      if (sortBy === 'monthly')   return b.totalMonthlyAUD - a.totalMonthlyAUD
      if (sortBy === 'annual')    return b.totalAnnualAUD  - a.totalAnnualAUD
      if (sortBy === 'modules')   return b.enabledModules  - a.enabledModules
      if (sortBy === 'headcount') return b.headcount       - a.headcount
      return 0
    })

  const totalMonthlyAUD = filtered.reduce((s, c) => s + c.totalMonthlyAUD, 0)
  const totalAnnualAUD  = filtered.reduce((s, c) => s + c.totalAnnualAUD,  0)

  if (loading) return <div className="text-gray-600 dark:text-gray-400 text-sm p-6">Loading cost estimates…</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cost Estimation</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Approximate platform cost per client based on enabled modules, headcount, and country currency.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total portfolio (monthly)</p>
          <p className="text-lg font-bold text-[#0E3D52] dark:text-[#7dcfd7]">{fmtAUD(totalMonthlyAUD)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{fmtAUD(totalAnnualAUD)} / year</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{clients.length}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Total clients</p>
        </div>
        <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{clients.filter(c => c.isActive).length}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Active</p>
        </div>
        <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#0E3D52] dark:text-[#4ebac4]">{fmtAUD(totalMonthlyAUD)}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Monthly (AUD)</p>
        </div>
        <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#0E3D52] dark:text-[#4ebac4]">{fmtAUD(totalAnnualAUD)}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Annual (AUD)</p>
        </div>
      </div>

      {/* Filters + Sort */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-[#1A6080]/30">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs capitalize ${filter === f ? 'bg-[#0E3D52] text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white'}`}>
              {f}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 rounded-lg px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none">
          <option value="annual">Sort: Annual cost ↓</option>
          <option value="monthly">Sort: Monthly cost ↓</option>
          <option value="modules">Sort: Modules ↓</option>
          <option value="headcount">Sort: Headcount ↓</option>
          <option value="name">Sort: Name A–Z</option>
        </select>
        <p className="text-xs text-gray-500 ml-auto dark:text-gray-400">{filtered.length} client{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Client list */}
      <div className="space-y-3">
        {filtered.map(client => {
          const isExp = expanded === client.id
          const sameAUD = client.currency === 'AUD'
          return (
            <div key={client.id}
              className={`bg-white dark:bg-[#0F1E2E] border rounded-xl overflow-hidden transition ${isExp ? 'border-[#b8d4e0] dark:border-[#1A6080]' : 'border-gray-200 dark:border-[#1A6080]/20'}`}>
              {/* Row */}
              <div className="flex items-center gap-4 p-5 cursor-pointer" onClick={() => setExpanded(isExp ? null : client.id)}>
                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{client.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${client.isActive ? 'bg-green-50 dark:bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-[#0A1929] text-gray-600 dark:text-gray-400'}`}>
                      {client.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#0A1929] text-gray-600 dark:text-gray-400 capitalize">{client.tier}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{client.countryName} · {client.currency} · {client.headcount || '—'} staff · {client.enabledModules} modules</p>
                </div>

                {/* Per seat */}
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Per seat / month</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(client.perSeatMonthlyCurr, client.symbol)}</p>
                  {!sameAUD && <p className="text-xs text-gray-600 dark:text-gray-400">{fmtAUD(client.perSeatMonthlyAUD)} AUD</p>}
                </div>

                {/* Monthly */}
                <div className="text-right hidden md:block">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Monthly</p>
                  <p className="text-sm font-semibold text-[#0E3D52] dark:text-[#7dcfd7]">{fmt(client.totalMonthlyCurr, client.symbol)}</p>
                  {!sameAUD && <p className="text-xs text-gray-600 dark:text-gray-400">{fmtAUD(client.totalMonthlyAUD)}</p>}
                </div>

                {/* Annual */}
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Annual</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white">{fmt(client.totalAnnualCurr, client.symbol)}</p>
                  {!sameAUD && <p className="text-xs text-gray-600 dark:text-gray-400">{fmtAUD(client.totalAnnualAUD)}</p>}
                </div>

                {/* Expand toggle */}
                <div className="text-gray-500 text-xs ml-2 dark:text-gray-400">
                  {isExp ? '▲' : '▼'}
                </div>
              </div>

              {/* Expanded module breakdown */}
              {isExp && (
                <div className="border-t border-gray-200 dark:border-[#1A6080]/20 px-5 pb-5 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 ">Module Breakdown</p>
                    <Link href={`/super-admin/clients/${client.id}/integrations`}
                      className="text-xs text-[#4ebac4] hover:text-[#0E3D52] dark:text-[#7dcfd7]">
                      View Integrations →
                    </Link>
                  </div>

                  {client.moduleBreakdown.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No modules enabled yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {client.moduleBreakdown
                        .sort((a, b) => b.priceAUD - a.priceAUD)
                        .map(m => {
                          const mCurr = m.priceAUD === 0 ? 0 : Math.round(m.priceAUD * (client.totalMonthlyCurr / Math.max(client.totalMonthlyAUD, 0.01)) * 100) / 100
                          return (
                            <div key={m.id} className="bg-gray-100 dark:bg-[#0A1929] rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{m.name}</span>
                              <span className="text-xs font-semibold text-gray-900 dark:text-white shrink-0">
                                {m.priceAUD === 0 ? 'Free' : `${client.symbol}${mCurr.toFixed(2)}`}
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  )}

                  {/* Totals row */}
                  {client.headcount > 0 && (
                    <div className="mt-4 flex gap-6 text-xs border-t border-gray-200 dark:border-[#1A6080]/20 pt-3">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Headcount: </span>
                        <span className="text-gray-900 dark:text-white font-semibold">{client.headcount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Per seat/mo: </span>
                        <span className="text-gray-900 dark:text-white font-semibold">{fmt(client.perSeatMonthlyCurr, client.symbol)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Monthly total: </span>
                        <span className="text-[#0E3D52] dark:text-[#7dcfd7] font-semibold">{fmt(client.totalMonthlyCurr, client.symbol)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Annual total: </span>
                        <span className="text-gray-900 dark:text-white font-bold">{fmt(client.totalAnnualCurr, client.symbol)}</span>
                      </div>
                    </div>
                  )}

                  {client.headcount === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 bg-amber-50 dark:bg-amber-100 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded px-3 py-2">
                      Headcount not set — costs shown as per-seat. Update the client profile to see total estimates.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white dark:bg-[#0F1E2E] border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-10 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">No clients found.</p>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-4 dark:text-gray-400">
        * Estimates based on per-module pricing in local currency using AUD base rates. Actual invoicing may vary.
        Currency conversion rates are approximate.
      </p>
    </div>
  )
}
