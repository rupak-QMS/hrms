'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import EmptyState from '@/components/ui/EmptyState'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv } from '@/lib/exportCsv'

type Recognition = {
  id: string
  recipientId: string
  nominatedBy: string | null
  type: string
  reason: string | null
  period: string | null
  isPublic: boolean
  createdAt: string
  recipientFirstName: string | null
  recipientLastName: string | null
}

type Employee = { id: string; firstName: string; lastName: string }

const REC_TYPES = [
  { value: 'employee_of_quarter', label: 'Employee of the Quarter', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'peer',                label: 'Peer Recognition',         color: 'bg-[#E0EEF4]0/20 text-[#4ebac4] border-[#0E3D52]/30' },
  { value: 'safety_champion',     label: 'Safety Champion',          color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'above_beyond',        label: 'Above & Beyond',           color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'ndis_excellence',     label: 'NDIS Excellence',          color: 'bg-[#f0f7fb]0/20 text-[#1A6080] dark:text-[#4ebac4] border-[#0E3D52]/30' },
  { value: 'innovation',          label: 'Innovation',               color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
]

const TYPE_MAP = Object.fromEntries(REC_TYPES.map(t => [t.value, t]))
const INPUT = 'input-premium w-full'

const EMPTY_FORM = { recipientId: '', nominatedBy: '', type: 'peer', reason: '', period: '', isPublic: true }

function avatarInitials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?'
}

function avatarColor(name: string) {
  const colors = [
    'bg-[#1A6080] text-[#9ccfda]',
    'bg-[#1A6080] text-[#7dcfd7]',
    'bg-green-700 text-green-200',
    'bg-orange-700 text-orange-200',
    'bg-pink-700 text-pink-200',
    'bg-cyan-700 text-cyan-200',
  ]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return colors[hash % colors.length]
}

export default function RecognitionPage() {
  const [recs, setRecs]           = useState<Recognition[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [toast, setToast]         = useState<ToastState>(null)

  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [editRec, setEditRec]       = useState<Recognition | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Recognition | null>(null)

  // Filters
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterEmp, setFilterEmp]   = useState('')

  // Forms
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchWithAuth('/api/tenant/recognition').then(r => r.json())
      setRecs(data.recognitions ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500')
      .then(r => r.json())
      .then(d => setEmployees(d.employees ?? []))
  }, [load])

  // Stats
  const now = new Date()
  const thisMonthRecs = useMemo(() =>
    recs.filter(r => {
      const d = new Date(r.createdAt)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }), [recs])

  const topEmployee = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {}
    for (const r of recs) {
      const key = r.recipientId
      const name = `${r.recipientFirstName ?? ''} ${r.recipientLastName ?? ''}`.trim()
      if (!counts[key]) counts[key] = { name, count: 0 }
      counts[key].count++
    }
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count)
    return sorted[0] ?? null
  }, [recs])

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return recs.filter(r => {
      const name = `${r.recipientFirstName ?? ''} ${r.recipientLastName ?? ''}`.toLowerCase()
      const msg  = (r.reason ?? '').toLowerCase()
      if (q && !name.includes(q) && !msg.includes(q)) return false
      if (filterType && r.type !== filterType) return false
      if (filterEmp && r.recipientId !== filterEmp) return false
      return true
    })
  }, [recs, search, filterType, filterEmp])

  // Handlers
  function openCreate() { setForm(EMPTY_FORM); setShowCreate(true) }
  function openEdit(r: Recognition) {
    setForm({ recipientId: r.recipientId, nominatedBy: r.nominatedBy ?? '', type: r.type, reason: r.reason ?? '', period: r.period ?? '', isPublic: r.isPublic })
    setEditRec(r)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/tenant/recognition', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setShowCreate(false)
      setToast({ message: 'Recognition created!', type: 'success' })
      load()
    } catch {
      setToast({ message: 'Failed to create recognition', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editRec) return
    setSaving(true)
    try {
      const res = await fetchWithAuth(`/api/tenant/recognition/${editRec.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setEditRec(null)
      setToast({ message: 'Recognition updated!', type: 'success' })
      load()
    } catch {
      setToast({ message: 'Failed to update recognition', type: 'error' })
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(confirmDelete.id)
    try {
      const res = await fetchWithAuth(`/api/tenant/recognition/${confirmDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setConfirmDelete(null)
      setToast({ message: 'Recognition deleted', type: 'info' })
      load()
    } catch {
      setToast({ message: 'Failed to delete', type: 'error' })
    } finally { setDeleting(null) }
  }

  function handleExport() {
    exportCsv({
      filename: `recognitions-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { header: 'Recipient', key: 'recipientFirstName', format: (_, r: Recognition) => `${r.recipientFirstName ?? ''} ${r.recipientLastName ?? ''}`.trim() },
        { header: 'Type',     key: 'type', format: (v: string) => TYPE_MAP[v]?.label ?? v },
        { header: 'Reason',   key: 'reason', format: (v: string | null) => v ?? '' },
        { header: 'Period',   key: 'period', format: (v: string | null) => v ?? '' },
        { header: 'Date',     key: 'createdAt', format: (v: string) => new Date(v).toLocaleDateString('en-AU') },
      ],
      rows: filtered,
    })
  }

  const empName = (id: string) => {
    const e = employees.find(e => e.id === id)
    return e ? `${e.firstName} ${e.lastName}` : ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recognition & Rewards</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Celebrate employee achievements and peer nominations</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExport} disabled={filtered.length === 0} />
          <button
            onClick={openCreate}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition flex items-center gap-1.5"
          >
            <span className="text-lg leading-none">＋</span> Give Recognition
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-premium p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium ">This Month</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{thisMonthRecs.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">recognitions</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium ">Top Recognized</p>
          {topEmployee ? (
            <>
              <p className="text-base font-bold text-gray-900 dark:text-white mt-1 truncate">{topEmployee.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{topEmployee.count} recognition{topEmployee.count !== 1 ? 's' : ''}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">—</p>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or message…"
            className="input-premium pl-9 w-full"
          />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-premium sm:w-52">
          <option value="">All categories</option>
          {REC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} className="input-premium sm:w-52">
          <option value="">All employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card-premium p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-[#0E3D52]/60" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 bg-gray-200 dark:bg-[#0E3D52]/60 rounded w-32" />
                  <div className="h-2.5 bg-gray-200 dark:bg-[#0E3D52]/60 rounded w-20" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-2.5 bg-gray-200 dark:bg-[#0E3D52]/60 rounded w-full" />
                <div className="h-2.5 bg-gray-200 dark:bg-[#0E3D52]/60 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-premium">
          <EmptyState
            icon="🏆"
            title={search || filterType || filterEmp ? 'No recognitions match your filters' : 'No recognitions yet'}
            message={search || filterType || filterEmp ? 'Try adjusting your search or filters.' : 'Start celebrating your team\'s achievements.'}
            action={!search && !filterType && !filterEmp ? { label: 'Give Recognition', onClick: openCreate } : undefined}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(r => {
            const fullName = `${r.recipientFirstName ?? ''} ${r.recipientLastName ?? ''}`.trim()
            const typeInfo = TYPE_MAP[r.type]
            return (
              <div
                key={r.id}
                className="card-premium p-5 cursor-pointer hover:ring-1 hover:ring-[#0E3D52]/40 transition group"
                onClick={() => openEdit(r)}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor(fullName)}`}>
                    {avatarInitials(r.recipientFirstName, r.recipientLastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{fullName}</p>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${typeInfo?.color ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {typeInfo?.label ?? r.type}
                      </span>
                    </div>
                    {r.reason && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed line-clamp-3">"{r.reason}"</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{new Date(r.createdAt).toLocaleDateString('en-AU')}</span>
                        {r.period && (
                          <>
                            <span>·</span>
                            <span className="text-[#1A6080] dark:text-[#4ebac4]">{r.period}</span>
                          </>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(r) }}
                        className="opacity-0 group-hover:opacity-100 transition text-xs text-red-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <RecognitionModal
          title="Give Recognition"
          form={form} setForm={setForm}
          employees={employees}
          saving={saving}
          onSubmit={handleCreate}
          onClose={() => setShowCreate(false)}
          submitLabel="Submit Recognition"
        />
      )}

      {/* Edit Modal */}
      {editRec && (
        <RecognitionModal
          title="Edit Recognition"
          form={form} setForm={setForm}
          employees={employees}
          saving={saving}
          onSubmit={handleEdit}
          onClose={() => setEditRec(null)}
          submitLabel="Save Changes"
        />
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="modal-overlay backdrop-blur-sm p-4">
          <div className="card-premium p-6 max-w-sm w-full space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Delete Recognition</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Delete recognition for <strong>{confirmDelete.recipientFirstName} {confirmDelete.recipientLastName}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30 transition">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting === confirmDelete.id}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium transition"
              >
                {deleting === confirmDelete.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}

type ModalForm = {
  recipientId: string
  nominatedBy: string
  type: string
  reason: string
  period: string
  isPublic: boolean
}

function RecognitionModal({
  title, form, setForm, employees, saving, onSubmit, onClose, submitLabel,
}: {
  title: string
  form: ModalForm
  setForm: React.Dispatch<React.SetStateAction<ModalForm>>
  employees: Employee[]
  saving: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  submitLabel: string
}) {
  const set = (k: keyof ModalForm) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="modal-overlay backdrop-blur-sm p-4">
      <div className="card-premium p-6 max-w-lg w-full">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition text-xl leading-none">✕</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block font-medium">Recipient *</label>
              <select required value={form.recipientId} onChange={set('recipientId')} className={INPUT}>
                <option value="">— Select employee —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block font-medium">Nominated By</label>
              <select value={form.nominatedBy} onChange={set('nominatedBy')} className={INPUT}>
                <option value="">— Management —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block font-medium">Category *</label>
              <select required value={form.type} onChange={set('type')} className={INPUT}>
                {REC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block font-medium">Period</label>
              <input value={form.period} onChange={set('period')} placeholder="e.g. Q2-2026" className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block font-medium">Message / Reason</label>
            <textarea
              value={form.reason} onChange={set('reason')}
              rows={3} placeholder="Why are you recognising this person?"
              className={INPUT}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox" id="isPublic" checked={form.isPublic}
              onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))}
              className="rounded border-gray-300 dark:border-[#1A6080]/40 text-[#0E3D52]"
            />
            <label htmlFor="isPublic" className="text-sm text-gray-700 dark:text-gray-300">Make public (visible to all staff)</label>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="text-sm px-5 py-2 rounded-lg bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white font-medium transition">
              {saving ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
