'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { useState, useEffect, useCallback } from 'react'

type Record_ = {
  id: string; employeeId: string; checkType: string; status: string
  referenceNumber: string | null; issuedDate: string | null; expiryDate: string | null
  notes: string | null; verifiedAt: string | null; createdAt: string
  firstName: string | null; lastName: string | null; email: string | null
}
type Stats = { total: number; green: number; amber: number; red: number; pending: number; expiringSoon: number }
type Employee = { id: string; firstName: string; lastName: string }

const CHECK_TYPES = [
  'police_check', 'wwcc', 'ndis_screening', 'aged_care_check',
  'working_rights', 'first_aid', 'manual_handling', 'infection_control',
]

const STATUS_COLORS: Record<string, string> = {
  green:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  amber:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  red:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  pending: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const STATUS_DOT: Record<string, string> = {
  green: 'bg-green-500', amber: 'bg-yellow-500', red: 'bg-red-500', pending: 'bg-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  green: 'Clear', amber: 'Amber', red: 'Expired / Failed', pending: 'Pending',
}

function expiryColorClass(expiryDate: string | null): string {
  if (!expiryDate) return 'text-gray-400'
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-red-600 dark:text-red-400 font-semibold'
  if (days <= 30) return 'text-amber-600 dark:text-amber-400 font-medium'
  return 'text-green-600 dark:text-green-400'
}

function expiryLabel(expiryDate: string | null): string {
  if (!expiryDate) return '—'
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)
  const dateStr = new Date(expiryDate).toLocaleDateString('en-AU')
  if (days < 0) return `${dateStr} (expired ${Math.abs(days)}d ago)`
  if (days === 0) return `${dateStr} (expires today)`
  return `${dateStr} (${days}d)`
}

const EMPTY_FORM = {
  employeeId: '', checkType: 'police_check', status: 'pending',
  referenceNumber: '', issuedDate: '', expiryDate: '', notes: '',
}

export default function ScreeningPage() {
  const [records, setRecords]     = useState<Record_[]>([])
  const [stats, setStats]         = useState<Stats>({ total:0,green:0,amber:0,red:0,pending:0,expiringSoon:0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatus] = useState('')
  const [typeFilter, setType]     = useState('')
  const [search, setSearch]       = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editRecord, setEditRecord] = useState<Record_ | null>(null)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [editForm, setEditForm]   = useState({ ...EMPTY_FORM })
  const [confirm, setConfirm]     = useState<ConfirmState>(null)
  const [toast, setToast]         = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (statusFilter) p.set('status', statusFilter)
    if (typeFilter)   p.set('checkType', typeFilter)
    if (search)       p.set('search', search)
    const res = await fetchWithAuth(`/api/tenant/screening?${p}`)
    if (res.ok) {
      const d = await res.json()
      setRecords(d.records ?? [])
      setStats(d.stats ?? {})
    }
    setLoading(false)
  }, [statusFilter, typeFilter, search])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetchWithAuth('/api/tenant/employees?limit=200')
      .then(r => r.json())
      .then(d => setEmployees(d.employees ?? []))
  }, [])

  // ── Create ──────────────────────────────────────────────────────────────
  async function create() {
    if (!form.employeeId) return
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/tenant/screening', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setShowCreate(false)
      setForm({ ...EMPTY_FORM })
      setToast({ message: 'Screening record added', type: 'success' })
      load()
    } catch {
      setToast({ message: 'Failed to add record', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  function openEdit(r: Record_) {
    setEditRecord(r)
    setEditForm({
      employeeId:      r.employeeId,
      checkType:       r.checkType,
      status:          r.status,
      referenceNumber: r.referenceNumber ?? '',
      issuedDate:      r.issuedDate ?? '',
      expiryDate:      r.expiryDate ?? '',
      notes:           r.notes ?? '',
    })
  }

  async function saveEdit() {
    if (!editRecord) return
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/tenant/screening', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:              editRecord.id,
          checkType:       editForm.checkType,
          status:          editForm.status,
          referenceNumber: editForm.referenceNumber || null,
          issuedDate:      editForm.issuedDate || null,
          expiryDate:      editForm.expiryDate || null,
          notes:           editForm.notes || null,
        }),
      })
      if (!res.ok) throw new Error()
      setEditRecord(null)
      setToast({ message: 'Record updated', type: 'success' })
      load()
    } catch {
      setToast({ message: 'Failed to update record', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function confirmDelete(r: Record_) {
    setConfirm({
      message: `Delete the ${r.checkType.replace(/_/g, ' ')} check for ${r.firstName} ${r.lastName}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => doDelete(r.id),
    })
  }

  async function doDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetchWithAuth(`/api/tenant/screening?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setToast({ message: 'Record deleted', type: 'success' })
      load()
    } catch {
      setToast({ message: 'Failed to delete record', type: 'error' })
    } finally {
      setDeleting(null)
    }
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  function handleExport() {
    exportCsv({
      filename: `screening-checks-${new Date().toISOString().slice(0,10)}`,
      columns: [
        { header: 'Employee', key: 'firstName', format: (_,r) => `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() },
        { header: 'Email',            key: 'email' },
        { header: 'Check Type',       key: 'checkType', format: v => String(v).replace(/_/g,' ') },
        { header: 'Status',           key: 'status' },
        { header: 'Reference #',      key: 'referenceNumber' },
        { header: 'Issued Date',      key: 'issuedDate',  format: fmtCsvDate },
        { header: 'Expiry Date',      key: 'expiryDate',  format: fmtCsvDate },
        { header: 'Verified At',      key: 'verifiedAt',  format: fmtCsvDate },
        { header: 'Notes',            key: 'notes' },
        { header: 'Created',          key: 'createdAt',   format: fmtCsvDate },
      ],
      rows: records as any,
    })
    setToast({ message: 'CSV exported', type: 'success' })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Screening &amp; Checks</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Police checks, WWCC, NDIS screening, working rights</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExport} disabled={records.length === 0} />
          <button
            onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreate(true) }}
            className="btn-primary"
          >
            + Add Check
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex gap-6 flex-wrap">
        {[
          { label: 'Total',          value: stats.total,       cls: 'text-gray-900 dark:text-white' },
          { label: 'Clear',          value: stats.green,       cls: 'text-green-600 dark:text-green-400' },
          { label: 'Amber',          value: stats.amber,       cls: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Expired/Failed', value: stats.red,         cls: 'text-red-600 dark:text-red-400' },
          { label: 'Pending',        value: stats.pending,     cls: 'text-gray-500 dark:text-gray-400' },
          { label: 'Expiring ≤30d',  value: stats.expiringSoon,cls: 'text-orange-600 dark:text-orange-400' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex gap-2 flex-wrap">
        <input
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]"
          placeholder="Search employee, email, reference…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm"
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="green">Clear</option>
          <option value="amber">Amber</option>
          <option value="red">Expired / Failed</option>
          <option value="pending">Pending</option>
        </select>
        <select
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1.5 text-sm"
          value={typeFilter}
          onChange={e => setType(e.target.value)}
        >
          <option value="">All types</option>
          {CHECK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon="🛡️"
            title="No screening records found"
            message={search || statusFilter || typeFilter ? 'Try adjusting your filters.' : 'Add the first screening check to get started.'}
            action={!search && !statusFilter && !typeFilter ? { label: '+ Add Check', onClick: () => { setForm({ ...EMPTY_FORM }); setShowCreate(true) } } : undefined}
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Check Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Reference #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Issued</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Expiry</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr
                  key={r.id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition group"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{r.firstName} {r.lastName}</p>
                    {r.email && <p className="text-xs text-gray-400 dark:text-gray-500">{r.email}</p>}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-300">{r.checkType.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[r.status] ?? ''}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[r.status] ?? 'bg-gray-400'}`} />
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.referenceNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {r.issuedDate ? new Date(r.issuedDate).toLocaleDateString('en-AU') : '—'}
                  </td>
                  <td className={`px-4 py-3 text-xs ${expiryColorClass(r.expiryDate)}`}>
                    {expiryLabel(r.expiryDate)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => openEdit(r)}
                        title="Edit"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#0E3D52] dark:text-[#4ebac4] hover:bg-[#E0EEF4] dark:hover:bg-[#0E3D52]/15 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => confirmDelete(r)}
                        disabled={deleting === r.id}
                        title="Delete"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition disabled:opacity-40"
                      >
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
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay">
          <div className="card-premium w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Screening Record</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee *</label>
                <select className="input-premium" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check Type *</label>
                <select className="input-premium" value={form.checkType} onChange={e => setForm(f => ({ ...f, checkType: e.target.value }))}>
                  {CHECK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reference #</label>
                  <input className="input-premium" placeholder="Optional" value={form.referenceNumber} onChange={e => setForm(f => ({ ...f, referenceNumber: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issued Date</label>
                  <input type="date" className="input-premium" value={form.issuedDate} onChange={e => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                <input type="date" className="input-premium" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea rows={2} className="input-premium resize-none" placeholder="Optional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
              <button onClick={create} disabled={saving || !form.employeeId} className="flex-1 btn-primary disabled:opacity-50 transition">
                {saving ? 'Adding…' : 'Add Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editRecord && (
        <div className="modal-overlay">
          <div className="card-premium w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Screening Record</h3>
              <button onClick={() => setEditRecord(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {editRecord.firstName} {editRecord.lastName}
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check Type</label>
                  <select className="input-premium" value={editForm.checkType} onChange={e => setEditForm(f => ({ ...f, checkType: e.target.value }))}>
                    {CHECK_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select className="input-premium" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pending">Pending</option>
                    <option value="amber">Amber — Submitted</option>
                    <option value="green">Clear — Verified</option>
                    <option value="red">Expired / Failed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reference #</label>
                <input className="input-premium" placeholder="Optional" value={editForm.referenceNumber} onChange={e => setEditForm(f => ({ ...f, referenceNumber: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issued Date</label>
                  <input type="date" className="input-premium" value={editForm.issuedDate} onChange={e => setEditForm(f => ({ ...f, issuedDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiry Date</label>
                  <input type="date" className="input-premium" value={editForm.expiryDate} onChange={e => setEditForm(f => ({ ...f, expiryDate: e.target.value }))} />
                </div>
              </div>
              {editForm.expiryDate && (
                <p className={`text-xs ${expiryColorClass(editForm.expiryDate)}`}>
                  {expiryLabel(editForm.expiryDate)}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea rows={3} className="input-premium resize-none" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {editRecord.verifiedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Verified: {new Date(editRecord.verifiedAt).toLocaleString('en-AU')}
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditRecord(null)} className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 btn-primary disabled:opacity-50 transition">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
