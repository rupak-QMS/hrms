'use client'

import { useState, useEffect } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv } from '@/lib/exportCsv'

interface ToilEntry {
  id: string
  employeeId: string
  employeeName?: string
  entryType: string
  workDate: string
  hours: string
  multiplier: string
  shiftId?: string
  timesheetId?: string
  description?: string
  status: string
  requestedAt?: string
  approvedBy?: string
  approvedAt?: string
  rejectedReason?: string
  createdBy?: string
  createdAt: string
}

interface ToilBalance {
  id: string
  employeeId: string
  employeeName?: string
  employeeEmail?: string
  balanceHours: string
  totalAccrued: string
  totalTaken: string
  expiryDate?: string
  updatedAt: string
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
}

const ENTRY_TYPE_LABEL: Record<string, string> = {
  accrual: 'Accrual', taken: 'Taken', adjustment: 'Adjustment', expired: 'Expired',
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const TYPE_COLORS: Record<string, string> = {
  accrual: 'text-green-600 dark:text-green-400',
  taken: 'text-red-600 dark:text-red-400',
  adjustment: 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]',
  expired: 'text-gray-500',
}

export default function ToilPage() {
  const [activeTab, setActiveTab] = useState<'balances' | 'entries' | 'pending'>('balances')
  const [balances, setBalances] = useState<ToilBalance[]>([])
  const [entries, setEntries] = useState<ToilEntry[]>([])
  const [pendingEntries, setPendingEntries] = useState<ToilEntry[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    employeeId: '', entryType: 'accrual', workDate: '', hours: '',
    multiplier: '1.0', description: '',
  })
  const [saving, setSaving] = useState(false)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [searchEntries, setSearchEntries] = useState('')

  useEffect(() => {
    loadBalances()
    loadPending()
    fetchWithAuth('/api/tenant/employees?limit=200')
      .then(r => r.json())
      .then(d => setEmployees(d.employees ?? []))
  }, [])

  useEffect(() => {
    if (selectedEmployee) loadEntries(selectedEmployee)
  }, [selectedEmployee])

  function loadBalances() {
    fetchWithAuth('/api/tenant/toil/balance')
      .then(r => r.json())
      .then(d => setBalances(d.balances ?? []))
      .catch(() => {})
  }

  function loadEntries(empId: string) {
    fetchWithAuth(`/api/tenant/toil?employeeId=${empId}`)
      .then(r => r.json())
      .then(d => setEntries(d.entries ?? []))
      .catch(() => {})
  }

  function loadPending() {
    fetchWithAuth('/api/tenant/toil?status=pending')
      .then(r => r.json())
      .then(d => setPendingEntries(d.entries ?? []))
      .catch(() => {})
  }

  async function saveEntry() {
    setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/toil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setShowModal(false)
      setForm({ employeeId: '', entryType: 'accrual', workDate: '', hours: '', multiplier: '1.0', description: '' })
      loadBalances()
      loadPending()
      if (form.employeeId === selectedEmployee) loadEntries(selectedEmployee)
    } finally {
      setSaving(false)
    }
  }

  async function approve(id: string) {
    await fetchWithAuth(`/api/tenant/toil/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    loadPending(); loadBalances()
    if (selectedEmployee) loadEntries(selectedEmployee)
  }

  async function deleteEntry(id: string) {
    try {
      const r = await fetchWithAuth(`/api/tenant/toil/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setEntries(prev => prev.filter(e => e.id !== id))
      setPendingEntries(prev => prev.filter(e => e.id !== id))
      loadBalances()
      setToast({ message: 'TOIL entry deleted', type: 'success' })
    } catch {
      setToast({ message: 'Failed to delete entry', type: 'error' })
    }
  }

  async function reject(id: string) {
    await fetchWithAuth(`/api/tenant/toil/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejectedReason: rejectReason }),
    })
    setRejecting(null); setRejectReason('')
    loadPending()
  }

  const fmtHours = (h: string) => {
    const n = parseFloat(h)
    return `${n >= 0 ? '+' : ''}${n.toFixed(2)}h`
  }

  function exportToilCsv() {
    exportCsv({
      filename: 'toil-balances',
      columns: [
        { header: 'Employee Name',  key: 'employeeName',  format: (v, r) => (v as string) ?? r.employeeId },
        { header: 'Hours Accrued',  key: 'totalAccrued',  format: v => parseFloat(String(v ?? 0)).toFixed(2) },
        { header: 'Hours Taken',    key: 'totalTaken',    format: v => parseFloat(String(v ?? 0)).toFixed(2) },
        { header: 'Balance',        key: 'balanceHours',  format: v => parseFloat(String(v ?? 0)).toFixed(2) },
        { header: 'Expiry Date',    key: 'expiryDate',    format: v => v ?? '' },
        { header: 'Last Updated',   key: 'updatedAt',     format: v => v ? new Date(v as string).toLocaleDateString('en-AU') : '' },
      ],
      rows: balances,
    })
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">TOIL Tracking</h2>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportToilCsv} disabled={balances.length === 0} />
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition font-medium"
          >
            + Record TOIL
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-[#1A6080]/30">
        {[
          { key: 'balances', label: 'All Balances' },
          { key: 'entries', label: 'Entry Ledger' },
          { key: 'pending', label: `Pending Approval${pendingEntries.length > 0 ? ` (${pendingEntries.length})` : ''}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as 'balances' | 'entries' | 'pending')}
            className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === key
                ? 'border-[#0E3D52] text-[#0E3D52] dark:text-[#4ebac4]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Balances tab */}
      {activeTab === 'balances' && (
        <div className="overflow-x-auto flex-1">
          <div className="table-responsive">
            <table className="table-premium">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 ">
                <th className="pb-2 pr-4">Employee</th>
                <th className="pb-2 pr-4">Balance</th>
                <th className="pb-2 pr-4">Total Accrued</th>
                <th className="pb-2 pr-4">Total Taken</th>
                <th className="pb-2 pr-4">Expiry</th>
                <th className="pb-2">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#1A6080]/30">
              {balances.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No TOIL balances yet. Record an accrual to get started.</td></tr>
              )}
              {balances.map(b => (
                <tr key={b.id} className="text-gray-700 dark:text-gray-300">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{b.employeeName ?? b.employeeId}</div>
                    {b.employeeEmail && <div className="text-xs text-gray-400">{b.employeeEmail}</div>}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`font-bold text-base ${parseFloat(b.balanceHours) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {parseFloat(b.balanceHours).toFixed(2)}h
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-green-600 dark:text-green-400">+{parseFloat(b.totalAccrued).toFixed(2)}h</td>
                  <td className="py-3 pr-4 text-red-600 dark:text-red-400">-{parseFloat(b.totalTaken).toFixed(2)}h</td>
                  <td className="py-3 pr-4">{b.expiryDate ?? '—'}</td>
                  <td className="py-3">{new Date(b.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Entries tab */}
      {activeTab === 'entries' && (
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex gap-3 flex-wrap">
            <select
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
            >
              <option value="">Select employee…</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
            {selectedEmployee && (
              <input
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                placeholder="Search entries…"
                value={searchEntries}
                onChange={e => setSearchEntries(e.target.value)}
              />
            )}
          </div>
          {!selectedEmployee ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p className="text-sm">Select an employee to view their TOIL ledger</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="table-responsive">
            <table className="table-premium">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 ">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Type</th>
                    <th className="pb-2 pr-4">Hours</th>
                    <th className="pb-2 pr-4">Multiplier</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Description</th>
                    <th className="pb-2">Approved By</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#1A6080]/30">
                  {entries.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-gray-400">No entries found</td></tr>
                  )}
                  {entries.filter(e => !searchEntries || e.workDate.includes(searchEntries) || (e.description ?? '').toLowerCase().includes(searchEntries.toLowerCase()) || (ENTRY_TYPE_LABEL[e.entryType] ?? '').toLowerCase().includes(searchEntries.toLowerCase())).map(e => (
                    <tr key={e.id} className="group text-gray-700 dark:text-gray-300">
                      <td className="py-2.5 pr-4">{e.workDate}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`font-medium capitalize ${TYPE_COLORS[e.entryType] ?? ''}`}>
                          {ENTRY_TYPE_LABEL[e.entryType] ?? e.entryType}
                        </span>
                      </td>
                      <td className={`py-2.5 pr-4 font-bold ${TYPE_COLORS[e.entryType] ?? ''}`}>
                        {e.entryType === 'accrual' ? '+' : '-'}{Math.abs(parseFloat(e.hours)).toFixed(2)}h
                      </td>
                      <td className="py-2.5 pr-4">{parseFloat(e.multiplier).toFixed(2)}×</td>
                      <td className="py-2.5 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[e.status] ?? ''}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500">{e.description ?? '—'}</td>
                      <td className="py-2.5 text-gray-500">{e.approvedBy ?? '—'}</td>
                      <td className="py-2.5">
                        <button
                          onClick={() => setConfirm({ message: 'Delete this TOIL entry?', confirmLabel: 'Delete', onConfirm: () => deleteEntry(e.id) })}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                          title="Delete entry"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
            </div>
          )}
        </div>
      )}

      {/* Pending approval tab */}
      {activeTab === 'pending' && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {pendingEntries.length === 0 && (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3 mx-auto ring-1 ring-green-200 dark:ring-green-800"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-500"><polyline points="20 6 9 17 4 12"/></svg></div>
                <p className="text-sm">No pending TOIL requests</p>
              </div>
            </div>
          )}
          {pendingEntries.map(entry => (
            <div key={entry.id} className="card-premium p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{entry.employeeName ?? entry.employeeId}</span>
                    <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 px-2 py-0.5 rounded-full">Pending</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    <span className="capitalize">{ENTRY_TYPE_LABEL[entry.entryType]}</span> · {entry.workDate} · <strong className="text-orange-600 dark:text-orange-400">{Math.abs(parseFloat(entry.hours)).toFixed(2)}h</strong> @ {parseFloat(entry.multiplier).toFixed(2)}×
                  </div>
                  {entry.description && <p className="text-xs text-gray-400 mt-0.5">{entry.description}</p>}
                  {entry.requestedAt && <p className="text-xs text-gray-400 mt-0.5">Requested {new Date(entry.requestedAt).toLocaleDateString()}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => approve(entry.id)}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setRejecting(entry.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition"
                  >
                    Reject
                  </button>
                </div>
              </div>
              {rejecting === entry.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                    placeholder="Reason for rejection…"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                  <button
                    onClick={() => reject(entry.id)}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => { setRejecting(null); setRejectReason('') }}
                    className="px-3 py-1.5 border border-gray-200 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-[#0E3D52]/40 transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {/* Record TOIL Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-[#0F1E2E] rounded-xl shadow-xl w-full max-w-md p-6 m-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Record TOIL</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Employee *</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">Select employee…</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Entry Type</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={form.entryType} onChange={e => setForm(f => ({ ...f, entryType: e.target.value }))}>
                    <option value="accrual">Accrual (overtime worked)</option>
                    <option value="taken">Taken (TOIL leave)</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Work Date *</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={form.workDate} onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Hours *</label>
                  <input type="number" step="0.25" min="0.25" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} placeholder="e.g. 2.5" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Multiplier</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={form.multiplier} onChange={e => setForm(f => ({ ...f, multiplier: e.target.value }))}>
                    <option value="1.0">1.0× (standard)</option>
                    <option value="1.5">1.5× (time and a half)</option>
                    <option value="2.0">2.0× (double time)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Emergency on-call weekend coverage" />
              </div>
              {form.entryType !== 'accrual' && (
                <div className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-3 py-2">
                  Non-accrual entries will require manager approval before the balance is updated.
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30 transition">
                Cancel
              </button>
              <button onClick={saveEntry} disabled={saving || !form.employeeId || !form.workDate || !form.hours}
                className="flex-1 py-2 rounded-lg bg-[#0E3D52] text-white text-sm font-medium hover:bg-[#1A6080] transition disabled:opacity-50">
                {saving ? 'Saving…' : 'Record TOIL'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
