'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'

// ── Types ──────────────────────────────────────────────────────────────────
type ScreeningRecord = {
  id: string; employeeId: string; checkType: string; status: string
  referenceNumber: string | null; issuedDate: string | null; expiryDate: string | null
  notes: string | null; verifiedAt: string | null; createdAt: string
  employeeFirstName: string | null; employeeLastName: string | null
  employeeEmail: string | null; employeeIsActive: boolean | null; employeeNdis: boolean | null
}
type TrackingRecord = {
  id: string; employeeId: string; itemType: string; status: string
  dueDate: string | null; lastCheckedAt: string | null; escalatedAt: string | null
  notes: string | null; updatedAt: string
  employeeFirstName: string | null; employeeLastName: string | null; employeeEmail: string | null
}
type LockException = {
  id: string; employeeId: string; reason: string; expiresAt: string
  approvedAt: string; isActive: boolean
  employeeFirstName: string | null; employeeLastName: string | null; employeeEmail: string | null
}
type ScreeningStats = { total: number; green: number; amber: number; red: number; pending: number; expiring: number; expired: number }
type TrackingStats  = { total: number; green: number; amber: number; red: number; pending: number }
type Employee       = { id: string; firstName: string; lastName: string }

// ── Constants ──────────────────────────────────────────────────────────────
const CHECK_TYPES = [
  'Police Check', 'NDIS Worker Screening', 'Working with Children Check',
  'Right to Work', 'Qualification Verification', 'Reference Check', 'Other',
]

const STATUS_BADGE: Record<string, string> = {
  green:   'badge badge-green',
  amber:   'badge badge-amber',
  red:     'badge badge-red',
  pending: 'badge badge-gray',
}
const STATUS_DOT: Record<string, string> = {
  green: 'bg-green-400', amber: 'bg-amber-400', red: 'bg-red-400', pending: 'bg-gray-500',
}

const INPUT = 'input-premium'

function statusLabel(s: string) {
  if (s === 'in_progress') return 'In Progress'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function daysUntil(d: string | null) {
  if (!d) return null
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  return diff
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CompliancePage() {
  const [tab, setTab] = useState<'screening' | 'tracking' | 'lock'>('screening')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-premium-title">Compliance Centre</h1>
        <p className="page-premium-subtitle mt-1">Pre-employment screening, compliance tracking & lock exceptions</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-[#1A6080]/20 rounded-xl p-1 w-fit">
        {([
          { key: 'screening', label: 'Screening',   desc: 'Module 6' },
          { key: 'tracking',  label: 'Tracking',    desc: 'Module 8' },
          { key: 'lock',      label: 'Lock',        desc: 'Module 7' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-[#0E3D52] text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'screening' && <ScreeningTab />}
      {tab === 'tracking'  && <TrackingTab />}
      {tab === 'lock'      && <LockTab />}
    </div>
  )
}

// ── Screening Tab ──────────────────────────────────────────────────────────
function ScreeningTab() {
  const [records,   setRecords]   = useState<ScreeningRecord[]>([])
  const [stats,     setStats]     = useState<ScreeningStats>({ total:0, green:0, amber:0, red:0, pending:0, expiring:0, expired:0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState({ employeeId:'', checkType:'Police Check', referenceNumber:'', issuedDate:'', expiryDate:'', notes:'' })
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [confirm,   setConfirm]   = useState<ConfirmState>(null)
  const [toast,     setToast]     = useState<ToastState>(null)

  function handleExport() {
    exportCsv({
      filename: `compliance-screening-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { header: 'Employee', key: 'employeeFirstName', format: (_, r: ScreeningRecord) => `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim() },
        { header: 'Email', key: 'employeeEmail' },
        { header: 'Check Type', key: 'checkType' },
        { header: 'Status', key: 'status', format: (v: string) => statusLabel(v) },
        { header: 'Reference No.', key: 'referenceNumber', format: (v: string | null) => v ?? '' },
        { header: 'Issued Date', key: 'issuedDate', format: (v: string | null) => fmtCsvDate(v) },
        { header: 'Expiry Date', key: 'expiryDate', format: (v: string | null) => fmtCsvDate(v) },
        { header: 'Verified At', key: 'verifiedAt', format: (v: string | null) => fmtCsvDate(v) },
        { header: 'Notes', key: 'notes', format: (v: string | null) => v ?? '' },
      ],
      rows: records,
    })
  }

  const load = useCallback(async (s = search, f = filterStatus) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (s) p.set('search', s)
    if (f) p.set('status', f)
    const res  = await fetchWithAuth(`/api/tenant/compliance/screening?${p}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setStats(data.stats ?? { total:0,green:0,amber:0,red:0,pending:0,expiring:0,expired:0 })
    setLoading(false)
  }, [search, filterStatus])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=200').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/compliance/screening', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ employeeId:'', checkType:'Police Check', referenceNumber:'', issuedDate:'', expiryDate:'', notes:'' })
    setSaving(false)
    load()
  }

  async function updateStatus(id: string, status: string) {
    await fetchWithAuth('/api/tenant/compliance/screening', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setEditId(null)
    load()
  }

  function doDelete(r: ScreeningRecord) {
    setConfirm({
      message: `Delete ${r.checkType} check for ${r.employeeFirstName} ${r.employeeLastName}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/tenant/compliance/screening?id=${r.id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error()
          setRecords(prev => prev.filter(x => x.id !== r.id))
          setToast({ message: 'Screening record deleted', type: 'success' })
        } catch {
          setToast({ message: 'Failed to delete record', type: 'error' })
        }
      },
    })
  }

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Checks',   value: stats.total,    color: 'text-foreground' },
          { label: 'Verified',     value: stats.green,    color: 'text-green-400' },
          { label: 'Expiring <30d', value: stats.expiring, color: 'text-amber-400' },
          { label: 'Expired/Red',  value: stats.red + stats.expired, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); load(e.target.value, filterStatus) }}
          placeholder="Search employee…"
          className="flex-1 min-w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-[#1A6080]/20 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]" />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(search, e.target.value) }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-[#1A6080]/20 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="green">Verified</option>
          <option value="amber">Amber</option>
          <option value="red">Red / Expired</option>
        </select>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          {showForm ? 'Cancel' : '+ Add Check'}
        </button>
        <ExportButton onClick={handleExport} />
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={submit} className="card-premium border-[#0E3D52]/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#4ebac4]">New Screening Check</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
              <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Check Type *</label>
              <select required value={form.checkType} onChange={e => setForm(f => ({ ...f, checkType: e.target.value }))} className={INPUT}>
                {CHECK_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Reference No.</label>
              <input value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))}
                placeholder="e.g. NWS-12345" className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Issued Date</label>
              <input type="date" value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Expiry Date</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes" className={INPUT} />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
            {saving ? 'Saving…' : 'Add Check'}
          </button>
        </form>
      )}

      {/* Table */}
      {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : (
        <div className="card-premium overflow-hidden">
          {records.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2"></p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">No screening records. Add the first check above.</p>
            </div>
          ) : (
          <div className="table-responsive">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Check Type</th>
                  <th>Status</th>
                  <th>Ref No.</th>
                  <th>Expiry</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => {
                  const days = daysUntil(r.expiryDate)
                  const expiryWarning = days !== null && days >= 0 && days <= 30
                  const expired       = days !== null && days < 0
                  return (
                    <tr key={r.id} className="cursor-default">
                      <td className="px-5 py-3.5">
                        <p className="text-foreground font-medium text-sm">{r.employeeFirstName} {r.employeeLastName}</p>
                        <p className="text-gray-500 text-xs dark:text-gray-400">{r.employeeEmail}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-gray-600 dark:text-gray-300 text-sm">{r.checkType}</span>
                        {r.employeeNdis && <span className="ml-2 text-xs bg-[#E0EEF4] dark:bg-[#0E3D52]/20 text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#7dcfd7] px-1.5 py-0.5 rounded">NDIS</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {editId === r.id ? (
                          <div className="flex gap-1">
                            {(['pending','green','amber','red'] as const).map(s => (
                              <button key={s} onClick={() => updateStatus(r.id, s)}
                                className={`${STATUS_BADGE[s]} hover:opacity-80 cursor-pointer`}>
                                {statusLabel(s)}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className={`capitalize ${STATUS_BADGE[r.status] ?? STATUS_BADGE.pending}`}>
                            {statusLabel(r.status)}
                          </span>
                        )}
                      </td>
                      <td className="text-xs">{r.referenceNumber ?? '—'}</td>
                      <td className="px-5 py-3.5 text-xs">
                        {r.expiryDate ? (
                          <span className={expired ? 'text-red-400 font-medium' : expiryWarning ? 'text-amber-400 font-medium' : 'text-gray-400'}>
                            {new Date(r.expiryDate).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}
                            {expired       && ' (Expired)'}
                            {expiryWarning && !expired && ` (${days}d)`}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditId(editId === r.id ? null : r.id)}
                            className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] font-medium">
                            {editId === r.id ? 'Cancel' : 'Update ↓'}
                          </button>
                          <button onClick={() => doDelete(r)} title="Delete"
                            className="text-gray-500 hover:text-red-400 transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
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
      )}
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}

// ── Tracking Tab ───────────────────────────────────────────────────────────
function TrackingTab() {
  const [records,   setRecords]   = useState<TrackingRecord[]>([])
  const [stats,     setStats]     = useState<TrackingStats>({ total:0, green:0, amber:0, red:0, pending:0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState({ employeeId:'', itemType:'', dueDate:'', notes:'' })
  const [confirmTrk, setConfirmTrk] = useState<ConfirmState>(null)
  const [toastTrk,   setToastTrk]   = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetchWithAuth('/api/tenant/compliance/tracking')
    const data = await res.json()
    setRecords(data.records ?? [])
    setStats(data.stats ?? { total:0,green:0,amber:0,red:0,pending:0 })
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=200').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/compliance/tracking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ employeeId:'', itemType:'', dueDate:'', notes:'' })
    setSaving(false)
    load()
  }

  async function updateStatus(id: string, status: string) {
    await fetchWithAuth('/api/tenant/compliance/tracking', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  function deleteTrk(r: TrackingRecord) {
    setConfirmTrk({
      message: `Delete compliance item "${r.itemType}" for ${r.employeeFirstName} ${r.employeeLastName}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/tenant/compliance/tracking?id=${r.id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error()
          setRecords(prev => prev.filter(x => x.id !== r.id))
          setToastTrk({ message: 'Compliance item deleted', type: 'success' })
        } catch {
          setToastTrk({ message: 'Failed to delete item', type: 'error' })
        }
      },
    })
  }

  return (
    <div className="space-y-5">
      {/* Overview cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',   value: stats.total,   color: 'text-foreground' },
          { label: 'Green', value: stats.green,   color: 'text-green-400' },
          { label: 'Amber', value: stats.amber,   color: 'text-amber-400' },
          { label: 'Red',   value: stats.red,     color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)}
          className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-premium border-[#0E3D52]/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#4ebac4]">New Compliance Item</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
              <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Item Type *</label>
              <input required value={form.itemType} onChange={e => setForm(f => ({ ...f, itemType: e.target.value }))}
                placeholder="e.g. NDIS Renewal, Annual Declaration" className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" className={INPUT} />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
            {saving ? 'Saving…' : 'Add Item'}
          </button>
        </form>
      )}

      {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : (
        <div className="card-premium overflow-hidden">
          {records.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2"></p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">No compliance tracking items yet.</p>
            </div>
          ) : (
          <div className="table-responsive">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Item</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Last Checked</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td className="px-5 py-3.5">
                      <p className="text-foreground font-medium">{r.employeeFirstName} {r.employeeLastName}</p>
                      <p className="text-gray-500 text-xs dark:text-gray-400">{r.employeeEmail}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{r.itemType}</td>
                    <td className="px-5 py-3.5">
                      <span className={`capitalize ${STATUS_BADGE[r.status] ?? STATUS_BADGE.pending}`}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 text-xs">
                      {r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs dark:text-gray-400">
                      {r.lastCheckedAt ? new Date(r.lastCheckedAt).toLocaleDateString('en-AU') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {(['green','amber','red'] as const).map(s => (
                            <button key={s} onClick={() => updateStatus(r.id, s)}
                              className={`${STATUS_BADGE[s]} transition hover:opacity-80 cursor-pointer ${r.status === s ? 'ring-1 ring-white/30' : ''}`}>
                              {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => deleteTrk(r)} title="Delete"
                          className="text-gray-500 hover:text-red-400 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}
      <ConfirmModal state={confirmTrk} onClose={() => setConfirmTrk(null)} />
      <Toast state={toastTrk} onClose={() => setToastTrk(null)} />
    </div>
  )
}

// ── Lock Tab ───────────────────────────────────────────────────────────────
function LockTab() {
  const [records,   setRecords]   = useState<LockException[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState({ employeeId:'', reason:'', expiresAt:'' })
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetchWithAuth('/api/tenant/compliance/lock')
    const data = await res.json()
    setRecords(data.records ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=200').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/compliance/lock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ employeeId:'', reason:'', expiresAt:'' })
    setSaving(false)
    load()
  }

  async function revoke(id: string) {
    setConfirmState({
      message: 'Revoke this exception?',
      confirmLabel: 'Revoke',
      onConfirm: async () => {
        await fetchWithAuth('/api/tenant/compliance/lock', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, isActive: false }),
        })
        load()
      }
    })
  }

  const active   = records.filter(r => r.isActive && new Date(r.expiresAt) > new Date())
  const inactive = records.filter(r => !r.isActive || new Date(r.expiresAt) <= new Date())

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-300">
        ️ Compliance Lock exceptions allow non-compliant employees to temporarily work while gaps are resolved. Each exception requires a reason and expiry date and is logged for audit purposes.
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)}
          className="bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          {showForm ? 'Cancel' : '+ Grant Exception'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card-premium border-amber-500/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-amber-300">Grant Temporary Exception</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
              <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Exception Expires *</label>
              <input required type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Reason *</label>
            <textarea required value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={2} placeholder="Reason for granting exception…" className={INPUT} />
          </div>
          <button type="submit" disabled={saving}
            className="bg-amber-700 hover:bg-amber-600 disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
            {saving ? 'Granting…' : 'Grant Exception'}
          </button>
        </form>
      )}

      {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div>
              <p className="section-label mb-2">Active Exceptions ({active.length})</p>
              <div className="card-premium border-amber-500/30 overflow-hidden">
                {active.map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-4 border-b border-gray-200 dark:border-[#1A6080]/20/50 last:border-0">
                    <div className="flex-1">
                      <p className="text-foreground font-medium text-sm">{r.employeeFirstName} {r.employeeLastName}</p>
                      <p className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">{r.reason}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-amber-300">Expires {new Date(r.expiresAt).toLocaleDateString('en-AU')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Approved {new Date(r.approvedAt).toLocaleDateString('en-AU')}</p>
                    </div>
                    <button onClick={() => revoke(r.id)}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-800 px-2.5 py-1 rounded-lg transition">
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <p className="section-label mb-2">Expired / Revoked</p>
              <div className="card-premium overflow-hidden opacity-60">
                {inactive.slice(0,5).map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-3 border-b border-gray-200 dark:border-[#1A6080]/20/50 last:border-0">
                    <div className="flex-1">
                      <p className="text-gray-600 dark:text-gray-300 text-sm">{r.employeeFirstName} {r.employeeLastName}</p>
                      <p className="text-gray-500 text-xs dark:text-gray-400">{r.reason}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Expired {new Date(r.expiresAt).toLocaleDateString('en-AU')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {records.length === 0 && (
            <div className="card-premium py-12 text-center">
              <p className="text-3xl mb-2"></p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">No lock exceptions on record.</p>
            </div>
          )}
        </div>
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
