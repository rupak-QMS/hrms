'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate, fmtCsvCurrency } from '@/lib/exportCsv'

type Promotion = {
  id: string; employeeId: string
  raisedById: string | null; raisedByName: string | null; currentTitle: string | null; currentSalary: number | null
  proposedTitle: string; proposedSalary: number | null; effectiveDate: string | null
  justification: string; status: string
  reviewedBy: string | null; reviewedAt: string | null; reviewNotes: string | null
  implementedAt: string | null; createdAt: string; updatedAt: string
  employeeFirstName: string | null; employeeLastName: string | null
  employeeEmail: string | null; employeeEntityName: string | null
}
type PromotionEvent = { id: string; event: string; note: string | null; performedBy: string | null; createdAt: string }
type Stats = { total: number; pending: number; under_review: number; approved: number; rejected: number; implemented: number }
type Employee = { id: string; firstName: string; lastName: string; role?: string }

const STATUS_STYLE: Record<string, string> = {
  pending:      'bg-gray-800 text-gray-300 border-gray-600',
  under_review: 'badge badge-blue',
  approved:     'badge badge-green',
  rejected:     'badge badge-red',
  implemented:  'badge badge-purple',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', under_review: 'Under Review',
  approved: 'Approved', rejected: 'Rejected', implemented: 'Implemented',
}

const EVENT_ICON: Record<string, string> = {
  raised:'', submitted_for_review:'', approved:'', rejected:'',
  implemented:'', note_added:'', updated:'️', salary_updated:'',
}

const INPUT = 'input-premium'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'
const TEXTAREA = INPUT + ' min-h-[80px] resize-y'

export default function PromotionsPage() {
  const [promotions,    setPromotions]    = useState<Promotion[]>([])
  const [stats,         setStats]         = useState<Stats>({ total:0,pending:0,under_review:0,approved:0,rejected:0,implemented:0 })
  const [employees,     setEmployees]     = useState<Employee[]>([])
  const [loading,       setLoading]       = useState(true)
  const [statusFilter,  setStatusFilter]  = useState('')
  const [selected,      setSelected]      = useState<Promotion | null>(null)
  const [events,        setEvents]        = useState<PromotionEvent[]>([])
  const [showForm,      setShowForm]      = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [reviewNote,    setReviewNote]    = useState('')
  const [addingNote,    setAddingNote]    = useState(false)
  const [inlineNote,    setInlineNote]    = useState('')
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [toast,   setToast]   = useState<ToastState>(null)

  const [form, setForm] = useState({
    employeeId: '', proposedTitle: '', proposedSalary: '',
    effectiveDate: '', justification: '',
    currentTitle: '', currentSalary: '', raisedByName: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const res  = await fetchWithAuth(`/api/tenant/promotions?${params}`)
    const data = await res.json()
    setPromotions(data.promotions ?? [])
    setStats(data.stats ?? { total:0,pending:0,under_review:0,approved:0,rejected:0,implemented:0 })
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetchWithAuth('/api/tenant/employees').then(r=>r.json()).then(d=>setEmployees(d.employees ?? []))
  }, [])

  async function selectPromotion(p: Promotion) {
    setSelected(p); setReviewNote('')
    const res  = await fetchWithAuth(`/api/tenant/promotions/${p.id}`)
    const data = await res.json()
    setSelected(data.promotion)
    setEvents(data.events ?? [])
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetchWithAuth('/api/tenant/promotions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        proposedSalary: Number(form.proposedSalary)||null,
        currentSalary:  Number(form.currentSalary)||null,
      }),
    })
    setSaving(false)
    if (res.ok) { setShowForm(false); load() }
  }

  async function action(status: string, notes?: string) {
    if (!selected) return
    const res = await fetchWithAuth(`/api/tenant/promotions/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewNotes: notes }),
    })
    if (res.ok) { selectPromotion(selected); load(); setReviewNote('') }
  }

  async function addNote() {
    if (!selected || !inlineNote.trim()) return
    setAddingNote(true)
    await fetchWithAuth(`/api/tenant/promotions/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNotes: inlineNote.trim() }),
    })
    setInlineNote(''); setAddingNote(false)
    selectPromotion(selected)
  }

  async function deletePromotion(id: string) {
    try {
      const r = await fetchWithAuth(`/api/tenant/promotions/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setPromotions(prev => prev.filter(p => p.id !== id))
      if (selected?.id === id) setSelected(null)
      setToast({ message: 'Promotion case deleted', type: 'success' })
      load()
    } catch {
      setToast({ message: 'Failed to delete promotion', type: 'error' })
    }
  }

  function fmt(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})
  }

  function salaryDiff(curr: number | null, prop: number | null) {
    if (!curr || !prop) return null
    const diff = prop - curr
    const pct  = ((diff / curr) * 100).toFixed(1)
    return `${diff > 0 ? '+' : ''}$${diff.toLocaleString()} (${pct}%)`
  }

  function exportPromotions() {
    exportCsv({
      filename: 'promotions',
      columns: [
        { header: 'Employee Name', key: 'employeeFirstName', format: (_, r) => `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim() },
        { header: 'From Title', key: 'currentTitle', format: v => v ?? '' },
        { header: 'To Title', key: 'proposedTitle' },
        { header: 'Effective Date', key: 'effectiveDate', format: v => fmtCsvDate(v) },
        { header: 'Status', key: 'status', format: v => STATUS_LABEL[v] ?? v },
        { header: 'Salary Before', key: 'currentSalary', format: v => fmtCsvCurrency(v) },
        { header: 'Salary After', key: 'proposedSalary', format: v => fmtCsvCurrency(v) },
        { header: 'Notes', key: 'justification' },
      ],
      rows: promotions,
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Promotions</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">Raise, review and track promotion cases</p>
        </div>
        <div className="flex items-center gap-2">
        <ExportButton onClick={exportPromotions} disabled={promotions.length === 0} />
        <button onClick={()=>{
          setForm({employeeId:'',proposedTitle:'',proposedSalary:'',effectiveDate:'',
            justification:'',currentTitle:'',currentSalary:'',raisedByName:''})
          setShowForm(true)
        }} className="px-4 py-2 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium rounded-lg transition">
          + Raise Promotion
        </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {[
          ['Total',       stats.total,        'border-gray-700'],
          ['Pending',     stats.pending,       'border-gray-600'],
          ['In Review',   stats.under_review,  'border-blue-800'],
          ['Approved',    stats.approved,      'border-green-800'],
          ['Rejected',    stats.rejected,      'border-red-800'],
          ['Implemented', stats.implemented,   'border-[#1A6080]'],
        ].map(([label, value, border]) => (
          <div key={label as string} className={`card-premium p-3 text-center ${border}`}>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'under_review', 'approved', 'rejected', 'implemented'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${statusFilter === s ? 'border-[#0E3D52] bg-[#0E3D52]/30 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
            {s === '' ? 'All' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {loading ? <p className="text-gray-500 text-sm text-center py-8 dark:text-gray-400">Loading…</p>
          : promotions.length === 0 ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
              <p className="text-sm">No promotion cases yet.</p>
            </div>
          ) : promotions.map(p => (
            <div key={p.id} onClick={() => selectPromotion(p)}
              className={`group p-4 rounded-xl border cursor-pointer transition ${selected?.id === p.id ? 'border-[#0E3D52] bg-[#0E3D52]/20' : 'border-gray-800 bg-gray-900 hover:border-gray-600'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-white truncate">
                  {p.employeeFirstName} {p.employeeLastName}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[p.status] ?? ''}`}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setConfirm({ message: 'Delete this promotion case?', confirmLabel: 'Delete', onConfirm: () => deletePromotion(p.id) }) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 p-0.5"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{p.currentTitle || '—'} → <span className="text-[#4ebac4]">{p.proposedTitle}</span></p>
              {salaryDiff(p.currentSalary, p.proposedSalary) && (
                <p className="text-xs text-green-400 mt-0.5">{salaryDiff(p.currentSalary, p.proposedSalary)}</p>
              )}
              <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">Raised by {p.raisedByName ?? '—'} · {fmt(p.createdAt)}</p>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="card-premium p-10 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm dark:text-gray-400">Select a case to view details, approve, or reject</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Case header */}
              <div className="card-premium p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {selected.employeeFirstName} {selected.employeeLastName}
                    </h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{selected.employeeEmail}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_STYLE[selected.status] ?? ''}`}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                </div>

                {/* Promotion comparison */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-100 dark:bg-gray-800/60 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1 dark:text-gray-400">Current</p>
                    <p className="text-sm font-semibold text-foreground">{selected.currentTitle || '—'}</p>
                    {selected.currentSalary && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">${selected.currentSalary.toLocaleString()} / yr</p>}
                  </div>
                  <div className="bg-[#f0f7fb] dark:bg-[#0E3D52]/30 border border-[#b8d4e0] dark:border-[#1A6080]/50 rounded-xl p-3">
                    <p className="text-xs text-[#1A6080] dark:text-[#4ebac4] mb-1">Proposed →</p>
                    <p className="text-sm font-semibold text-foreground">{selected.proposedTitle}</p>
                    {selected.proposedSalary && <p className="text-xs text-green-400 mt-0.5">${selected.proposedSalary.toLocaleString()} / yr</p>}
                  </div>
                </div>

                {salaryDiff(selected.currentSalary, selected.proposedSalary) && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg px-3 py-2 mb-4">
                    <p className="text-xs text-green-300">Salary increase: {salaryDiff(selected.currentSalary, selected.proposedSalary)}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div><p className="text-gray-500 dark:text-gray-400">Effective Date</p><p className="text-white mt-0.5">{fmt(selected.effectiveDate)}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Raised By</p><p className="text-white mt-0.5">{selected.raisedByName ?? '—'}</p></div>
                  <div><p className="text-gray-500 dark:text-gray-400">Raised On</p><p className="text-white mt-0.5">{fmt(selected.createdAt)}</p></div>
                  {selected.reviewedBy && <div><p className="text-gray-500 dark:text-gray-400">Reviewed By</p><p className="text-white mt-0.5">{selected.reviewedBy}</p></div>}
                </div>

                <div className="bg-gray-100 dark:bg-gray-800/60 rounded-xl p-3 mb-4">
                  <p className="text-xs text-gray-500 mb-1 dark:text-gray-400">Justification</p>
                  <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{selected.justification}</p>
                </div>

                {selected.reviewNotes && (
                  <div className="bg-gray-100 dark:bg-gray-800/60 rounded-xl p-3 mb-4">
                    <p className="text-xs text-gray-500 mb-1 dark:text-gray-400">Review Notes</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200">{selected.reviewNotes}</p>
                  </div>
                )}

                {/* Action buttons by status */}
                {selected.status === 'pending' && (
                  <button onClick={() => action('under_review')}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition">
                    Submit for Review
                  </button>
                )}
                {selected.status === 'under_review' && (
                  <div className="space-y-3">
                    <textarea value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
                      className={TEXTAREA} placeholder="Review notes (optional but recommended)…" />
                    <div className="flex gap-2">
                      <button onClick={() => action('approved', reviewNote)}
                        className="flex-1 py-2.5 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition">
                        Approve
                      </button>
                      <button onClick={() => action('rejected', reviewNote)}
                        className="flex-1 py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition">
                        Reject
                      </button>
                    </div>
                  </div>
                )}
                {selected.status === 'approved' && (
                  <button onClick={() => action('implemented')}
                    className="w-full py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium rounded-lg transition">
                    Mark as Implemented
                  </button>
                )}
              </div>

              {/* Add note */}
              <div className="card-premium p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Add Note</p>
                <div className="flex gap-2">
                  <input value={inlineNote} onChange={e=>setInlineNote(e.target.value)}
                    placeholder="Add a note to this case…"
                    className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]" />
                  <button onClick={addNote} disabled={addingNote || !inlineNote.trim()}
                    className="px-3 py-2 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition">
                    Add
                  </button>
                </div>
              </div>

              {/* History timeline */}
              <div className="card-premium p-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">Timeline</p>
                {events.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-4 dark:text-gray-400">No events yet</p>
                ) : (
                  <div className="space-y-3">
                    {events.map((ev, i) => (
                      <div key={ev.id} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center text-sm">
                            {EVENT_ICON[ev.event] ?? ''}
                          </div>
                          {i < events.length-1 && <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mt-1" />}
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-white capitalize">{ev.event.replace(/_/g,' ')}</p>
                            <p className="text-xs text-gray-600 shrink-0 dark:text-gray-400">{fmt(ev.createdAt)}</p>
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
      </div>

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {/* New Promotion Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card-premium rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-foreground">Raise Promotion Case</h2>
              <button onClick={()=>setShowForm(false)} className="text-gray-600 dark:text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={submitForm} className="p-6 space-y-4">
              <div>
                <label className={LABEL}>Employee *</label>
                <select required value={form.employeeId} onChange={e=>setForm(f=>({...f,employeeId:e.target.value}))} className={INPUT}>
                  <option value="">Select employee…</option>
                  {employees.map(e=>(
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Current Title</label>
                  <input value={form.currentTitle} onChange={e=>setForm(f=>({...f,currentTitle:e.target.value}))} className={INPUT} placeholder="Support Worker" />
                </div>
                <div>
                  <label className={LABEL}>Current Salary ($)</label>
                  <input type="number" value={form.currentSalary} onChange={e=>setForm(f=>({...f,currentSalary:e.target.value}))} className={INPUT} placeholder="60000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Proposed Title *</label>
                  <input required value={form.proposedTitle} onChange={e=>setForm(f=>({...f,proposedTitle:e.target.value}))} className={INPUT} placeholder="Senior Support Worker" />
                </div>
                <div>
                  <label className={LABEL}>Proposed Salary ($)</label>
                  <input type="number" value={form.proposedSalary} onChange={e=>setForm(f=>({...f,proposedSalary:e.target.value}))} className={INPUT} placeholder="70000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Effective Date</label>
                  <input type="date" value={form.effectiveDate} onChange={e=>setForm(f=>({...f,effectiveDate:e.target.value}))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Your Name / Role</label>
                  <input value={form.raisedByName} onChange={e=>setForm(f=>({...f,raisedByName:e.target.value}))} className={INPUT} placeholder="Manager name" />
                </div>
              </div>
              <div>
                <label className={LABEL}>Justification *</label>
                <textarea required value={form.justification} onChange={e=>setForm(f=>({...f,justification:e.target.value}))}
                  className={TEXTAREA} placeholder="Describe the reasons for this promotion — performance, tenure, expanded responsibilities…" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                  {saving ? 'Submitting…' : 'Raise Promotion Case'}
                </button>
                <button type="button" onClick={()=>setShowForm(false)}
                  className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
