'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Client = {
  id: string
  name: string
  slug: string
  tier: string
  isActive: boolean
  createdAt: string
}

const TIER_CONFIG = {
  starter: {
    label:    'Starter',
    modules:  11,
    color:    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    badge:    'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200',
    price:    57,
    features: 'Core + Compliance (11 modules)',
  },
  professional: {
    label:    'Professional',
    modules:  20,
    color:    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    badge:    'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
    price:    120,
    features: '+ Talent, Learning, Performance, Safety (20 modules)',
  },
  enterprise: {
    label:    'Enterprise',
    modules:  28,
    color:    'bg-[#E0EEF4] dark:bg-[#0E3D52]/20 text-[#0E3D52] dark:text-[#7dcfd7] border-[#b8d4e0] dark:border-[#1A6080] dark:border-[#1A6080]',
    badge:    'bg-[#E0EEF4] dark:bg-[#0E3D52] text-[#0E3D52] dark:text-[#9ccfda]',
    price:    217,
    features: 'All 28 modules',
  },
}

export default function BillingPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/super-admin/clients')
      .then(r => r.json())
      .then(d => { setClients(d.clients ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const activeClients = clients.filter(c => c.isActive)
  const totalMRR = activeClients.reduce((sum, c) => {
    const cfg = TIER_CONFIG[c.tier as keyof typeof TIER_CONFIG]
    return sum + (cfg?.price ?? 0)
  }, 0)

  const tierBreakdown = {
    starter:      activeClients.filter(c => c.tier === 'starter').length,
    professional: activeClients.filter(c => c.tier === 'professional').length,
    enterprise:   activeClients.filter(c => c.tier === 'enterprise').length,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing & Subscriptions</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Per-tenant subscription status and tier overview</p>
      </div>

      {/* MRR Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Monthly Revenue</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">${totalMRR.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">AUD / month</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Active Subscriptions</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeClients.length}</p>
          <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">of {clients.length} total</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Avg Revenue / Client</p>
          <p className="text-3xl font-bold text-[#0E3D52] dark:text-[#4ebac4]">
            ${activeClients.length ? Math.round(totalMRR / activeClients.length) : 0}
          </p>
          <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">AUD / month</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Annual Run Rate</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">${(totalMRR * 12).toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">AUD / year</p>
        </div>
      </div>

      {/* Tier Breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400  mb-4">Subscription Tiers</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(Object.entries(TIER_CONFIG) as [string, typeof TIER_CONFIG.starter][]).map(([key, cfg]) => (
            <div key={key} className={`border rounded-xl p-5 ${cfg.color}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold">{cfg.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                  {tierBreakdown[key as keyof typeof tierBreakdown]} client{tierBreakdown[key as keyof typeof tierBreakdown] !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-2xl font-bold mb-1">${cfg.price}<span className="text-sm font-normal opacity-70">/mo</span></p>
              <p className="text-xs opacity-70 mb-3">{cfg.features}</p>
              <div className="border-t border-white/10 pt-3">
                <p className="text-xs opacity-60">{cfg.modules} modules included</p>
                <p className="text-xs opacity-60 mt-0.5">
                  Revenue: ${(tierBreakdown[key as keyof typeof tierBreakdown] * cfg.price).toLocaleString()} AUD/mo
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Tenant Table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400  mb-4">Client Subscriptions</h2>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Modules</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Monthly</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Since</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 ">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">Loading…</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">No clients yet</td></tr>
              ) : clients.map(client => {
                const cfg = TIER_CONFIG[client.tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.starter
                return (
                  <tr key={client.id} className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/20 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{client.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{client.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{cfg.modules}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-medium">${cfg.price} AUD</td>
                    <td className="px-4 py-3">
                      {client.isActive ? (
                        <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">Active</span>
                      ) : (
                        <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">Suspended</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs dark:text-gray-400">
                      {new Date(client.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/super-admin/clients/${client.id}`}
                        className="text-xs text-[#4ebac4] hover:text-[#0E3D52] dark:text-[#7dcfd7] transition"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {!loading && clients.length > 0 && (
              <tfoot>
                <tr className="border-t border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/30">
                  <td colSpan={3} className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 font-semibold">TOTAL (active clients)</td>
                  <td className="px-4 py-3 text-green-600 dark:text-green-400 font-bold">${totalMRR} AUD/mo</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
