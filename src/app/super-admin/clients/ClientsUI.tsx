'use client'

import { useState } from 'react'
import Link from 'next/link'

export type Client = {
  id: string
  name: string
  slug: string
  tier: string
  isActive: boolean
  primaryColor: string
  logoUrl: string | null
  createdAt: string
}

type ConfirmState = {
  type: 'delete' | 'impersonate'
  clientId: string
  clientName: string
} | null

const TIER_COLORS: Record<string, string> = {
  enterprise:   'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200',
  professional: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
  starter:      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
}

function ConfirmModal({ state, onConfirm, onCancel }: {
  state: ConfirmState
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!state) return null
  const isDelete = state.type === 'delete'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
          {isDelete ? 'Delete client?' : 'Login as tenant?'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          {isDelete
            ? `Delete "${state.clientName}"? This cannot be undone.`
            : `Open ${state.clientName}'s portal as an impersonated user. You will get a 1-hour session.`}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg font-medium text-white transition ${
              isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isDelete ? 'Delete' : 'Open portal'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ClientsUI({ initialClients, dbError }: { initialClients: Client[]; dbError?: string | null }) {
  const [clients, setClients]             = useState<Client[]>(initialClients)
  const [search, setSearch]               = useState('')
  const [impersonating, setImpersonating] = useState<string | null>(null)
  const [confirm, setConfirm]             = useState<ConfirmState>(null)

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/super-admin/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !current }),
    })
    setClients(c => c.map(x => x.id === id ? { ...x, isActive: !current } : x))
  }

  function deleteClient(id: string, name: string) {
    setConfirm({ type: 'delete', clientId: id, clientName: name })
  }

  async function confirmDelete(id: string) {
    await fetch(`/api/super-admin/clients/${id}`, { method: 'DELETE' })
    setClients(c => c.filter(x => x.id !== id))
  }

  function loginAsTenant(clientId: string, clientName: string) {
    setConfirm({ type: 'impersonate', clientId, clientName })
  }

  async function confirmImpersonate(clientId: string, newTab: Window | null) {
    setImpersonating(clientId)
    try {
      const res  = await fetch('/api/super-admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: clientId }),
      })
      const data = await res.json()
      if (!res.ok) {
        newTab?.close()
        alert(data.error ?? 'Impersonation failed')
        return
      }
      if (newTab) newTab.location.href = data.redirectTo
      else window.open(data.redirectTo, '_blank')
    } catch {
      newTab?.close()
      alert('Failed to impersonate tenant')
    } finally {
      setImpersonating(null)
    }
  }

  async function handleConfirm() {
    if (!confirm) return
    const { type, clientId } = confirm
    const newTab = type === 'impersonate' ? window.open('', '_blank') : null
    setConfirm(null)
    if (type === 'delete') await confirmDelete(clientId)
    else await confirmImpersonate(clientId, newTab)
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <ConfirmModal state={confirm} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />

      {dbError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-400 text-sm">
          {dbError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clients</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            {clients.length} client{clients.length !== 1 ? 's' : ''} · {clients.filter(c => c.isActive).length} active
          </p>
        </div>
        <Link
          href="/super-admin/clients/new"
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Add Client
        </Link>
      </div>

      <input
        type="search"
        placeholder="Search clients by name or slug…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500"
      />

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
              {['Client', 'Slug / URL', 'Tier', 'Status', 'Theme', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                  {clients.length === 0 ? (
                    <>No clients yet. <Link href="/super-admin/clients/new" className="text-purple-600 dark:text-purple-400 hover:underline">Add one →</Link></>
                  ) : 'No clients match your search.'}
                </td>
              </tr>
            ) : filtered.map((c, i) => (
              <tr
                key={c.id}
                className={`border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition ${i % 2 !== 0 ? 'bg-white dark:bg-gray-900/50' : ''}`}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt={c.name}
                        className="w-8 h-8 rounded-lg object-contain bg-gray-100 dark:bg-gray-800 p-0.5 shrink-0" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: c.primaryColor || '#6d28d9' }}
                      >
                        {c.name[0]}
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Since {new Date(c.createdAt).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <code className="text-purple-700 dark:text-purple-300 text-xs">{c.slug}</code>
                  <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{c.slug}-hrmsapp.vercel.app</p>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[c.tier] ?? TIER_COLORS.starter}`}>
                    {c.tier}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => toggleActive(c.id, c.isActive)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition ${
                      c.isActive
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-700 dark:hover:text-red-300'
                        : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-green-100 dark:hover:bg-green-900/50 hover:text-green-700 dark:hover:text-green-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                    {c.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: c.primaryColor || '#6d28d9' }}
                      title={c.primaryColor}
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{c.primaryColor || 'default'}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/super-admin/clients/${c.id}`}         className="text-xs text-blue-500 dark:text-blue-300 hover:underline font-medium">Edit</Link>
                    <Link href={`/super-admin/clients/${c.id}/users`}   className="text-xs text-green-500 dark:text-green-300 hover:underline font-medium">Users</Link>
                    <Link href={`/super-admin/clients/${c.id}/modules`} className="text-xs text-purple-500 dark:text-purple-300 hover:underline font-medium">Modules</Link>
                    <Link href={`/super-admin/clients/${c.id}?tab=theme`} className="text-xs text-pink-500 dark:text-pink-300 hover:underline font-medium">Theme</Link>
                    <button
                      onClick={() => loginAsTenant(c.id, c.name)}
                      disabled={impersonating === c.id || !c.isActive}
                      className="text-xs text-yellow-500 dark:text-yellow-300 hover:underline font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      title={c.isActive ? "Open this tenant's portal" : 'Client is inactive'}
                    >
                      {impersonating === c.id ? '…' : 'Login as'}
                    </button>
                    <button
                      onClick={() => deleteClient(c.id, c.name)}
                      className="text-xs text-red-500 dark:text-red-400 hover:underline font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
