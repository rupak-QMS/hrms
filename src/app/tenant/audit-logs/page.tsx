'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'

type AuditLog = {
  id: string; userId: string | null; action: string; resource: string
  resourceId: string | null; oldValues: unknown; newValues: unknown
  ipAddress: string | null; createdAt: string
  userEmail: string | null
}

const ACTION_COLOR: Record<string, string> = {
  create: 'badge badge-green',
  update: 'badge badge-blue',
  delete: 'badge badge-red',
  login:  'badge badge-teal',
  logout: 'badge badge-gray',
  export: 'badge badge-amber',
}

const actionColor = (a: string) =>
  ACTION_COLOR[a.toLowerCase().split('_')[0]] ?? 'badge badge-gray'

export default function AuditLogsPage() {
  const [logs,      setLogs]      = useState<AuditLog[]>([])
  const [resources, setResources] = useState<string[]>([])
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [filterResource, setFilterResource] = useState('')
  const [filterAction,   setFilterAction]   = useState('')
  const [filterSince,    setFilterSince]    = useState('')
  const [page, setPage] = useState(0)
  const PAGE = 50

  const load = useCallback(async (res = filterResource, act = filterAction, since = filterSince, p = page) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(p * PAGE) })
    if (res)   params.set('resource', res)
    if (act)   params.set('action', act)
    if (since) params.set('since', since)
    const data = await fetchWithAuth(`/api/tenant/audit-logs?${params}`).then(r => r.json())
    setLogs(data.logs ?? [])
    setResources(data.resources ?? [])
    setLoading(false)
  }, [filterResource, filterAction, filterSince, page])

  useEffect(() => { load() }, [])

  function applyFilters() { setPage(0); load(filterResource, filterAction, filterSince, 0) }

  function formatValue(v: unknown) {
    if (v === null || v === undefined) return null
    try { return JSON.stringify(v, null, 2) } catch { return String(v) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Immutable record of all system actions — who did what, and when</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Resource</label>
          <select value={filterResource} onChange={e => setFilterResource(e.target.value)}
            className="input-premium focus:outline-none focus:border-[#0E3D52] min-w-32">
            <option value="">All</option>
            {resources.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Action</label>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            className="input-premium focus:outline-none focus:border-[#0E3D52]">
            <option value="">All</option>
            {['create','update','delete','login','logout','export'].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Since</label>
          <input type="date" value={filterSince} onChange={e => setFilterSince(e.target.value)}
            className="input-premium focus:outline-none focus:border-[#0E3D52]" />
        </div>
        <button onClick={applyFilters}
          className="btn-primary">
          Apply
        </button>
        {(filterResource || filterAction || filterSince) && (
          <button onClick={() => { setFilterResource(''); setFilterAction(''); setFilterSince(''); setPage(0); load('','','',0) }}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-white px-3 py-2 rounded-lg border border-gray-300 dark:border-[#1A6080]/30 hover:border-gray-600 transition">
            Clear
          </button>
        )}
      </div>

      {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : logs.length === 0 ? (
        <div className="card-premium py-14 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-[#0A1929] mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">No audit entries found</p>
          <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">Entries appear as users interact with the system.</p>
        </div>
      ) : (
        <>
          <div className="card-premium overflow-hidden">
            <div className="table-responsive">
            <table className="table-premium">
              <thead>
                <tr>
                  <th className="px-4 py-3 section-label">Timestamp</th>
                  <th className="px-4 py-3 section-label">User</th>
                  <th className="px-4 py-3 section-label">Action</th>
                  <th className="px-4 py-3 section-label">Resource</th>
                  <th className="px-4 py-3 section-label">IP</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-[#1A6080]/20/60">
                {logs.map(log => {
                  const isOpen = expanded === log.id
                  const hasDetails = log.oldValues !== null || log.newValues !== null
                  return (
                    <>
                      <tr key={log.id}
                        onClick={() => hasDetails && setExpanded(isOpen ? null : log.id)}
                        className={`hover:bg-gray-100 dark:hover:bg-[#0E3D52]/30/40 ${hasDetails ? 'cursor-pointer' : ''}`}>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs font-mono whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('en-AU', { day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-700 dark:text-gray-200 text-xs">{log.userEmail ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${actionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-600 dark:text-gray-300 text-xs">{log.resource}</p>
                          {log.resourceId && <p className="text-gray-600 text-xs font-mono dark:text-gray-400">{log.resourceId.slice(0,8)}…</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono dark:text-gray-400">{log.ipAddress ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs dark:text-gray-400">
                          {hasDetails ? (isOpen ? '▲' : '▼') : ''}
                        </td>
                      </tr>
                      {isOpen && hasDetails && (
                        <tr key={`${log.id}-detail`} className="bg-gray-50 dark:bg-[#070F1A]">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-4">
                              {log.oldValues !== null && (
                                <div>
                                  <p className="text-xs font-semibold text-red-400 mb-1">Before</p>
                                  <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-[#0F1E2E] rounded-lg p-3 overflow-x-auto max-h-48">
                                    {formatValue(log.oldValues)}
                                  </pre>
                                </div>
                              )}
                              {log.newValues !== null && (
                                <div>
                                  <p className="text-xs font-semibold text-green-400 mb-1">After</p>
                                  <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-[#0F1E2E] rounded-lg p-3 overflow-x-auto max-h-48">
                                    {formatValue(log.newValues)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
          </div>

          {/* Pagination */}
          <div className="flex gap-3 justify-between items-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">Showing {logs.length} entries · Page {page + 1}</span>
            <div className="flex gap-2">
              <button disabled={page === 0}
                onClick={() => { const p = page - 1; setPage(p); load(filterResource, filterAction, filterSince, p) }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 hover:border-[#0E3D52] hover:text-[#4ebac4] disabled:opacity-40 disabled:cursor-not-allowed transition">
                ← Prev
              </button>
              <button disabled={logs.length < PAGE}
                onClick={() => { const p = page + 1; setPage(p); load(filterResource, filterAction, filterSince, p) }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 hover:border-[#0E3D52] hover:text-[#4ebac4] disabled:opacity-40 disabled:cursor-not-allowed transition">
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
