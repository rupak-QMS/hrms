'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

type Benefit = {
  id: string
  employeeId: string
  type: string
  description: string | null
  startDate: string | null
  endDate: string | null
  notes: string | null
  createdAt: string
  employeeFirstName: string | null
  employeeLastName: string | null
}

type Employee = { id: string; firstName: string; lastName: string }

const BENEFIT_TYPES = [
  { value: 'eap',               label: 'Employee Assistance Program', emoji: '🧠', color: '#0E3D52' },
  { value: 'study_support',     label: 'Study Support',               emoji: '📚', color: '#3b82f6' },
  { value: 'discount',          label: 'Employee Discount',           emoji: '🏷️', color: '#f59e0b' },
  { value: 'wellbeing',         label: 'Wellbeing Allowance',         emoji: '💚', color: '#10b981' },
  { value: 'salary_packaging',  label: 'Salary Packaging',            emoji: '💼', color: '#E8973A' },
  { value: 'extra_leave',       label: 'Extra Leave',                 emoji: '🌴', color: '#14b8a6' },
  { value: 'flexible_work',     label: 'Flexible Work',               emoji: '🏠', color: '#f97316' },
  { value: 'other',             label: 'Other',                       emoji: '⭐', color: '#94a3b8' },
]

const INPUT = 'input-premium'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

const BLANK_FORM = { employeeId: '', type: 'eap', description: '', startDate: '', endDate: '', notes: '' }

function getStatus(b: Benefit): 'active' | 'expiring' | 'expired' | 'permanent' {
  const today = new Date().toISOString().slice(0, 10)
  if (!b.endDate) return 'permanent'
  if (b.endDate < today) return 'expired'
  const soon = new Date()
  soon.setDate(soon.getDate() + 30)
  if (b.endDate <= soon.toISOString().slice(0, 10)) return 'expiring'
  return 'active'
}

const STATUS_STYLE: Record<string, string> = {
  active:    'badge badge-green',
  expiring:  'badge badge-amber',
  expired:   'badge badge-gray',
  permanent: 'badge badge-blue',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Active', expiring: 'Expiring Soon', expired: 'Expired', permanent: 'Ongoing',
}

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BenefitsPage() {
  const [benefits,   setBenefits]   = useState<Benefit[]>([])
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [form,       setForm]       = useState(BLANK_FORM)
  const [filterEmp,  setFilterEmp]  = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [view,       setView]       = useState<'list' | 'grouped'>('list')
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const load = useCallback(async (empId = filterEmp) => {
    setLoading(true)
    const p = empId ? `?employeeId=${empId}` : ''
    const data = await fetchWithAuth(`/api/tenant/benefits${p}`).then(r => r.json())
    setBenefits(data.benefits ?? [])
    setLoading(false)
  }, [filterEmp])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    if (editingId) {
      await fetchWithAuth('/api/tenant/benefits', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...form }),
      })
    } else {
      await fetchWithAuth('/api/tenant/benefits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    setShowForm(false); setEditingId(null); setForm(BLANK_FORM); setSaving(false); load()
  }

  function openEdit(b: Benefit) {
    setForm({
      employeeId:  b.employeeId,
      type:        b.type,
      description: b.description ?? '',
      startDate:   b.startDate ?? '',
      endDate:     b.endDate ?? '',
      notes:       b.notes ?? '',
    })
    setEditingId(b.id)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false); setEditingId(null); setForm(BLANK_FORM)
  }

  async function remove(id: string) {
    setConfirmState({
      message: 'Remove this benefit?',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth('/api/tenant/benefits', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          })
          if (!res.ok) throw new Error()
          setBenefits(prev => prev.filter(b => b.id !== id))
          setToast({ message: 'Benefit removed', type: 'success' })
        } catch {
          setToast({ message: 'Failed to remove benefit', type: 'error' })
        }
      }
    })
  }

  // Filter + derived stats
  const filtered = benefits.filter(b => {
    if (filterType && b.type !== filterType) return false
    if (filterStatus) {
      const s = getStatus(b)
      if (s !== filterStatus) return false
    }
    return true
  })

  const stats = {
    total:    benefits.length,
    active:   benefits.filter(b => getStatus(b) === 'active' || getStatus(b) === 'permanent').length,
    expiring: benefits.filter(b => getStatus(b) === 'expiring').length,
    expired:  benefits.filter(b => getStatus(b) === 'expired').length,
  }

  // Grouped view: by benefit type
  const grouped = BENEFIT_TYPES.map(t => ({
    ...t,
    items: filtered.filter(b => b.type === t.value),
  })).filter(g => g.items.length > 0)

  const typeInfo = (type: string) => BENEFIT_TYPES.find(t => t.value === type)

  function exportBenefits() {
    exportCsv({
      filename: 'benefits',
      columns: [
        { header: 'Employee Name', key: 'employeeFirstName', format: (_, r) => `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim() },
        { header: 'Benefit Type', key: 'type', format: v => BENEFIT_TYPES.find(t => t.value === v)?.label ?? v },
        { header: 'Description', key: 'description', format: v => v ?? '' },
        { header: 'Start Date', key: 'startDate', format: v => fmtCsvDate(v) },
        { header: 'End Date', key: 'endDate', format: v => fmtCsvDate(v) },
        { header: 'Status', key: 'id', format: (_, r) => STATUS_LABEL[getStatus(r)] ?? '' },
      ],
      rows: benefits,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employee Benefits</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Track and manage benefit assignments across the team</p>
        </div>
        <div className="flex items-center gap-2">
        <ExportButton onClick={exportBenefits} disabled={benefits.length === 0} />
        <button onClick={() => { setForm(BLANK_FORM); setEditingId(null); setShowForm(v => !v) }}
          className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
          {showForm && !editingId ? 'Cancel' : '+ Assign Benefit'}
        </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Assigned', value: stats.total,    color: 'text-foreground' },
          { label: 'Active',         value: stats.active,   color: 'text-green-400' },
          { label: 'Expiring Soon',  value: stats.expiring, color: 'text-amber-400' },
          { label: 'Expired',        value: stats.expired,  color: 'text-gray-500' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={save} className="card-premium border-[#0E3D52]/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#4ebac4]">{editingId ? 'Edit Benefit' : 'Assign Benefit'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Employee *</label>
              <select required value={form.employeeId}
                onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                disabled={!!editingId} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Benefit Type *</label>
              <select required value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                {BENEFIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Start Date</label>
              <input type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>End Date <span className="text-gray-500">(leave blank = ongoing)</span></label>
              <input type="date" value={form.endDate} min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Description</label>
              <textarea rows={2} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Details of the benefit…" className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Internal Notes</label>
              <input value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="HR notes (not visible to employee)…" className={INPUT} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition font-medium">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Assign Benefit'}
            </button>
            <button type="button" onClick={cancelForm}
              className="px-4 py-2 border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterEmp} onChange={e => { setFilterEmp(e.target.value); load(e.target.value) }}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All types</option>
          {BENEFIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="permanent">Ongoing</option>
          <option value="expiring">Expiring Soon</option>
          <option value="expired">Expired</option>
        </select>
        {(filterType || filterStatus) && (
          <button onClick={() => { setFilterType(''); setFilterStatus('') }}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg transition">
            Clear
          </button>
        )}
        <div className="ml-auto flex gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-lg p-1">
          {(['list', 'grouped'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition capitalize ${
                view === v ? 'bg-white dark:bg-gray-900 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-300'
              }`}>
              {v === 'list' ? '☰ List' : '⊞ Grouped'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-premium py-14 text-center">
          <div className="text-4xl mb-3">🎁</div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">No benefits found</p>
          <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">
            {benefits.length > 0 ? 'Try adjusting your filters' : 'Assign a benefit to get started'}
          </p>
        </div>
      ) : view === 'list' ? (
        /* ── LIST VIEW ── */
        <div className="card-premium overflow-hidden">
          <div className="table-responsive">
            <table className="table-premium">
            <thead>
              <tr>
                {['Employee', 'Benefit', 'Status', 'Period', 'Description', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold  text-gray-600 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const status = getStatus(b)
                const info   = typeInfo(b.type)
                return (
                  <tr key={b.id} className="border-b border-gray-100 dark:border-[#1A6080]/20/50 last:border-0 hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30/20 transition">
                    <td className="px-4 py-3.5">
                      <p className="text-foreground font-medium">{b.employeeFirstName} {b.employeeLastName}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="flex items-center gap-1.5 text-sm text-gray-300">
                        <span>{info?.emoji}</span>
                        <span>{info?.label ?? b.type}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                      {b.startDate ? fmt(b.startDate) : '—'}
                      {b.endDate ? ` → ${fmt(b.endDate)}` : b.startDate ? ' → ongoing' : ''}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-400 max-w-xs truncate">
                      {b.description ?? '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(b)}
                          className="text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-2.5 py-1 rounded-lg transition">
                          Edit
                        </button>
                        <button onClick={() => remove(b.id)}
                          className="text-xs border border-red-900 text-red-400 hover:bg-red-900/20 px-2.5 py-1 rounded-lg transition">
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        /* ── GROUPED VIEW ── */
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.value} className="card-premium overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-[#1A6080]/20"
                style={{ borderLeft: `4px solid ${group.color}` }}>
                <span className="text-xl">{group.emoji}</span>
                <p className="text-sm font-semibold text-foreground">{group.label}</p>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{group.items.length} assigned</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-[#1A6080]/20/50">
                {group.items.map(b => {
                  const status = getStatus(b)
                  return (
                    <div key={b.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium">{b.employeeFirstName} {b.employeeLastName}</p>
                        {b.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{b.description}</p>}
                        <p className="text-xs text-gray-600 dark:text-gray-500 mt-0.5">
                          {b.startDate ? fmt(b.startDate) : 'No start'}
                          {b.endDate ? ` → ${fmt(b.endDate)}` : ' → ongoing'}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_STYLE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => openEdit(b)}
                          className="text-xs border border-gray-700 text-gray-400 hover:text-white px-2 py-1 rounded-lg transition">
                          Edit
                        </button>
                        <button onClick={() => remove(b.id)}
                          className="text-xs border border-red-900 text-red-400 hover:bg-red-900/20 px-2 py-1 rounded-lg transition">
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {/* Expiry alert banner */}
      {stats.expiring > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-3.5 flex items-center gap-3">
          <span className="text-amber-400 text-lg">⚠️</span>
          <p className="text-sm text-amber-300">
            <span className="font-semibold">{stats.expiring} benefit{stats.expiring > 1 ? 's' : ''}</span> expiring within 30 days.
            Filter by <button onClick={() => setFilterStatus('expiring')} className="underline hover:text-amber-200">Expiring Soon</button> to review.
          </p>
        </div>
      )}
    </div>
  )
}
