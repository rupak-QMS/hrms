'use client'

import { useEffect, useState, useCallback } from 'react'

type AuditLog = {
  id: string
  action: string
  resource: string
  resourceId: string | null
  oldValues: any
  newValues: any
  ipAddress: string | null
  createdAt: string
  tenantId: string
  tenantName: string | null
}

type Tenant = { id: string; name: string }

const ACTION_COLORS: Record<string, string> = {
  login:    'bg-blue-50 dark:bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  logout:   'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  create:   'bg-green-50 dark:bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
  update:   'bg-yellow-50 dark:bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
  delete:   'bg-red-50 dark:bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
  export:   'bg-purple-50 dark:bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
  upload:   'bg-teal-50 dark:bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
  download: 'bg-indigo-50 dark:bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300',
}

function actionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k))
  return key ? ACTION_COLORS[key] : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function AuditLogsPage() {
  const [logs, setLogs]       = useState<AuditLog[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [page, setPage]       = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Filters
  const [search,   setSearch]   = useState('')
  const [tenantId, setTenantId] = useState('')
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)   params.set('search',   search)
    if (tenantId) params.set('tenantId', tenantId)
    if (from)     params.set('from',     from)
    if (to)       params.set('to',       to)
    params.set('page', String(p))

    try {
      setFetchError(null)
      const res  = await fetch(`/api/super-admin/audit-logs?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setLogs(data.logs ?? [])
      setTenants(data.tenants ?? [])
      setPage(p)
    } catch (err: any) {
      setFetchError(err.message ?? 'Failed to load audit logs — please refresh.')
    } finally {
      setLoading(false)
    }
  }, [search, tenantId, from, to])

  useEffect(() => { load(1) }, [load])

  function exportCSV() {
    const header = ['Date', 'Tenant', 'Action', 'Resource', 'IP Address']
    const rows = logs.map(l => [
      formatDate(l.createdAt),
      l.tenantName ?? l.tenantId,
      l.action,
      l.resource,
      l.ipAddress ?? '',
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'audit-logs.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-400 text-sm">
          {fetchError}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Platform Audit Log</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Tamper-evident log of all actions across all tenants</p>
        </div>
        <button
          onClick={exportCSV}
          className="bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          ↓ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Search action / resource…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <select
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
          >
            <option value="">All Tenants</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
          />
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
          />
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => load(1)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-1.5 rounded-lg transition"
          >
            Apply Filters
          </button>
          <button
            onClick={() => { setSearch(''); setTenantId(''); setFrom(''); setTo('') }}
            className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white text-sm px-4 py-1.5 rounded-lg transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Date / Time</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Tenant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">IP Address</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">Loading…</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-2"></div>
                    No audit events found
                  </td>
                </tr>
              ) : logs.map(log => (
                <>
                  <tr
                    key={log.id}
                    className="border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/30 transition cursor-pointer"
                    onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap text-xs">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{log.tenantName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs font-mono">{log.resource}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono dark:text-gray-400">{log.ipAddress ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs dark:text-gray-400">
                      {(log.oldValues || log.newValues) ? (
                        <span className="text-purple-600 dark:text-purple-400">{expanded === log.id ? '▲ hide' : '▼ show'}</span>
                      ) : '—'}
                    </td>
                  </tr>
                  {expanded === log.id && (log.oldValues || log.newValues) && (
                    <tr key={`${log.id}-detail`} className="bg-gray-100 dark:bg-gray-800/20 border-b border-gray-200 dark:border-gray-800/50">
                      <td colSpan={6} className="px-6 py-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                          {log.oldValues && (
                            <div>
                              <p className="text-red-600 dark:text-red-400 font-semibold mb-1">Before</p>
                              <pre className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all">
                                {JSON.stringify(log.oldValues, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.newValues && (
                            <div>
                              <p className="text-green-600 dark:text-green-400 font-semibold mb-1">After</p>
                              <pre className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all">
                                {JSON.stringify(log.newValues, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <span className="text-xs text-gray-500 dark:text-gray-400">Page {page} · 50 rows per page</span>
          <div className="flex gap-2">
            <button
              onClick={() => load(page - 1)}
              disabled={page <= 1 || loading}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white disabled:opacity-40 transition"
            >
              ← Prev
            </button>
            <button
              onClick={() => load(page + 1)}
              disabled={logs.length < 50 || loading}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
