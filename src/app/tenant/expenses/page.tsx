'use client'

import { useState, useEffect, useRef } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate, fmtCsvCurrency } from '@/lib/exportCsv'

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid'

interface Claim {
  id: string
  title: string
  category: string
  amount: string
  currency: string
  expenseDate: string
  description: string | null
  receiptUrl: string | null
  status: ExpenseStatus
  submittedAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  paidAt: string | null
  employeeId: string
  employeeFirstName: string | null
  employeeLastName: string | null
  employeeEmail?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'travel', 'meals', 'accommodation', 'equipment', 'training', 'software',
  'office_supplies', 'client_entertainment', 'marketing', 'other',
]
const CAT_LABELS: Record<string, string> = {
  travel:               'Travel',
  meals:                'Meals',
  accommodation:        'Accommodation',
  equipment:            'Equipment',
  training:             'Training',
  software:             'Software',
  office_supplies:      'Office Supplies',
  client_entertainment: 'Client Entertainment',
  marketing:            'Marketing',
  other:                'Other',
}

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  pending:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  approved: 'bg-[#E0EEF4] text-blue-800 dark:bg-[#0E3D52]/20 dark:text-[#7dcfd7]',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  paid:     'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}

function fmt(n: string | number, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(Number(n))
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Badge({ status }: { status: ExpenseStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function totalByStatus(claims: Claim[], status: ExpenseStatus) {
  return claims.filter(c => c.status === status).reduce((s, c) => s + Number(c.amount), 0)
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────

function SubmitModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: '', category: 'travel', amount: '', expenseDate: '',
    description: '',
  })
  const [file, setFile]       = useState<File | null>(null)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const fileRef               = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (file) fd.append('receipt', file)

      const res = await fetchWithAuth('/api/tenant/expenses', { method: 'POST', body: fd })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Submit Expense Claim</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input
              required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Flight to Sydney — Client Meeting"
              className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
              <select
                required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (AUD) *</label>
              <input
                required type="number" min="0.01" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expense Date *</label>
            <input
              required type="date" value={form.expenseDate}
              onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
              className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Provide additional context..."
              className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Receipt (optional)</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed dark:border-gray-600 rounded-lg p-4 text-center text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 transition-colors">
              {file ? `✓ ${file.name}` : '📎 Click to attach receipt (PDF/JPG/PNG)'}
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 text-sm bg-[#0E3D52] text-white rounded-lg hover:bg-[#1A6080] disabled:opacity-50">
              {saving ? 'Submitting…' : 'Submit Claim'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Review Modal ─────────────────────────────────────────────────────────────

function ReviewModal({ claim, onClose, onSaved }: { claim: Claim; onClose: () => void; onSaved: () => void }) {
  const [action, setAction] = useState<'approve' | 'reject' | 'pay' | null>(null)
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleAction(act: 'approve' | 'reject' | 'pay') {
    setSaving(true)
    setError('')
    try {
      const res = await fetchWithAuth(`/api/tenant/expenses/${claim.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act, reviewNotes: notes }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review Expense Claim</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}

          {/* Claim summary */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Employee</span>
              <span className="font-medium text-gray-900 dark:text-white">{claim.employeeFirstName} {claim.employeeLastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Claim</span>
              <span className="font-medium text-gray-900 dark:text-white">{claim.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Category</span>
              <span className="font-medium text-gray-900 dark:text-white">{CAT_LABELS[claim.category] ?? claim.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Amount</span>
              <span className="font-semibold text-lg text-gray-900 dark:text-white">{fmt(claim.amount, claim.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Date</span>
              <span className="text-gray-900 dark:text-white">{fmtDate(claim.expenseDate)}</span>
            </div>
            {claim.description && (
              <div className="pt-2 border-t dark:border-gray-600">
                <p className="text-gray-600 dark:text-gray-300 text-xs">{claim.description}</p>
              </div>
            )}
            {claim.receiptUrl && (
              <div className="pt-2">
                <a href={claim.receiptUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] hover:underline text-xs">
                  📎 View Receipt
                </a>
              </div>
            )}
          </div>

          {claim.status === 'pending' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Review Notes (optional)</label>
                <textarea
                  rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Add notes for the employee..."
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => handleAction('reject')} disabled={saving}
                  className="flex-1 px-4 py-2 text-sm bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 disabled:opacity-50">
                  Reject
                </button>
                <button onClick={() => handleAction('approve')} disabled={saving}
                  className="flex-1 px-4 py-2 text-sm bg-[#0E3D52] text-white rounded-lg hover:bg-[#1A6080] disabled:opacity-50">
                  {saving ? 'Processing…' : 'Approve'}
                </button>
              </div>
            </>
          )}

          {claim.status === 'approved' && (
            <button onClick={() => handleAction('pay')} disabled={saving}
              className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Processing…' : '✓ Mark as Paid'}
            </button>
          )}

          {(claim.status === 'rejected' || claim.status === 'paid') && claim.reviewNotes && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">Review Notes:</span> {claim.reviewNotes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [claims, setClaims]         = useState<Claim[]>([])
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatus]   = useState<string>('all')
  const [catFilter, setCat]         = useState<string>('all')
  const [search, setSearch]         = useState('')
  const [showSubmit, setShowSubmit] = useState(false)
  const [reviewing, setReviewing]   = useState<Claim | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [toast, setToast]           = useState<ToastState>(null)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (catFilter !== 'all')    params.set('category', catFilter)
      const res  = await fetchWithAuth(`/api/tenant/expenses?${params}`)
      const data = await res.json()
      setClaims(data.claims ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter, catFilter])

  const filtered = claims.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.title.toLowerCase().includes(q) ||
      (c.employeeFirstName?.toLowerCase().includes(q)) ||
      (c.employeeLastName?.toLowerCase().includes(q)) ||
      CAT_LABELS[c.category]?.toLowerCase().includes(q)
    )
  })

  function handleDelete(c: Claim) {
    setConfirmState({
      message: `Delete expense claim "${c.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/tenant/expenses/${c.id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error()
          setClaims(prev => prev.filter(x => x.id !== c.id))
          setToast({ message: 'Expense claim deleted', type: 'success' })
        } catch {
          setToast({ message: 'Failed to delete claim', type: 'error' })
        }
      },
    })
  }

  const pending  = claims.filter(c => c.status === 'pending').length
  const totPending  = totalByStatus(claims, 'pending')
  const totApproved = totalByStatus(claims, 'approved')
  const totPaid     = totalByStatus(claims, 'paid')

  function exportExpenses() {
    exportCsv({
      filename: 'expenses',
      columns: [
        { header: 'Employee Name', key: 'employeeFirstName', format: (_, r) => `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim() },
        { header: 'Category', key: 'category', format: v => CAT_LABELS[v] ?? v },
        { header: 'Amount', key: 'amount', format: v => fmtCsvCurrency(v) },
        { header: 'Date', key: 'expenseDate', format: v => fmtCsvDate(v) },
        { header: 'Status', key: 'status' },
        { header: 'Description', key: 'description', format: v => v ?? '' },
        { header: 'Receipt', key: 'receiptUrl', format: v => v ?? '' },
      ],
      rows: claims,
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-premium-title">Expense Claims</h1>
          <p className="page-premium-subtitle mt-1">Submit and manage employee expense reimbursements</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportExpenses} disabled={claims.length === 0} />
          <button onClick={() => setShowSubmit(true)}
          className="px-4 py-2 bg-[#0E3D52] text-white text-sm font-medium rounded-lg hover:bg-[#1A6080] transition-colors">
          + Submit Claim
        </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', value: pending, sub: fmt(totPending), color: 'yellow' },
          { label: 'Approved',       value: claims.filter(c => c.status === 'approved').length, sub: fmt(totApproved), color: 'blue' },
          { label: 'Paid Out',       value: claims.filter(c => c.status === 'paid').length, sub: fmt(totPaid), color: 'green' },
          { label: 'Total Claims',   value: claims.length, sub: fmt(claims.reduce((s, c) => s + Number(c.amount), 0)), color: 'gray' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
            <p className="page-premium-subtitle mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text" placeholder="Search claims…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <select value={statusFilter} onChange={e => setStatus(e.target.value)}
          className="border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
        <select value={catFilter} onChange={e => setCat(e.target.value)}
          className="border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500 dark:text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
            <p className="text-lg">No claims found</p>
            <p className="text-sm mt-1">Submit your first expense claim to get started</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-premium">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                {['Employee', 'Claim', 'Category', 'Amount', 'Date', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 ">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {c.employeeFirstName} {c.employeeLastName}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{c.title}</div>
                    {c.description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{c.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {CAT_LABELS[c.category] ?? c.category}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {fmt(c.amount, c.currency)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {fmtDate(c.expenseDate)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setReviewing(c)}
                        className="text-xs text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] hover:underline font-medium">
                        {c.status === 'pending' ? 'Review' : 'View'}
                      </button>
                      {c.receiptUrl && (
                        <a href={c.receiptUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                          Receipt
                        </a>
                      )}
                      {c.status === 'pending' && <button onClick={() => handleDelete(c)}
                        title="Delete"
                        className="text-gray-400 hover:text-red-500 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSubmit && <SubmitModal onClose={() => setShowSubmit(false)} onSaved={load} />}
      {reviewing  && <ReviewModal claim={reviewing} onClose={() => setReviewing(null)} onSaved={load} />}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
