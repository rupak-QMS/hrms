'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

type Priority = 'low' | 'medium' | 'high' | 'critical'
type Status   = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed'

type Ticket = {
  id: string
  ticketNumber: string
  title: string
  category: string
  priority: Priority
  status: Status
  slaTargetMins: number
  slaUsedPct: number
  isBreached: boolean
  createdAt: string
  resolvedAt: string | null
}

type Stats = {
  totalOpen: number
  breached: number
  resolvedToday: number
  avgResolveMins: number
  criticalOpen: number
}

const PRIORITY_COLOR: Record<Priority, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const STATUS_COLOR: Record<Status, string> = {
  open:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  pending:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  resolved:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed:      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

function fmtMins(mins: number | null): string {
  if (!mins) return '—'
  if (mins < 60)  return `${mins}m`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
}

function fmtAge(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return fmtMins(m)
}

const SLA_LABEL: Record<Priority, string> = {
  critical: '4h SLA',
  high:     '8h SLA',
  medium:   '24h SLA',
  low:      '72h SLA',
}

export default function HelpdeskPage() {
  const [tickets, setTickets]     = useState<Ticket[]>([])
  const [stats,   setStats]       = useState<Stats | null>(null)
  const [total,   setTotal]       = useState(0)
  const [page,    setPage]        = useState(1)
  const [pages,   setPages]       = useState(1)
  const [loading, setLoading]     = useState(true)
  const [status,  setStatus]      = useState('')
  const [priority,setPriority]    = useState('')
  const [q,       setQ]           = useState('')

  // New ticket modal
  const [showNew,     setShowNew]    = useState(false)
  const [submitting,  setSubmitting] = useState(false)
  const [newForm, setNewForm] = useState({ title: '', description: '', category: 'it', priority: 'medium' })

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (status)   params.set('status', status)
    if (priority) params.set('priority', priority)
    if (q)        params.set('q', q)
    try {
      const r = await fetchWithAuth(`/api/tenant/tickets?${params}`)
      const d = await r.json()
      setTickets(d.tickets ?? [])
      setStats(d.stats ?? null)
      setTotal(d.total ?? 0)
      setPages(d.pages ?? 1)
    } finally { setLoading(false) }
  }, [page, status, priority, q])

  useEffect(() => { load() }, [load])

  async function submit() {
    if (!newForm.title || !newForm.description) return
    setSubmitting(true)
    await fetchWithAuth('/api/tenant/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newForm) })
    setSubmitting(false)
    setShowNew(false)
    setNewForm({ title: '', description: '', category: 'it', priority: 'medium' })
    setPage(1)
    load()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Helpdesk</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Support tickets &amp; SLA tracking</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition">
          <span className="text-base leading-none">＋</span> New Ticket
        </button>
      </div>

      {/* SLA Stat Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Open Tickets',    value: stats.totalOpen,      color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'SLA Breached',    value: stats.breached,       color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20' },
            { label: 'Critical Open',   value: stats.criticalOpen,   color: 'text-orange-600 dark:text-orange-400',bg: 'bg-orange-50 dark:bg-orange-900/20' },
            { label: 'Resolved Today',  value: stats.resolvedToday,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
            { label: 'Avg Resolve Time',value: fmtMins(stats.avgResolveMins), color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          ].map(c => (
            <div key={c.label} className={`rounded-xl p-4 ${c.bg} border border-black/[0.04] dark:border-white/[0.06]`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1) }}
          placeholder="Search tickets…"
          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48" />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}
          className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 self-center">{total} ticket{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Ticket Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-2">🎫</p>
            <p className="text-sm text-gray-400">No tickets found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Ticket', 'Title', 'Category', 'Priority', 'Status', 'SLA', 'Age'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{t.ticketNumber}</td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{t.title}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-600 dark:text-gray-400">{t.category}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[t.priority]}`}>
                      {t.priority === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${t.isBreached ? 'bg-red-500' : t.slaUsedPct > 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                          style={{ width: `${t.slaUsedPct}%` }}
                        />
                      </div>
                      <span className={`text-xs whitespace-nowrap font-medium ${t.isBreached ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                        {t.isBreached ? '🔴 Breached' : `${t.slaUsedPct}% of ${SLA_LABEL[t.priority]}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtAge(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition">← Prev</button>
          <span className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">Page {page} of {pages}</span>
          <button disabled={page === pages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition">Next →</button>
        </div>
      )}

      {/* New Ticket Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">New Support Ticket</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
                <input value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Brief summary of the issue" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description *</label>
                <textarea value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} rows={4}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Describe the issue in detail…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                  <select value={newForm.category} onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="it">IT</option>
                    <option value="hr">HR</option>
                    <option value="payroll">Payroll</option>
                    <option value="facilities">Facilities</option>
                    <option value="compliance">Compliance</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Priority</label>
                  <select value={newForm.priority} onChange={e => setNewForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="low">Low (72h SLA)</option>
                    <option value="medium">Medium (24h SLA)</option>
                    <option value="high">High (8h SLA)</option>
                    <option value="critical">Critical (4h SLA)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition">Cancel</button>
              <button onClick={submit} disabled={submitting || !newForm.title || !newForm.description}
                className="flex-1 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition">
                {submitting ? 'Submitting…' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
