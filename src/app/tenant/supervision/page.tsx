'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import { ExportButton } from '@/components/ui/ExportButton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

type SupervisionRecord = {
  id: string; employeeId: string; supervisorId: string; scheduledDate: string
  conductedAt: string | null; type: string | null; status: string
  notes: string | null; actionItems: string[]; createdAt: string
  employeeFirstName: string | null; employeeLastName: string | null; employeeEmail: string | null
}
type Stats = { total: number; scheduled: number; completed: number; overdue: number }
type Employee = { id: string; firstName: string; lastName: string }

const SUP_TYPES = [
  { value: 'regular',    label: 'Regular' },
  { value: 'probation',  label: 'Probation' },
  { value: 'high_risk',  label: '️  High Risk' },
  { value: 'pip',        label: 'PIP Follow-up' },
]

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'badge badge-blue',
  completed: 'badge badge-green',
  cancelled: 'badge badge-gray',
}

const INPUT = 'input-premium'

export default function SupervisionPage() {
  const [records,   setRecords]   = useState<SupervisionRecord[]>([])
  const [stats,     setStats]     = useState<Stats>({ total:0, scheduled:0, completed:0, overdue:0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [form, setForm] = useState({ employeeId:'', supervisorId:'', scheduledDate:'', type:'regular', notes:'' })
  const [actionDraft, setActionDraft] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const load = useCallback(async (st = filterStatus, t = filterType) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (st) p.set('status', st)
    if (t)  p.set('type', t)
    const res  = await fetchWithAuth(`/api/tenant/supervision?${p}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setStats(data.stats ?? { total:0, scheduled:0, completed:0, overdue:0 })
    setLoading(false)
  }, [filterStatus, filterType])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function schedule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/supervision', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    setShowForm(false); setForm({ employeeId:'', supervisorId:'', scheduledDate:'', type:'regular', notes:'' })
    setSaving(false); load()
  }

  async function complete(id: string, notes: string) {
    await fetchWithAuth('/api/tenant/supervision', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, status:'completed', notes }),
    })
    load()
  }

  async function addAction(id: string, current: string[]) {
    const text = actionDraft[id]?.trim()
    if (!text) return
    const updated = [...current, text]
    await fetchWithAuth('/api/tenant/supervision', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, actionItems: updated }),
    })
    setActionDraft(prev => ({ ...prev, [id]: '' }))
    load()
  }

  async function deleteRecord() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetchWithAuth('/api/tenant/supervision', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteTarget }),
    })
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  async function removeAction(id: string, current: string[], idx: number) {
    const updated = current.filter((_, i) => i !== idx)
    await fetchWithAuth('/api/tenant/supervision', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, actionItems: updated }),
    })
    load()
  }

  const today = new Date().toISOString().split('T')[0]
  const isOverdue = (r: SupervisionRecord) => r.status === 'scheduled' && r.scheduledDate < today

  function exportSupervision() {
    exportCsv({
      filename: 'supervision-sessions',
      columns: [
        { header: 'Employee First Name', key: 'employeeFirstName' },
        { header: 'Employee Last Name', key: 'employeeLastName' },
        { header: 'Employee Email', key: 'employeeEmail' },
        { header: 'Supervisor', key: 'supervisorId', format: (_v, row) => {
          const sup = employees.find(e => e.id === row.supervisorId)
          return sup ? `${sup.firstName} ${sup.lastName}` : ''
        }},
        { header: 'Type', key: 'type', format: v => SUP_TYPES.find(t => t.value === v)?.label ?? v ?? 'Regular' },
        { header: 'Status', key: 'status', format: v => v ? (v as string).charAt(0).toUpperCase() + (v as string).slice(1) : '' },
        { header: 'Scheduled Date', key: 'scheduledDate', format: v => fmtCsvDate(v as string) },
        { header: 'Conducted At', key: 'conductedAt', format: v => fmtCsvDate(v as string | null) },
        { header: 'Notes', key: 'notes' },
        { header: 'Action Items', key: 'actionItems', format: v => (v as string[]).join('; ') },
        { header: 'Created At', key: 'createdAt', format: v => fmtCsvDate(v as string) },
      ],
      rows: records,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supervision Management</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Schedule and track employee supervision sessions and action items</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportSupervision} disabled={records.length === 0} />
          <button onClick={() => setShowForm(v => !v)}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            {showForm ? 'Cancel' : '+ Schedule Session'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: stats.total,     color: 'text-foreground' },
          { label: 'Scheduled', value: stats.scheduled, color: 'text-[#4ebac4]' },
          { label: 'Completed', value: stats.completed, color: 'text-green-400' },
          { label: 'Overdue',   value: stats.overdue,   color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Schedule form */}
      {showForm && (
        <form onSubmit={schedule} className="card-premium border-[#0E3D52]/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#4ebac4]">Schedule Supervision Session</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
              <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Supervisor *</label>
              <select required value={form.supervisorId} onChange={e => setForm(f => ({ ...f, supervisorId: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Scheduled Date *</label>
              <input required type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                {SUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Initial Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Agenda items, topics to cover…" className={INPUT} />
          </div>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg">
            {saving ? 'Scheduling…' : 'Schedule Session'}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(e.target.value, filterType) }}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); load(filterStatus, e.target.value) }}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All types</option>
          {SUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : records.length === 0 ? (
        <div className="card-premium py-14 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">No supervision sessions</p>
          <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">Schedule a session to begin tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => {
            const isOpen = expanded === r.id
            const overdue = isOverdue(r)
            const supervisor = employees.find(e => e.id === r.supervisorId)
            const draft = actionDraft[r.id] ?? ''
            return (
              <div key={r.id} className={`card-premium overflow-hidden ${
                overdue ? 'border-red-900/60' : r.status === 'completed' ? 'border-green-900/50' : 'border-gray-800'
              }`}>
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : r.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-foreground font-medium text-sm">
                        {r.employeeFirstName} {r.employeeLastName}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full dark:text-gray-400">
                        {SUP_TYPES.find(t => t.value === r.type)?.label ?? r.type ?? 'Regular'}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>
                        {overdue ? '️ Overdue' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Supervisor: {supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-medium ${overdue ? 'text-red-400' : 'text-gray-300'}`}>
                      {new Date(r.scheduledDate + 'T00:00:00').toLocaleDateString('en-AU')}
                    </p>
                    {r.actionItems.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{r.actionItems.length} action{r.actionItems.length !== 1 ? 's' : ''}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-0.5 dark:text-gray-400">{isOpen ? '▲' : '▼'}</p>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 space-y-4">
                    {r.notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500  mb-1 dark:text-gray-400">Session Notes</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{r.notes}</p>
                      </div>
                    )}

                    {/* Action items */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500  mb-2 dark:text-gray-400">Action Items</p>
                      {r.actionItems.length === 0 ? (
                        <p className="text-xs text-gray-600 italic dark:text-gray-400">No action items yet.</p>
                      ) : (
                        <ul className="space-y-1.5 mb-2">
                          {r.actionItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                              <span className="text-[#1A6080] dark:text-[#4ebac4] shrink-0">•</span>
                              <span className="flex-1">{item}</span>
                              {r.status !== 'completed' && (
                                <button onClick={() => removeAction(r.id, r.actionItems, i)} className="text-gray-600 hover:text-red-400 text-xs dark:text-gray-400"></button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.status !== 'completed' && (
                        <div className="flex gap-2">
                          <input
                            value={draft}
                            onChange={e => setActionDraft(prev => ({ ...prev, [r.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAction(r.id, r.actionItems) } }}
                            placeholder="Add action item… (Enter to add)"
                            className="flex-1 input-premium py-1.5 text-xs" />
                          <button onClick={() => addAction(r.id, r.actionItems)}
                            className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#0E3D52] px-3 py-1.5 rounded-lg transition">
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Complete session */}
                    {r.status === 'scheduled' && (
                      <div className="pt-1">
                        <button onClick={() => complete(r.id, r.notes ?? '')}
                          className="text-sm bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60 px-4 py-2 rounded-lg transition">
                          Mark Session Complete
                        </button>
                        {r.conductedAt && (
                          <span className="ml-3 text-xs text-gray-500 dark:text-gray-400">
                            Conducted {new Date(r.conductedAt).toLocaleDateString('en-AU')}
                          </span>
                        )}
                      </div>
                    )}
                    {r.status === 'completed' && r.conductedAt && (
                      <p className="text-xs text-green-400">Completed {new Date(r.conductedAt).toLocaleDateString('en-AU')}</p>
                    )}

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                      <button onClick={() => setDeleteTarget(r.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition">
                        Delete Session
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        state={deleteTarget ? {
          message: 'This session and all its action items will be permanently removed.',
          confirmLabel: 'Delete',
          onConfirm: deleteRecord,
        } : null}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
