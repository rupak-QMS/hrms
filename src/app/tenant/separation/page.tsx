'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import EmptyState from '@/components/ui/EmptyState'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

type SeparationRecord = {
  id: string; employeeId: string; type: string; reason: string | null
  noticeDate: string | null; lastWorkingDay: string | null
  exitInterviewAt: string | null; exitInterviewNotes: string | null
  checklistComplete: boolean; assetsReturned: boolean; systemAccessRevoked: boolean
  status: string; createdAt: string
  employeeFirstName: string | null; employeeLastName: string | null
  employeeEmail: string | null; employeeStartDate: string | null; employeeEntityName: string | null
}
type SeparationEvent = { id: string; event: string; note: string | null; performedBy: string | null; createdAt: string }
type Stats = { total: number; pending: number; active: number; completed: number; resignation: number; termination: number }
type Employee = { id: string; firstName: string; lastName: string }

const SEP_TYPES = [
  { value: 'resignation',  label: 'Resignation' },
  { value: 'termination',  label: 'Termination' },
  { value: 'redundancy',   label: 'Redundancy' },
  { value: 'contract_end', label: 'Contract End' },
  { value: 'retirement',   label: 'Retirement' },
  { value: 'abandonment',  label: 'Abandonment' },
]

const TYPE_COLORS: Record<string, string> = {
  resignation:  'badge badge-blue',
  termination:  'badge badge-red',
  redundancy:   'badge badge-amber',
  contract_end: 'badge badge-gray',
  retirement:   'badge badge-teal',
  abandonment:  'badge badge-amber',
}

const STATUS_STYLE: Record<string, string> = {
  pending:   'badge badge-blue',
  active:    'badge badge-amber',
  completed: 'badge badge-green',
}

const EVENT_ICON: Record<string, string> = {
  initiated:                '→',
  notice_received:          '📩',
  exit_interview_scheduled: '📅',
  exit_interview_done:      '✅',
  assets_returned:          '📦',
  access_revoked:           '🔐',
  completed:                '🎉',
  checklist_completed:      '☑️',
  updated:                  '✏️',
}

const INPUT = 'input-premium'
const TABS = ['Overview', 'Records'] as const
type Tab = typeof TABS[number]

export default function SeparationPage() {
  const [tab, setTab] = useState<Tab>('Overview')

  const [records,   setRecords]   = useState<SeparationRecord[]>([])
  const [stats,     setStats]     = useState<Stats>({ total:0, pending:0, active:0, completed:0, resignation:0, termination:0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const [form, setForm] = useState({
    employeeId: '', type: 'resignation', reason: '', noticeDate: '', lastWorkingDay: '',
  })
  const [editFields,      setEditFields]      = useState<Record<string, { reason: string; noticeDate: string; lastWorkingDay: string }>>({})
  const [editingId,       setEditingId]       = useState<string | null>(null)
  const [interviewFields, setInterviewFields] = useState<Record<string, { at: string; notes: string }>>({})
  const [sepEvents,       setSepEvents]       = useState<Record<string, SeparationEvent[]>>({})
  const [noteFields,      setNoteFields]      = useState<Record<string, string>>({})
  const [savingNote,      setSavingNote]      = useState<string | null>(null)

  const load = useCallback(async (st = filterStatus, t = filterType, s = search) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (st) p.set('status', st)
    if (t)  p.set('type', t)
    if (s)  p.set('search', s)
    const res  = await fetchWithAuth(`/api/tenant/separation?${p}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setStats(data.stats ?? { total:0, pending:0, active:0, completed:0, resignation:0, termination:0 })
    setLoading(false)
  }, [filterStatus, filterType, search])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function initiate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/separation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ employeeId:'', type:'resignation', reason:'', noticeDate:'', lastWorkingDay:'' })
    setSaving(false)
    load()
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    await fetchWithAuth(`/api/tenant/separation/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    load()
    loadEvents(id)
  }

  async function saveEdit(id: string) {
    const f = editFields[id]
    if (!f) return
    await patch(id, { reason: f.reason, noticeDate: f.noticeDate || null, lastWorkingDay: f.lastWorkingDay || null })
    setEditingId(null)
  }

  async function deleteRecord(id: string) {
    setConfirmState({
      message: 'Delete this separation record? This cannot be undone.',
      onConfirm: async () => {
        setDeleting(id)
        await fetchWithAuth('/api/tenant/separation', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        setDeleting(null)
        setExpanded(null)
        load()
      }
    })
  }

  async function loadEvents(id: string) {
    const res  = await fetchWithAuth(`/api/tenant/separation/${id}`)
    const data = await res.json()
    setSepEvents(prev => ({ ...prev, [id]: data.events ?? [] }))
  }

  async function addNote(id: string) {
    const note = noteFields[id]?.trim()
    if (!note) return
    setSavingNote(id)
    await fetchWithAuth(`/api/tenant/separation/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _note: note }),
    })
    setNoteFields(prev => ({ ...prev, [id]: '' }))
    setSavingNote(null)
    loadEvents(id)
  }

  async function saveInterview(id: string) {
    const f = interviewFields[id]
    if (!f) return
    await patch(id, { exitInterviewAt: f.at, exitInterviewNotes: f.notes })
  }

  const progress = (r: SeparationRecord) => {
    let done = 0
    if (r.assetsReturned)      done++
    if (r.systemAccessRevoked) done++
    if (r.exitInterviewAt)     done++
    return Math.round((done / 3) * 100)
  }

  function exportSeparationCsv() {
    exportCsv({
      filename: 'separation-records',
      columns: [
        { header: 'Employee Name',       key: 'employeeFirstName', format: (v, r) => `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim() },
        { header: 'Separation Type',     key: 'type' },
        { header: 'Reason',              key: 'reason',           format: v => v ?? '' },
        { header: 'Notice Date',         key: 'noticeDate',       format: fmtCsvDate },
        { header: 'Last Working Day',    key: 'lastWorkingDay',   format: fmtCsvDate },
        { header: 'Status',              key: 'status' },
        { header: 'Exit Interview Done', key: 'exitInterviewAt',  format: v => v ? 'Yes' : 'No' },
        { header: 'Notes',               key: 'exitInterviewNotes', format: v => v ?? '' },
      ],
      rows: records,
    })
  }

  // ── Overview helpers ──────────────────────────────────────────────
  const allRecords = records  // stats always use all records (load without filters for overview)
  const typeBreakdown = SEP_TYPES.map(t => ({
    ...t,
    count: allRecords.filter(r => r.type === t.value).length,
  })).filter(t => t.count > 0)

  const avgDays = (() => {
    const completed = allRecords.filter(r => r.status === 'completed' && r.createdAt && r.lastWorkingDay)
    if (!completed.length) return null
    const total = completed.reduce((sum, r) => {
      const diff = new Date(r.lastWorkingDay!).getTime() - new Date(r.createdAt).getTime()
      return sum + diff / (1000 * 60 * 60 * 24)
    }, 0)
    return Math.round(total / completed.length)
  })()

  const recent = [...allRecords]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Separation & Exit Management</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Manage employee departures, offboarding checklists, and exit interviews</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportSeparationCsv} disabled={records.length === 0} />
          <button onClick={() => { setShowForm(v => !v); setTab('Records') }}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            {showForm ? 'Cancel' : '+ Initiate Separation'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total',        value: stats.total,       color: 'text-foreground' },
          { label: 'Pending',      value: stats.pending,     color: 'text-[#4ebac4]' },
          { label: 'Active',       value: stats.active,      color: 'text-amber-400' },
          { label: 'Completed',    value: stats.completed,   color: 'text-green-400' },
          { label: 'Resignations', value: stats.resignation, color: 'text-[#1A6080] dark:text-[#4ebac4]' },
          { label: 'Terminations', value: stats.termination, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-[#1A6080]/20">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t
                ? 'border-[#0E3D52] text-[#1A6080] dark:text-[#4ebac4]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ────────────────────────────────────────────── */}
      {tab === 'Overview' && (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-premium p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400  font-semibold mb-1">Active Offboardings</p>
              <p className="text-3xl font-bold text-amber-400">{stats.active + stats.pending}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.pending} pending · {stats.active} in progress</p>
            </div>
            <div className="card-premium p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400  font-semibold mb-1">Avg. Offboarding Days</p>
              <p className="text-3xl font-bold text-[#1A6080] dark:text-[#4ebac4]">{avgDays !== null ? avgDays : '—'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Based on {stats.completed} completed</p>
            </div>
            <div className="card-premium p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400  font-semibold mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-green-400">
                {stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.completed} of {stats.total} fully offboarded</p>
            </div>
          </div>

          {/* Type breakdown */}
          {typeBreakdown.length > 0 && (
            <div className="card-premium p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Separation by Type</h3>
              <div className="space-y-3">
                {typeBreakdown.map(t => (
                  <div key={t.value}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-300">{t.label}</span>
                      <span className="text-gray-500 dark:text-gray-400">{t.count} ({stats.total ? Math.round((t.count / stats.total) * 100) : 0}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-[#0A1929] rounded-full">
                      <div
                        className="h-2 rounded-full bg-[#f0f7fb]0 transition-all"
                        style={{ width: stats.total ? `${(t.count / stats.total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming last working days */}
          {(() => {
            const upcoming = allRecords
              .filter(r => r.lastWorkingDay && r.status !== 'completed' && new Date(r.lastWorkingDay) >= new Date())
              .sort((a, b) => new Date(a.lastWorkingDay!).getTime() - new Date(b.lastWorkingDay!).getTime())
              .slice(0, 5)
            if (!upcoming.length) return null
            return (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-amber-300 mb-3">⏰ Upcoming Last Working Days</h3>
                <div className="space-y-2">
                  {upcoming.map(r => {
                    const days = Math.ceil((new Date(r.lastWorkingDay!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-200">{r.employeeFirstName} {r.employeeLastName}</span>
                        <span className={`text-xs font-medium ${days <= 7 ? 'text-red-400' : 'text-amber-300'}`}>
                          {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`} · {new Date(r.lastWorkingDay!).toLocaleDateString('en-AU')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Recent separations table */}
          <div className="card-premium overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-[#1A6080]/20">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Recent Separations</h3>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No separation records yet.</p>
            ) : (
              <div className="table-responsive">
            <table className="table-premium">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#1A6080]/20">
                    {['Employee', 'Type', 'Status', 'Last Working Day', 'Progress'].map(h => (
                      <th key={h} className="px-5 py-3 text-left section-label">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => {
                    const pct = progress(r)
                    return (
                      <tr key={r.id}
                        className={`border-b border-gray-100 dark:border-[#1A6080]/20 hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30/50 transition cursor-pointer ${i % 2 !== 0 ? 'bg-white dark:bg-[#0F1E2E]/50' : ''}`}
                        onClick={() => { setTab('Records'); setTimeout(() => { setExpanded(r.id); loadEvents(r.id) }, 50) }}>
                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                          {r.employeeFirstName} {r.employeeLastName}
                          {r.employeeEmail && <p className="text-xs text-gray-500 dark:text-gray-400 font-normal">{r.employeeEmail}</p>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[r.type] ?? 'badge badge-gray'}`}>
                            {SEP_TYPES.find(t => t.value === r.type)?.label ?? r.type}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300 text-xs">
                          {r.lastWorkingDay ? new Date(r.lastWorkingDay).toLocaleDateString('en-AU') : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-gray-100 dark:bg-[#0A1929] rounded-full">
                              <div className={`h-1.5 rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-[#f0f7fb]0'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
          </div>
            )}
          </div>
        </div>
      )}

      {/* ── RECORDS TAB ─────────────────────────────────────────────── */}
      {tab === 'Records' && (
        <div className="space-y-4">
          {/* Initiate form */}
          {showForm && (
            <form onSubmit={initiate} className="card-premium border-[#0E3D52]/30 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#4ebac4]">Initiate Separation Process</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
                  <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                    <option value="">— Select —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Separation Type *</label>
                  <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                    {SEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notice Date</label>
                  <input type="date" value={form.noticeDate} onChange={e => setForm(f => ({ ...f, noticeDate: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Last Working Day</label>
                  <input type="date" value={form.lastWorkingDay} onChange={e => setForm(f => ({ ...f, lastWorkingDay: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Reason</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={2} placeholder="Brief reason for separation…" className={INPUT} />
              </div>
              {form.type === 'termination' && (
                <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm text-red-600 dark:text-red-300">
                  ⚠️ Termination — ensure proper documentation and HR sign-off before proceeding. Seek legal advice if required.
                </div>
              )}
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
                  {saving ? 'Initiating…' : 'Begin Separation'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-600 text-gray-400 hover:bg-[#0A1929] transition">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Filters + search */}
          <div className="flex gap-3 flex-wrap">
            <input
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={e => { setSearch(e.target.value); load(filterStatus, filterType, e.target.value) }}
              className="input-premium placeholder-gray-400 focus:outline-none focus:border-[#0E3D52] w-52"
            />
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(e.target.value, filterType, search) }}
              className="input-premium focus:outline-none focus:border-[#0E3D52]">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); load(filterStatus, e.target.value, search) }}
              className="input-premium focus:outline-none focus:border-[#0E3D52]">
              <option value="">All types</option>
              {SEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Records list */}
          {loading ? (
            <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div>
          ) : records.length === 0 ? (
            <EmptyState
              icon="👋"
              title="No separation records"
              message="Employee offboarding records will appear here."
              action={{ label: 'Initiate Separation', onClick: () => { setShowForm(true) } }}
            />
          ) : (
            <div className="space-y-3">
              {records.map(r => {
                const isOpen = expanded === r.id
                const pct    = progress(r)
                const iField = interviewFields[r.id] ?? { at: r.exitInterviewAt?.split('T')[0] ?? '', notes: r.exitInterviewNotes ?? '' }
                const eField = editFields[r.id] ?? { reason: r.reason ?? '', noticeDate: r.noticeDate ?? '', lastWorkingDay: r.lastWorkingDay ?? '' }

                return (
                  <div key={r.id} className={`card-premium overflow-hidden ${
                    r.status === 'completed' ? 'border-green-900' : r.type === 'termination' ? 'border-red-900/50' : 'border-gray-200 dark:border-[#1A6080]/20'
                  }`}>
                    {/* Card header row */}
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => { const next = isOpen ? null : r.id; setExpanded(next); if (next) loadEvents(next) }}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-gray-900 dark:text-white font-medium text-sm">
                            {r.employeeFirstName} {r.employeeLastName}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[r.type] ?? 'badge badge-gray'}`}>
                            {SEP_TYPES.find(t => t.value === r.type)?.label ?? r.type}
                          </span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </div>
                        {r.employeeEmail && <p className="text-xs text-gray-500 dark:text-gray-400">{r.employeeEmail}</p>}
                        {r.status !== 'completed' && (
                          <div className="mt-2">
                            <div className="flex justify-between mb-0.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400">Offboarding progress</span>
                              <span className={`text-xs font-medium ${pct === 100 ? 'text-green-400' : 'text-gray-400'}`}>{pct}%</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 dark:bg-[#0A1929] rounded-full">
                              <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-[#0E3D52]'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {r.lastWorkingDay && (
                          <p className="text-xs text-amber-400 font-medium hidden sm:block">
                            LWD {new Date(r.lastWorkingDay).toLocaleDateString('en-AU')}
                          </p>
                        )}
                        {r.status === 'pending' && (
                          <button onClick={() => patch(r.id, { status: 'active' })}
                            className="text-xs bg-amber-600/20 border border-amber-700 text-amber-300 hover:bg-amber-600/40 px-2.5 py-1.5 rounded-lg transition">
                            Mark Active
                          </button>
                        )}
                        {r.status === 'completed' && (
                          <button onClick={() => patch(r.id, { status: 'active' })}
                            className="text-xs bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 px-2.5 py-1.5 rounded-lg transition">
                            Reopen
                          </button>
                        )}
                        <button
                          onClick={() => deleteRecord(r.id)}
                          disabled={deleting === r.id}
                          title="Delete record"
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 px-1 py-1 rounded transition">
                          {deleting === r.id ? '…' : '🗑'}
                        </button>
                        <button
                          onClick={() => { const next = isOpen ? null : r.id; setExpanded(next); if (next) loadEvents(next) }}
                          className="text-gray-500 dark:text-gray-400 ml-1 text-sm">
                          {isOpen ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="border-t border-gray-200 dark:border-[#1A6080]/20 px-5 py-4 space-y-5">

                        {/* Edit toggle */}
                        <div className="flex justify-end">
                          {editingId === r.id ? (
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(r.id)}
                                className="text-xs bg-[#0E3D52] hover:bg-[#1A6080] text-white px-3 py-1.5 rounded-lg transition">
                                Save Changes
                              </button>
                              <button onClick={() => setEditingId(null)}
                                className="text-xs border border-gray-600 text-gray-400 hover:bg-[#0A1929] px-3 py-1.5 rounded-lg transition">
                                Cancel
                              </button>
                            </div>
                          ) : r.status !== 'completed' ? (
                            <button
                              onClick={() => { setEditingId(r.id); setEditFields(p => ({ ...p, [r.id]: eField })) }}
                              className="text-xs border border-gray-600 text-gray-400 hover:bg-[#0A1929] px-3 py-1.5 rounded-lg transition">
                              ✏️ Edit Details
                            </button>
                          ) : null}
                        </div>

                        {/* Key dates — edit or read */}
                        {editingId === r.id ? (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notice Date</label>
                              <input type="date" value={eField.noticeDate}
                                onChange={e => setEditFields(p => ({ ...p, [r.id]: { ...eField, noticeDate: e.target.value } }))}
                                className={INPUT} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Last Working Day</label>
                              <input type="date" value={eField.lastWorkingDay}
                                onChange={e => setEditFields(p => ({ ...p, [r.id]: { ...eField, lastWorkingDay: e.target.value } }))}
                                className={INPUT} />
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Reason</label>
                              <textarea value={eField.reason} rows={2}
                                onChange={e => setEditFields(p => ({ ...p, [r.id]: { ...eField, reason: e.target.value } }))}
                                className={INPUT} />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { label: 'Notice Date',      value: r.noticeDate },
                                { label: 'Last Working Day', value: r.lastWorkingDay },
                                { label: 'Entity',           value: r.employeeEntityName },
                              ].map(d => (
                                <div key={d.label} className="bg-gray-100 dark:bg-[#0A1929]/60 rounded-lg p-3">
                                  <p className="text-xs text-gray-500 mb-0.5 dark:text-gray-400">{d.label}</p>
                                  <p className="text-sm text-gray-700 dark:text-gray-200">
                                    {d.value
                                      ? (d.value.length === 10 && d.value.includes('-')
                                          ? new Date(d.value + 'T00:00:00').toLocaleDateString('en-AU')
                                          : d.value)
                                      : '—'}
                                  </p>
                                </div>
                              ))}
                            </div>
                            {r.reason && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500  mb-1 dark:text-gray-400">Reason</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{r.reason}</p>
                              </div>
                            )}
                          </>
                        )}

                        {/* Offboarding checklist */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500  mb-2 dark:text-gray-400">Offboarding Checklist</p>
                          <div className="space-y-2">
                            {[
                              { label: 'Assets Returned',       desc: 'Laptop, access cards, keys, uniforms, PPE', done: r.assetsReturned,      key: 'assetsReturned' },
                              { label: 'System Access Revoked', desc: 'Email, payroll, HR systems, facility access', done: r.systemAccessRevoked, key: 'systemAccessRevoked' },
                            ].map(item => (
                              <label key={item.key}
                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                                  item.done
                                    ? 'bg-green-950/40 border-green-800/60'
                                    : 'bg-gray-100 dark:bg-[#0A1929]/40 border-gray-200 dark:border-[#1A6080]/30 hover:border-gray-600'
                                } ${r.status === 'completed' ? 'pointer-events-none' : ''}`}>
                                <input type="checkbox" checked={item.done} disabled={r.status === 'completed'}
                                  onChange={e => patch(r.id, { [item.key]: e.target.checked })}
                                  className="mt-0.5 accent-green-500 w-4 h-4 shrink-0" />
                                <div>
                                  <p className={`text-sm font-medium ${item.done ? 'text-green-300 line-through' : 'text-gray-700 dark:text-gray-200'}`}>{item.label}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{item.desc}</p>
                                </div>
                                {item.done && <span className="ml-auto text-green-400 text-sm">✓</span>}
                              </label>
                            ))}
                          </div>
                          {r.assetsReturned && r.systemAccessRevoked && !r.checklistComplete && (
                            <p className="text-xs text-green-400 mt-2">Both items complete — offboarding will auto-complete</p>
                          )}
                          {r.checklistComplete && (
                            <p className="text-xs text-green-400 mt-2">✓ Offboarding checklist complete</p>
                          )}
                        </div>

                        {/* Exit interview */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500  mb-2 dark:text-gray-400">Exit Interview</p>
                          {r.exitInterviewAt && r.status === 'completed' ? (
                            <div className="bg-gray-100 dark:bg-[#0A1929]/40 rounded-lg p-3 space-y-1">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Conducted {new Date(r.exitInterviewAt).toLocaleDateString('en-AU')}</p>
                              {r.exitInterviewNotes && <p className="text-sm text-gray-600 dark:text-gray-300">{r.exitInterviewNotes}</p>}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Interview Date</label>
                                  <input type="date" value={iField.at}
                                    onChange={e => setInterviewFields(prev => ({ ...prev, [r.id]: { ...iField, at: e.target.value } }))}
                                    className={INPUT} />
                                </div>
                              </div>
                              <div>
                                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notes / Summary</label>
                                <textarea value={iField.notes}
                                  onChange={e => setInterviewFields(prev => ({ ...prev, [r.id]: { ...iField, notes: e.target.value } }))}
                                  rows={3} placeholder="Key themes, feedback, suggestions from exit interview…"
                                  className={INPUT} />
                              </div>
                              <button onClick={() => saveInterview(r.id)}
                                className="text-xs bg-[#0E3D52]/20 border border-[#1A6080] text-[#4ebac4] hover:bg-[#0E3D52]/40 px-3 py-1.5 rounded-lg transition">
                                Save Interview
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Completion badge */}
                        {r.status === 'completed' && (
                          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 rounded-lg p-3 flex items-center gap-3">
                            <span className="text-2xl">🎉</span>
                            <div>
                              <p className="text-sm font-semibold text-green-300">Offboarding Complete</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">All checklist items confirmed. Employee has been fully offboarded.</p>
                            </div>
                          </div>
                        )}

                        {/* Event history */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500  mb-3 dark:text-gray-400">History & Notes</p>
                          <div className="flex gap-2 mb-4">
                            <input value={noteFields[r.id] ?? ''}
                              onChange={e => setNoteFields(prev => ({ ...prev, [r.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') addNote(r.id) }}
                              placeholder="Add a note or comment…"
                              className={INPUT} />
                            <button
                              disabled={savingNote === r.id || !noteFields[r.id]?.trim()}
                              onClick={() => addNote(r.id)}
                              className="shrink-0 px-3 py-2 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition">
                              Add
                            </button>
                          </div>
                          {(sepEvents[r.id] ?? []).length === 0 ? (
                            <p className="text-xs text-gray-600 text-center py-3 dark:text-gray-400">No events recorded yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {(sepEvents[r.id] ?? []).map((ev, i, arr) => (
                                <div key={ev.id} className="flex gap-3 items-start">
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 flex items-center justify-center text-xs">
                                      {EVENT_ICON[ev.event] ?? '📝'}
                                    </div>
                                    {i < arr.length - 1 && <div className="w-px h-3 bg-gray-200 dark:bg-[#0E3D52]/60 mt-1" />}
                                  </div>
                                  <div className="flex-1 pb-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-medium text-gray-900 dark:text-white capitalize">{ev.event.replace(/_/g, ' ')}</p>
                                      <p className="text-xs text-gray-600 shrink-0 dark:text-gray-400">
                                        {new Date(ev.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </p>
                                    </div>
                                    {ev.note        && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{ev.note}</p>}
                                    {ev.performedBy && <p className="text-xs text-gray-600 mt-0.5 dark:text-gray-400">by {ev.performedBy}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
