'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { useEffect, useState, useCallback } from 'react'
import FileUpload from '@/components/ui/FileUpload'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { ExportButton } from '@/components/ui/ExportButton'

type Contract = {
  id: string; employeeId: string; type: string; status: string
  pdfUrl: string | null; signedPdfUrl: string | null
  sentAt: string | null; signedAt: string | null; tfnProvided: boolean
  superFund: string | null; bankBsb: string | null; bankAccount: string | null
  endDate: string | null; notes: string | null
  createdAt: string
  employeeFirstName: string | null; employeeLastName: string | null
  employeeEmail: string | null; employeeEntityName: string | null
}
type Stats = { total: number; draft: number; sent: number; signed: number }
type Employee = { id: string; firstName: string; lastName: string }

const CONTRACT_TYPES = [
  { value: 'employment',  label: 'Permanent Employment' },
  { value: 'casual',      label: '⏱ Casual Employment' },
  { value: 'contractor',  label: 'Independent Contractor' },
  { value: 'traineeship', label: 'Traineeship' },
  { value: 'volunteer',   label: 'Volunteer' },
]

const STATUS_STYLE: Record<string, string> = {
  draft:  'badge badge-gray',
  sent:   'badge badge-blue',
  signed: 'badge badge-green',
  void:   'badge badge-red',
}

const INPUT = 'input-premium'

function endDateColor(endDate: string | null): string {
  if (!endDate) return ''
  const end = new Date(endDate + 'T00:00:00')
  const now = new Date()
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'text-red-400'
  if (diffDays <= 30) return 'text-amber-400'
  return 'text-gray-400'
}

function endDateLabel(endDate: string | null): string {
  if (!endDate) return ''
  const end = new Date(endDate + 'T00:00:00')
  const now = new Date()
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const formatted = end.toLocaleDateString('en-AU')
  if (diffDays < 0) return `Expired ${formatted}`
  if (diffDays <= 30) return `Expires ${formatted}`
  return `Ends ${formatted}`
}

export default function ContractsPage() {
  const [contracts,    setContracts]    = useState<Contract[]>([])
  const [stats,        setStats]        = useState<Stats>({ total:0, draft:0, sent:0, signed:0 })
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [search,       setSearch]       = useState('')
  const [form, setForm] = useState({ employeeId:'', type:'employment', pdfUrl:'', superFund:'', tfnProvided: false })
  const [taxSuper, setTaxSuper] = useState<Record<string, { tfn: boolean; fund: string }>>({})

  // Edit modal state
  const [editContract, setEditContract] = useState<Contract | null>(null)
  const [editForm, setEditForm] = useState({
    type: 'employment', superFund: '', tfnProvided: false,
    bankBsb: '', bankAccount: '', endDate: '', notes: '', pdfUrl: '',
  })
  const [editSaving, setEditSaving] = useState(false)

  // Modals / toasts
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [toast,   setToast]   = useState<ToastState>(null)

  const load = useCallback(async (st = filterStatus) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (st) p.set('status', st)
    const res  = await fetchWithAuth(`/api/tenant/contracts?${p}`)
    const data = await res.json()
    setContracts(data.contracts ?? [])
    setStats(data.stats ?? { total:0, draft:0, sent:0, signed:0 })
    setLoading(false)
  }, [filterStatus])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/contracts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      setShowForm(false)
      setForm({ employeeId:'', type:'employment', pdfUrl:'', superFund:'', tfnProvided:false })
      setToast({ message: 'Contract created', type: 'success' })
      load()
    } catch {
      setToast({ message: 'Failed to create contract', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    await fetchWithAuth('/api/tenant/contracts', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, ...updates }),
    })
    load()
  }

  async function saveTaxSuper(id: string) {
    const f = taxSuper[id]
    if (!f) return
    await patch(id, { tfnProvided: f.tfn, superFund: f.fund })
    setToast({ message: 'Tax & super saved', type: 'success' })
  }

  function openEdit(c: Contract) {
    setEditContract(c)
    setEditForm({
      type:        c.type,
      superFund:   c.superFund   ?? '',
      tfnProvided: c.tfnProvided,
      bankBsb:     c.bankBsb     ?? '',
      bankAccount: c.bankAccount ?? '',
      endDate:     c.endDate     ?? '',
      notes:       c.notes       ?? '',
      pdfUrl:      c.pdfUrl      ?? '',
    })
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editContract) return
    setEditSaving(true)
    try {
      const res = await fetchWithAuth(`/api/tenant/contracts/${editContract.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error()
      setEditContract(null)
      setToast({ message: 'Contract updated', type: 'success' })
      load()
    } catch {
      setToast({ message: 'Failed to update contract', type: 'error' })
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteContract(id: string) {
    try {
      const res = await fetchWithAuth(`/api/tenant/contracts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setToast({ message: 'Contract deleted', type: 'success' })
      load()
    } catch {
      setToast({ message: 'Failed to delete contract', type: 'error' })
    }
  }

  function handleExport() {
    exportCsv({
      filename: 'contracts',
      columns: [
        { header: 'Employee',      key: 'employeeFirstName', format: (_, r) => `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim() },
        { header: 'Email',         key: 'employeeEmail',     format: v => v ?? '' },
        { header: 'Type',          key: 'type',              format: v => CONTRACT_TYPES.find(t => t.value === v)?.label ?? v },
        { header: 'Status',        key: 'status' },
        { header: 'End Date',      key: 'endDate',           format: v => fmtCsvDate(v) },
        { header: 'Sent At',       key: 'sentAt',            format: v => fmtCsvDate(v) },
        { header: 'Signed At',     key: 'signedAt',          format: v => fmtCsvDate(v) },
        { header: 'TFN Provided',  key: 'tfnProvided',       format: v => v ? 'Yes' : 'No' },
        { header: 'Super Fund',    key: 'superFund',         format: v => v ?? '' },
        { header: 'Created',       key: 'createdAt',         format: v => fmtCsvDate(v) },
      ],
      rows: filtered,
    })
  }

  // Client-side search filter
  const filtered = contracts.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = `${c.employeeFirstName ?? ''} ${c.employeeLastName ?? ''}`.toLowerCase()
    const typeLabel = (CONTRACT_TYPES.find(t => t.value === c.type)?.label ?? c.type).toLowerCase()
    return name.includes(q) || typeLabel.includes(q) || c.type.includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employment Contracts</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Create, send, and track employment contracts and onboarding documents</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={handleExport} disabled={filtered.length === 0} />
          <button onClick={() => setShowForm(v => !v)}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
            {showForm ? 'Cancel' : '+ New Contract'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total',  value: stats.total,  color: 'text-foreground' },
          { label: 'Draft',  value: stats.draft,  color: 'text-gray-400' },
          { label: 'Sent',   value: stats.sent,   color: 'text-blue-400' },
          { label: 'Signed', value: stats.signed, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={create} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#4ebac4]">Create New Contract</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
              <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Contract Type *</label>
              <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <FileUpload
                label="Contract Document (optional)"
                accept=".pdf,.doc,.docx"
                currentUrl={form.pdfUrl || null}
                onUpload={r => setForm(f => ({ ...f, pdfUrl: r.url }))}
              />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg">
            {saving ? 'Creating…' : 'Create Contract'}
          </button>
        </form>
      )}

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by name or contract type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-premium flex-1 min-w-48 focus:outline-none focus:border-[#0E3D52]"
        />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(e.target.value) }}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="signed">Signed</option>
          <option value="void">Void</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-premium">
          <EmptyState
            icon="📄"
            title="No contracts found"
            message={search ? 'Try adjusting your search.' : 'Create a contract to begin the employment documentation process.'}
            action={!search ? { label: '+ New Contract', onClick: () => setShowForm(true) } : undefined}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const isOpen = expanded === c.id
            const ts = taxSuper[c.id] ?? { tfn: c.tfnProvided, fund: c.superFund ?? '' }
            const endColor = endDateColor(c.endDate)
            const endLabel = endDateLabel(c.endDate)
            return (
              <div key={c.id} className={`card-premium overflow-hidden ${
                c.status === 'signed' ? 'border-green-900/50' : 'border-gray-800'
              }`}>
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(isOpen ? null : c.id)}>
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-foreground font-medium text-sm">{c.employeeFirstName} {c.employeeLastName}</span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                        {CONTRACT_TYPES.find(t => t.value === c.type)?.label ?? c.type}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[c.status] ?? 'badge badge-gray'}`}>
                        {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                      </span>
                      {c.endDate && (
                        <span className={`text-xs font-medium ${endColor}`}>{endLabel}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.employeeEmail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right cursor-pointer" onClick={() => setExpanded(isOpen ? null : c.id)}>
                      {c.signedAt && <p className="text-xs text-green-400">Signed {new Date(c.signedAt).toLocaleDateString('en-AU')}</p>}
                      {c.sentAt && !c.signedAt && <p className="text-xs text-blue-400">Sent {new Date(c.sentAt).toLocaleDateString('en-AU')}</p>}
                      {!c.sentAt && <p className="text-xs text-gray-600 dark:text-gray-400">{new Date(c.createdAt).toLocaleDateString('en-AU')}</p>}
                      <p className="text-xs text-gray-600 mt-0.5 dark:text-gray-400">{isOpen ? '▲' : '▼'}</p>
                    </div>
                    {/* Edit / Delete actions */}
                    <button
                      onClick={() => openEdit(c)}
                      title="Edit contract"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-[#1A6080] dark:text-[#4ebac4] hover:bg-gray-800 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 7.125L18 5.625" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setConfirm({
                        message: `Delete the contract for ${c.employeeFirstName} ${c.employeeLastName}? This cannot be undone.`,
                        confirmLabel: 'Delete',
                        danger: true,
                        onConfirm: () => deleteContract(c.id),
                      })}
                      title="Delete contract"
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-gray-800 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 space-y-4">
                    {/* Status actions */}
                    {c.status !== 'signed' && c.status !== 'void' && (
                      <div className="flex gap-2 flex-wrap">
                        {c.status === 'draft' && (
                          <button onClick={() => patch(c.id, { status: 'sent' })}
                            className="text-xs bg-blue-900/40 border border-blue-800 text-blue-300 hover:bg-blue-900/60 px-3 py-1.5 rounded-lg transition">
                            Mark as Sent
                          </button>
                        )}
                        {c.status === 'sent' && (
                          <button onClick={() => patch(c.id, { status: 'signed' })}
                            className="text-xs bg-green-900/40 border border-green-800 text-green-300 hover:bg-green-900/60 px-3 py-1.5 rounded-lg transition">
                            Mark as Signed
                          </button>
                        )}
                        <button onClick={() => patch(c.id, { status: 'void' })}
                          className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-red-700 hover:text-red-400 px-3 py-1.5 rounded-lg transition">
                          Void
                        </button>
                      </div>
                    )}

                    {/* Document upload / link */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">Contract Document</p>
                      <FileUpload
                        accept=".pdf,.doc,.docx"
                        currentUrl={c.pdfUrl}
                        currentName={c.pdfUrl ? 'Contract document' : null}
                        onUpload={r => patch(c.id, { pdfUrl: r.url })}
                      />
                    </div>

                    {/* Signed PDF upload */}
                    {(c.status === 'signed' || c.signedPdfUrl) && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">Signed Copy</p>
                        <FileUpload
                          accept=".pdf"
                          currentUrl={c.signedPdfUrl}
                          currentName={c.signedPdfUrl ? 'Signed contract' : null}
                          onUpload={r => patch(c.id, { signedPdfUrl: r.url })}
                        />
                      </div>
                    )}

                    {/* Tax & super */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 dark:text-gray-400">Tax & Superannuation</p>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox"
                            checked={ts.tfn}
                            onChange={e => setTaxSuper(prev => ({ ...prev, [c.id]: { ...ts, tfn: e.target.checked } }))}
                            className="accent-green-500 w-4 h-4" />
                          <span className="text-sm text-gray-600 dark:text-gray-300">TFN Provided</span>
                        </label>
                        <div>
                          <input value={ts.fund}
                            onChange={e => setTaxSuper(prev => ({ ...prev, [c.id]: { ...ts, fund: e.target.value } }))}
                            placeholder="Super fund name" className={INPUT} />
                        </div>
                      </div>
                      <button onClick={() => saveTaxSuper(c.id)}
                        className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#0E3D52] px-3 py-1.5 rounded-lg transition">
                        Save Tax & Super
                      </button>
                    </div>

                    {/* Notes (read-only preview) */}
                    {c.notes && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 dark:text-gray-400">Notes</p>
                        <p className="text-sm text-gray-400 whitespace-pre-wrap">{c.notes}</p>
                      </div>
                    )}

                    {/* Signed info */}
                    {c.status === 'signed' && (
                      <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/50 rounded-lg p-3 flex items-center gap-3">
                        <span className="text-xl">✅</span>
                        <div>
                          <p className="text-sm font-semibold text-green-300">Contract Executed</p>
                          {c.signedAt && <p className="text-xs text-gray-600 dark:text-gray-400">Signed {new Date(c.signedAt).toLocaleDateString('en-AU')}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      {editContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card-premium w-full max-w-lg shadow-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Edit Contract — {editContract.employeeFirstName} {editContract.employeeLastName}
              </h3>
              <button onClick={() => setEditContract(null)} className="text-gray-500 hover:text-gray-300 text-lg">✕</button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Contract Type</label>
                  <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                    {CONTRACT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">End Date</label>
                  <input type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Super Fund</label>
                  <input value={editForm.superFund} onChange={e => setEditForm(f => ({ ...f, superFund: e.target.value }))} placeholder="Super fund name" className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Bank BSB</label>
                  <input value={editForm.bankBsb} onChange={e => setEditForm(f => ({ ...f, bankBsb: e.target.value }))} placeholder="000-000" className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Bank Account</label>
                  <input value={editForm.bankAccount} onChange={e => setEditForm(f => ({ ...f, bankAccount: e.target.value }))} placeholder="Account number" className={INPUT} />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editForm.tfnProvided} onChange={e => setEditForm(f => ({ ...f, tfnProvided: e.target.checked }))} className="accent-green-500 w-4 h-4" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">TFN Provided</span>
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    placeholder="Internal notes about this contract…"
                    className={`${INPUT} resize-none`}
                  />
                </div>
                <div className="col-span-2">
                  <FileUpload
                    label="Contract Document"
                    accept=".pdf,.doc,.docx"
                    currentUrl={editForm.pdfUrl || null}
                    onUpload={r => setEditForm(f => ({ ...f, pdfUrl: r.url }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setEditContract(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving}
                  className="px-4 py-2 text-sm rounded-lg bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white transition">
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
