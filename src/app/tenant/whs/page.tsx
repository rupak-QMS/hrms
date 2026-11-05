'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'

type Incident = {
  id: string; reportedBy: string; employeeId: string | null; type: string
  severity: string | null; description: string; location: string | null
  occurredAt: string; status: string
  correctiveActions: { id: string; action: string; assignedTo: string; dueDate: string; done: boolean }[]
  closedAt: string | null; createdAt: string
  employeeFirstName: string | null; employeeLastName: string | null; employeeEmail: string | null
}
type Stats = { total: number; open: number; investigating: number; closed: number; critical: number; high: number }
type Employee = { id: string; firstName: string; lastName: string }

const INCIDENT_TYPES = [
  { value: 'injury',            label: 'Injury' },
  { value: 'near_miss',         label: '️  Near Miss' },
  { value: 'hazard',            label: 'Hazard' },
  { value: 'unsafe_condition',  label: 'Unsafe Condition' },
  { value: 'property_damage',   label: 'Property Damage' },
  { value: 'environmental',     label: 'Environmental' },
]

const SEVERITIES = [
  { value: 'low',      label: 'Low',      color: 'text-gray-400',   bg: 'bg-gray-800 border-gray-700' },
  { value: 'medium',   label: 'Medium',   color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 dark:border-yellow-800' },
  { value: 'high',     label: 'High',     color: 'text-orange-400', bg: 'bg-orange-900/40 border-orange-800' },
  { value: 'critical', label: 'Critical', color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-800' },
]

const STATUS_STYLE: Record<string, string> = {
  open:          'badge badge-red',
  investigating: 'badge badge-amber',
  closed:        'badge badge-gray',
}

const INPUT = 'input-premium'

export default function WhsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [stats,     setStats]     = useState<Stats>({ total:0, open:0, investigating:0, closed:0, critical:0, high:0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [confirm,   setConfirm]   = useState<ConfirmState>(null)
  const [toast,     setToast]     = useState<ToastState>(null)
  const [form, setForm] = useState({
    reportedBy: '', employeeId: '', type: 'near_miss', severity: 'low',
    description: '', location: '', occurredAt: new Date().toISOString().slice(0,16),
  })

  const load = useCallback(async (s = search, st = filterStatus, sv = filterSeverity) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (s)  p.set('search', s)
    if (st) p.set('status', st)
    if (sv) p.set('severity', sv)
    const res  = await fetchWithAuth(`/api/tenant/whs?${p}`)
    const data = await res.json()
    setIncidents(data.records ?? [])
    setStats(data.stats ?? { total:0,open:0,investigating:0,closed:0,critical:0,high:0 })
    setLoading(false)
  }, [search, filterStatus, filterSeverity])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=200').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function reportIncident(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/whs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, employeeId: form.employeeId || null }),
    })
    setShowForm(false)
    setForm({ reportedBy:'', employeeId:'', type:'near_miss', severity:'low', description:'', location:'', occurredAt: new Date().toISOString().slice(0,16) })
    setSaving(false)
    load()
  }

  async function updateStatus(id: string, status: string) {
    await fetchWithAuth('/api/tenant/whs', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  async function addAction(incident: Incident, action: string) {
    const actions = [
      ...incident.correctiveActions,
      { id: Date.now().toString(), action, assignedTo: '', dueDate: '', done: false },
    ]
    await fetchWithAuth('/api/tenant/whs', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: incident.id, correctiveActions: actions }),
    })
    load()
  }

  async function deleteIncident(id: string) {
    const res = await fetchWithAuth(`/api/tenant/whs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setIncidents(prev => prev.filter(i => i.id !== id))
      setExpanded(prev => prev === id ? null : prev)
      setToast({ message: 'Incident deleted', type: 'success' })
    } else {
      setToast({ message: 'Failed to delete incident', type: 'error' })
    }
  }

  async function toggleAction(incident: Incident, actionId: string) {
    const actions = incident.correctiveActions.map(a =>
      a.id === actionId ? { ...a, done: !a.done } : a
    )
    await fetchWithAuth('/api/tenant/whs', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: incident.id, correctiveActions: actions }),
    })
    load()
  }

  const sev = (v: string | null) => SEVERITIES.find(s => s.value === v) ?? SEVERITIES[0]

  function exportIncidents() {
    exportCsv({
      filename: 'whs-incidents',
      columns: [
        { header: 'Incident Type', key: 'type', format: v => INCIDENT_TYPES.find(t => t.value === v)?.label ?? v ?? '' },
        { header: 'Severity', key: 'severity', format: v => SEVERITIES.find(s => s.value === v)?.label ?? v ?? '' },
        { header: 'Status', key: 'status', format: v => v ? (v as string).charAt(0).toUpperCase() + (v as string).slice(1) : '' },
        { header: 'Date & Time', key: 'occurredAt', format: v => fmtCsvDate(v as string) },
        { header: 'Location', key: 'location' },
        { header: 'Description', key: 'description' },
        { header: 'Reported By', key: 'reportedBy' },
        { header: 'Employee First Name', key: 'employeeFirstName' },
        { header: 'Employee Last Name', key: 'employeeLastName' },
        { header: 'Employee Email', key: 'employeeEmail' },
        { header: 'Closed At', key: 'closedAt', format: v => fmtCsvDate(v as string | null) },
        { header: 'Created At', key: 'createdAt', format: v => fmtCsvDate(v as string) },
      ],
      rows: incidents,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WHS & Injury Management</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Report incidents, track investigations and corrective actions</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportIncidents} disabled={incidents.length === 0} />
          <button onClick={() => setShowForm(v => !v)}
            className="bg-red-700 hover:bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            {showForm ? 'Cancel' : '+ Report Incident'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total',         value: stats.total,         color: 'text-foreground' },
          { label: 'Open',          value: stats.open,          color: 'text-red-400' },
          { label: 'Investigating', value: stats.investigating,  color: 'text-amber-400' },
          { label: 'Closed',        value: stats.closed,        color: 'text-green-400' },
          { label: 'Critical',      value: stats.critical,      color: 'text-red-300' },
          { label: 'High',          value: stats.high,          color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Report form */}
      {showForm && (
        <form onSubmit={reportIncident} className="card-premium border-red-500/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-red-300">Report New Incident</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Reported By (Employee) *</label>
              <select required value={form.reportedBy} onChange={e => setForm(f => ({ ...f, reportedBy: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Injured Employee (if applicable)</label>
              <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                <option value="">— None / Not applicable —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Incident Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Severity *</label>
              <select required value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className={INPUT}>
                {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Date & Time *</label>
              <input required type="datetime-local" value={form.occurredAt}
                onChange={e => setForm(f => ({ ...f, occurredAt: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Location</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Client home, office, vehicle" className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Description *</label>
              <textarea required value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="Describe what happened, injuries sustained, witnesses…" className={INPUT} />
            </div>
          </div>
          {form.severity === 'critical' && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm text-red-600 dark:text-red-300">
              ️ Critical incident — notify SafeWork Australia / state WHS regulator as required by law.
            </div>
          )}
          <button type="submit" disabled={saving}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
            {saving ? 'Reporting…' : 'Submit Incident Report'}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); load(e.target.value, filterStatus, filterSeverity) }}
          placeholder="Search employee or description…"
          className="flex-1 min-w-48 input-premium placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]" />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(search, e.target.value, filterSeverity) }}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="closed">Closed</option>
        </select>
        <select value={filterSeverity} onChange={e => { setFilterSeverity(e.target.value); load(search, filterStatus, e.target.value) }}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All severities</option>
          {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Incident list */}
      {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : incidents.length === 0 ? (
        <div className="card-premium py-14 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">No incidents recorded</p>
          <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">Use the "Report Incident" button to log a new event.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => {
            const s = sev(inc.severity)
            const isOpen = expanded === inc.id
            return (
              <div key={inc.id} className={`card-premium overflow-hidden transition group ${
                inc.severity === 'critical' ? 'border-red-800' : inc.severity === 'high' ? 'border-orange-800/60' : 'border-gray-800'
              }`}>
                {/* Summary row */}
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : inc.id)}>
                  <div className={`w-2 h-10 rounded-full shrink-0 ${
                    inc.severity === 'critical' ? 'bg-red-500' :
                    inc.severity === 'high'     ? 'bg-orange-500' :
                    inc.severity === 'medium'   ? 'bg-yellow-500' : 'bg-gray-600'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-foreground font-medium text-sm">
                        {INCIDENT_TYPES.find(t => t.value === inc.type)?.label ?? inc.type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${s.bg} ${s.color}`}>{s.label}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[inc.status] ?? 'badge badge-gray'}`}>
                        {inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-xs truncate">{inc.description}</p>
                    <p className="text-gray-600 text-xs mt-0.5 dark:text-gray-400">
                      {inc.location && `${inc.location} · `}
                      {new Date(inc.occurredAt).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      {(inc.employeeFirstName) && ` · ${inc.employeeFirstName} ${inc.employeeLastName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setConfirm({ message: 'Delete this incident report? This cannot be undone.', confirmLabel: 'Delete', onConfirm: () => deleteIncident(inc.id) }) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-red-500 hover:bg-red-900/20 transition"
                      title="Delete incident"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <span className="text-gray-500 text-xs dark:text-gray-400">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{inc.description}</p>

                    {/* Status actions */}
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 self-center dark:text-gray-400">Move to:</span>
                      {inc.status !== 'investigating' && (
                        <button onClick={() => updateStatus(inc.id, 'investigating')}
                          className="text-xs border border-amber-400 dark:border-amber-800 text-amber-600 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 px-3 py-1.5 rounded-lg transition">
                          Investigating
                        </button>
                      )}
                      {inc.status !== 'closed' && (
                        <button onClick={() => updateStatus(inc.id, 'closed')}
                          className="text-xs border border-green-400 dark:border-green-800 text-green-600 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30 px-3 py-1.5 rounded-lg transition">
                          Close
                        </button>
                      )}
                      {inc.status === 'closed' && (
                        <button onClick={() => updateStatus(inc.id, 'open')}
                          className="text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition">
                          Reopen
                        </button>
                      )}
                    </div>

                    {/* Corrective actions */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">Corrective Actions</p>
                      {inc.correctiveActions.length > 0 && (
                        <ul className="space-y-1 mb-2">
                          {inc.correctiveActions.map(a => (
                            <li key={a.id} className="flex items-center gap-2 text-sm cursor-pointer group"
                              onClick={() => toggleAction(inc, a.id)}>
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
                                a.done ? 'bg-green-600 border-green-600' : 'border-gray-600 group-hover:border-gray-400'
                              }`}>
                                {a.done && <span className="text-white text-xs"></span>}
                              </div>
                              <span className={a.done ? 'line-through text-gray-500' : 'text-gray-300'}>{a.action}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <ActionInput onAdd={action => addAction(inc, action)} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}

function ActionInput({ onAdd }: { onAdd: (a: string) => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="flex gap-2">
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onAdd(val.trim()); setVal('') } }}
        placeholder="Add corrective action… (press Enter)"
        className="flex-1 input-premium py-1.5 text-xs" />
      <button type="button" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal('') } }}
        className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg transition">
        Add
      </button>
    </div>
  )
}
