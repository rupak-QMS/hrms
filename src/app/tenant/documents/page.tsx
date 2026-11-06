'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import FileUpload, { type UploadResult } from '@/components/ui/FileUpload'
import EmptyState from '@/components/ui/EmptyState'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'

// ── Types ─────────────────────────────────────────────────────────────────────
type Doc = {
  id: string; employeeId: string | null; category: string; title: string
  blobUrl: string; fileName: string | null; fileSizeBytes: number | null
  mimeType: string | null; status: string; expiryDate: string | null
  notes: string | null; version: number; createdAt: string; updatedAt: string
  employeeFirstName: string | null; employeeLastName: string | null
}
type Stats = { total: number; active: number; expired: number; expiringSoon: number; pendingReview: number }
type Employee = { id: string; firstName: string; lastName: string }

// Returns false if the URL is a placeholder/demo URL that won't resolve
function isRealUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.hostname !== 'placeholder.blob' && u.hostname !== 'example.com' && u.hostname !== 'localhost'
  } catch { return false }
}

// ── Constants ─────────────────────────────────────────────────────────────────
// Care & property industry document categories
const DOC_CATEGORIES = [
  // Compliance / screening (most important for care workers)
  'Police Check',
  'Working With Children Check',
  'NDIS Worker Screening',
  'NDIS Module Completion',
  // Certifications / licences
  'First Aid Certificate',
  'CPR Certificate',
  'Manual Handling Certificate',
  "Driver's Licence",
  'Vehicle Registration',
  // Work eligibility
  'Visa / Work Rights',
  'COVID Vaccination Record',
  // HR & employment
  'Employment Contract',
  'Tax File Number Declaration',
  'Superannuation Form',
  'Bank Details Form',
  'Policy Acknowledgement',
  // Training & development
  'Training Certificate',
  'Induction Record',
  'Performance Review',
  // Property-specific
  'Public Liability Certificate',
  'Professional Indemnity',
  'Trade Licence / Certification',
  // General
  'ID Document',
  'HR Form',
  'Other',
]

const STATUS_STYLE: Record<string, string> = {
  active:         'badge badge-green',
  expired:        'badge badge-red',
  archived:       'badge badge-gray',
  pending_review: 'badge badge-amber',
}

// Categories that require expiry tracking
const EXPIRY_REQUIRED_CATS = new Set([
  'Police Check', 'Working With Children Check', 'NDIS Worker Screening',
  'First Aid Certificate', 'CPR Certificate', 'Manual Handling Certificate',
  "Driver's Licence", 'Vehicle Registration', 'Visa / Work Rights',
  'COVID Vaccination Record', 'Professional Indemnity', 'Trade Licence / Certification',
])

const MIME_ICON: Record<string, string> = {
  'application/pdf':  '',
  'image/png':        '',
  'image/jpeg':       '',
  'application/msword': '',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '',
  'application/vnd.ms-excel': '',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '',
}
const mimeIcon = (m: string | null) => m ? (MIME_ICON[m] ?? '') : ''

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntilExpiry(d: string): number {
  return Math.round((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000)
}

const today = new Date().toISOString().split('T')[0]
const in30  = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0]

const expColor = (exp: string | null) => {
  if (!exp) return 'text-gray-600'
  if (exp < today) return 'text-red-400'
  if (exp <= in30) return 'text-amber-400'
  return 'text-gray-400'
}

const INPUT = 'input-premium'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

// ── DocPreviewModal ───────────────────────────────────────────────────────────
function DocPreviewModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const isImage = doc.mimeType?.startsWith('image/')
  const isPdf   = doc.mimeType === 'application/pdf'

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">{mimeIcon(doc.mimeType)}</span>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{doc.title}</h2>
            {doc.fileName && (
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:block">— {doc.fileName}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 shrink-0 p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-white transition-colors"
            aria-label="Close preview"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 dark:bg-gray-950 min-h-0 p-4">
          {isImage ? (
            <img
              src={doc.blobUrl}
              alt={doc.title}
              className="max-h-[80vh] max-w-full object-contain rounded"
            />
          ) : isPdf ? (
            <iframe
              src={doc.blobUrl}
              className="w-full h-[80vh] rounded border-0"
              title={doc.title}
            />
          ) : (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Preview not available</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {doc.mimeType ? `File type: ${doc.mimeType}` : 'Unknown file type'}
              </p>
              <a
                href={doc.blobUrl}
                download
                className="inline-flex items-center gap-1.5 text-xs text-[#0E3D52] dark:text-[#4ebac4] hover:underline"
              >
                Download file
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 bg-white dark:bg-gray-900">
          <a
            href={doc.blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0E3D52] dark:text-[#4ebac4] hover:text-[#0E3D52] dark:hover:text-[#4ebac4] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6m0 0v6m0-6L10 14" />
            </svg>
            Open in new tab
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DocumentsPage() {
  const [docs,       setDocs]       = useState<Doc[]>([])
  const [stats,      setStats]      = useState<Stats>({ total:0, active:0, expired:0, expiringSoon:0, pendingReview:0 })
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [filterCat,    setFilterCat]    = useState('')
  const [filterStat,   setFilterStat]   = useState('')
  const [expiryFilter, setExpiryFilter] = useState(false)
  const [search,     setSearch]     = useState('')
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [editing,    setEditing]    = useState<string | null>(null)
  const [editForm,   setEditForm]   = useState({ title: '', expiryDate: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [selectedDocs,   setSelectedDocs]   = useState<Set<string>>(new Set())
  const [bulkDocLoading, setBulkDocLoading] = useState(false)
  const [preview, setPreview] = useState<Doc | null>(null)
  const [form, setForm] = useState({
    title: '', category: 'Police Check', blobUrl: '', employeeId: '',
    fileName: '', fileSizeBytes: 0, mimeType: '', expiryDate: '', notes: '',
  })

  const load = useCallback(async (cat = filterCat, st = filterStat, expiring = expiryFilter) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (cat)     p.set('category', cat)
    if (st)      p.set('status', st)
    if (expiring) p.set('expiring', '1')
    const data = await fetchWithAuth(`/api/tenant/documents?${p}`).then(r => r.json())
    setDocs(data.documents ?? [])
    setStats(data.stats ?? { total:0, active:0, expired:0, expiringSoon:0, pendingReview:0 })
    setSelectedDocs(new Set())
    setLoading(false)
  }, [filterCat, filterStat, expiryFilter])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.blobUrl) return
    setSaving(true)
    await fetchWithAuth('/api/tenant/documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:         form.title,
        category:      form.category,
        blobUrl:       form.blobUrl,
        employeeId:    form.employeeId || null,
        fileName:      form.fileName,
        fileSizeBytes: form.fileSizeBytes,
        mimeType:      form.mimeType,
        expiryDate:    form.expiryDate || null,
        notes:         form.notes,
      }),
    })
    setShowForm(false)
    setForm({ title:'', category:'Police Check', blobUrl:'', employeeId:'', fileName:'', fileSizeBytes:0, mimeType:'', expiryDate:'', notes:'' })
    setSaving(false)
    load()
  }

  async function bulkUpdateStatus(status: string) {
    setBulkDocLoading(true)
    try {
      await Promise.all([...selectedDocs].map(id =>
        fetchWithAuth('/api/tenant/documents', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status }),
        })
      ))
      setSelectedDocs(new Set())
      load()
    } finally { setBulkDocLoading(false) }
  }

  async function updateStatus(id: string, status: string) {
    await fetchWithAuth('/api/tenant/documents', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  async function deleteDoc(id: string, title: string) {
    setConfirmState({
      message: `Permanently delete "${title}"? This cannot be undone.`,
      onConfirm: async () => {
        setDeleting(id)
        await fetchWithAuth(`/api/tenant/documents?id=${id}`, { method: 'DELETE' })
        setDeleting(null)
        load()
      }
    })
  }

  function startEdit(d: Doc) {
    setEditing(d.id)
    setEditForm({ title: d.title, expiryDate: d.expiryDate ?? '', notes: d.notes ?? '' })
  }

  async function saveEdit(id: string) {
    setEditSaving(true)
    await fetchWithAuth('/api/tenant/documents', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        title:      editForm.title,
        expiryDate: editForm.expiryDate || null,
        notes:      editForm.notes || null,
      }),
    })
    setEditing(null)
    setEditSaving(false)
    load()
  }

  const filtered = docs.filter(d =>
    !search ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    `${d.employeeFirstName ?? ''} ${d.employeeLastName ?? ''}`.toLowerCase().includes(search.toLowerCase())
  )

  function handleExport() {
    exportCsv({
      filename: 'documents',
      columns: [
        { header: 'Title',    key: 'title' },
        { header: 'Category', key: 'category' },
        { header: 'Employee', key: 'employee' },
        { header: 'Status',   key: 'status' },
        { header: 'Expiry Date', key: 'expiryDate', format: fmtCsvDate },
        { header: 'Created',     key: 'createdAt',  format: fmtCsvDate },
      ],
      rows: filtered.map(d => ({
        title:     d.title,
        category:  d.category,
        employee:  d.employeeFirstName ? `${d.employeeFirstName} ${d.employeeLastName}` : 'Org-wide',
        status:    d.status.replace('_', ' '),
        expiryDate: d.expiryDate,
        createdAt:  d.createdAt,
      })),
    })
  }

  // Expiring soon — for alert banner
  const expiringDocs = docs.filter(d =>
    d.status === 'active' && d.expiryDate && d.expiryDate >= today && d.expiryDate <= in30
  ).sort((a, b) => (a.expiryDate! > b.expiryDate! ? 1 : -1))

  const expiredActiveDocs = docs.filter(d =>
    d.status === 'active' && d.expiryDate && d.expiryDate < today
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Management</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Centralised register with expiry tracking and Vercel Blob storage</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v) }}
          className="px-4 py-2 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium rounded-lg transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Document'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total',          value: stats.total,         color: 'text-foreground' },
          { label: 'Active',         value: stats.active,        color: 'text-green-400' },
          { label: 'Pending Review', value: stats.pendingReview, color: 'text-amber-400' },
          { label: 'Expiring (30d)', value: stats.expiringSoon,  color: stats.expiringSoon > 0 ? 'text-amber-400' : 'text-gray-600' },
          { label: 'Expired',        value: stats.expired,       color: stats.expired > 0 ? 'text-red-400' : 'text-gray-600' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Expired alert */}
      {expiredActiveDocs.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-700/60 rounded-2xl px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-red-300">{expiredActiveDocs.length} document{expiredActiveDocs.length > 1 ? 's' : ''} are expired but still marked active</p>
          <div className="flex flex-wrap gap-2">
            {expiredActiveDocs.slice(0, 5).map(d => (
              <span key={d.id} className="text-xs bg-red-900/40 border border-red-800 text-red-300 px-2.5 py-1 rounded-full">
                {d.employeeFirstName ? `${d.employeeFirstName} ${d.employeeLastName} — ` : ''}{d.title}
                {' '}({fmtDate(d.expiryDate)})
              </span>
            ))}
            {expiredActiveDocs.length > 5 && <span className="text-xs text-red-500">+{expiredActiveDocs.length - 5} more</span>}
          </div>
        </div>
      )}

      {/* Expiring soon alert */}
      {expiringDocs.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/50 rounded-2xl px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-amber-300">️ {expiringDocs.length} document{expiringDocs.length > 1 ? 's' : ''} expiring within 30 days</p>
          <div className="flex flex-wrap gap-2">
            {expiringDocs.map(d => {
              const days = daysUntilExpiry(d.expiryDate!)
              return (
                <span key={d.id} className="text-xs bg-amber-900/30 border border-amber-800/60 text-amber-300 px-2.5 py-1 rounded-full">
                  {d.employeeFirstName ? `${d.employeeFirstName} ${d.employeeLastName} — ` : ''}{d.title}
                  {' '}({days === 0 ? 'today' : `in ${days}d`})
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Add document form */}
      {showForm && (
        <form onSubmit={create} className="card-premium border-[#0E3D52]/30 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Add Document to Register</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={LABEL}>Title *</label>
              <input required value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Police Check — Jane Smith" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Category *</label>
              <select required value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={INPUT}>
                {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Linked Employee</label>
              <select value={form.employeeId}
                onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                <option value="">— Organisation-wide —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <FileUpload
                label="Upload File *"
                currentUrl={form.blobUrl || null}
                currentName={form.fileName || null}
                onUpload={(r: UploadResult) => setForm(f => ({
                  ...f, blobUrl: r.url, fileName: r.fileName,
                  fileSizeBytes: r.fileSizeBytes, mimeType: r.mimeType,
                }))}
              />
              <input type="hidden" required value={form.blobUrl} onChange={() => {}} />
            </div>
            <div>
              <label className={LABEL}>
                Expiry Date{EXPIRY_REQUIRED_CATS.has(form.category) ? ' *' : ''}
              </label>
              <input type="date" value={form.expiryDate}
                required={EXPIRY_REQUIRED_CATS.has(form.category)}
                onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} className={INPUT} />
              {EXPIRY_REQUIRED_CATS.has(form.category) && (
                <p className="text-xs text-amber-500 mt-1">Required for this document type</p>
              )}
            </div>
            <div>
              <label className={LABEL}>Notes</label>
              <input type="text" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Issuing authority, reference number…" className={INPUT} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving || !form.blobUrl}
              className="px-5 py-2 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {saving ? 'Saving…' : 'Add to Register'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search title or employee…"
          className="input-premium placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52] flex-1 min-w-48" />
        <select value={filterCat}
          onChange={e => { setFilterCat(e.target.value); load(e.target.value, filterStat) }}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All categories</option>
          {DOC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStat}
          onChange={e => { setFilterStat(e.target.value); load(filterCat, e.target.value) }}
          className="input-premium focus:outline-none focus:border-[#0E3D52]">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending_review">Pending Review</option>
          <option value="expired">Expired</option>
          <option value="archived">Archived</option>
        </select>
        <button
          onClick={() => { const next = !expiryFilter; setExpiryFilter(next); load(filterCat, filterStat, next) }}
          className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors whitespace-nowrap ${
            expiryFilter
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600'
          }`}
        >
          ⚠️ Expiring soon
        </button>
        {(filterCat || filterStat || search || expiryFilter) && (
          <button onClick={() => { setFilterCat(''); setFilterStat(''); setSearch(''); setExpiryFilter(false); load('', '', false) }}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-white px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg">
            Clear
          </button>
        )}
        <ExportButton onClick={handleExport} disabled={filtered.length === 0} />
      </div>

      {/* Document list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-premium rounded-2xl py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">No documents found</p>
          <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
            {filterCat || filterStat ? 'Try clearing filters' : 'Add a document to build your compliance register'}
          </p>
        </div>
      ) : (
        <div className="card-premium rounded-2xl overflow-hidden">
          {selectedDocs.size > 0 && (
            <div className="px-4 py-2 bg-[#E0EEF4] dark:bg-[#0E3D52]/15 border-b border-[#b8d4e0] dark:border-[#1A6080] flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-[#0E3D52] dark:text-[#7dcfd7]">{selectedDocs.size} selected</span>
              <button
                onClick={() => bulkUpdateStatus('archived')}
                disabled={bulkDocLoading}
                className="px-3 py-1 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 disabled:opacity-50"
              >
                {bulkDocLoading ? 'Working…' : '📦 Archive'}
              </button>
              <button
                onClick={() => bulkUpdateStatus('active')}
                disabled={bulkDocLoading}
                className="px-3 py-1 text-xs rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 disabled:opacity-50"
              >
                ✅ Mark active
              </button>
              <button onClick={() => setSelectedDocs(new Set())} className="ml-auto text-xs text-[#1A6080] dark:text-[#4ebac4] hover:text-[#0E3D52]">Clear</button>
            </div>
          )}
          <div className="table-responsive">
            <table className="table-premium">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="w-8 px-3 py-3">
                  <input type="checkbox"
                    checked={docs.length > 0 && selectedDocs.size === docs.length}
                    onChange={e => setSelectedDocs(e.target.checked ? new Set(docs.map(d => d.id)) : new Set())}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="px-4 py-3 text-left section-label">Document</th>
                <th className="px-4 py-3 text-left section-label">Category</th>
                <th className="px-4 py-3 text-left section-label">Employee</th>
                <th className="px-4 py-3 text-left section-label">Status</th>
                <th className="px-4 py-3 text-left section-label">Expiry</th>
                <th className="px-4 py-3 text-left section-label">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60">
              {filtered.map(d => (
                <>
                <tr key={d.id} className="hover:bg-gray-100 dark:hover:bg-gray-800/30 group">
                  <td className="px-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox"
                      checked={selectedDocs.has(d.id)}
                      onChange={e => setSelectedDocs(prev => {
                        const s = new Set(prev)
                        e.target.checked ? s.add(d.id) : s.delete(d.id)
                        return s
                      })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg shrink-0">{mimeIcon(d.mimeType)}</span>
                      <div>
                        {isRealUrl(d.blobUrl) ? (
                          <a href={d.blobUrl} target="_blank" rel="noopener noreferrer"
                            className="text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] underline underline-offset-2 text-sm font-medium">
                            {d.title}
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{d.title}</span>
                        )}
                        {d.fileName && isRealUrl(d.blobUrl) && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">{d.fileName} {fmtSize(d.fileSizeBytes)}</p>
                        )}
                        {!isRealUrl(d.blobUrl) && (
                          <p className="text-xs text-amber-500 mt-0.5">⚠ No file attached — upload a file to enable viewing</p>
                        )}
                        {d.notes && <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 italic">{d.notes}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {d.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                    {d.employeeFirstName
                      ? `${d.employeeFirstName} ${d.employeeLastName}`
                      : <span className="text-gray-600 dark:text-gray-400">Org-wide</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[d.status] ?? 'badge badge-gray'}`}>
                      {d.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${expColor(d.expiryDate)}`}>
                    {d.expiryDate ? (
                      <span title={fmtDate(d.expiryDate)}>
                        {fmtDate(d.expiryDate)}
                        {d.expiryDate < today && ' '}
                        {d.expiryDate >= today && d.expiryDate <= in30 && (
                          <span className="ml-1 text-amber-500">({daysUntilExpiry(d.expiryDate)}d)</span>
                        )}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {isRealUrl(d.blobUrl) && (
                        <button
                          onClick={e => { e.stopPropagation(); setPreview(d) }}
                          className="text-xs bg-[#0E3D52]/20 border border-[#1A6080]/40 text-[#7dcfd7] hover:bg-[#0E3D52]/40 px-2 py-1 rounded transition"
                          title="Preview document"
                        >
                          👁
                        </button>
                      )}
                      <button
                        onClick={() => editing === d.id ? setEditing(null) : startEdit(d)}
                        className="text-xs bg-[#0E3D52]/20 border border-[#1A6080] text-[#4ebac4] hover:bg-[#0E3D52]/40 px-2 py-1 rounded transition">
                        {editing === d.id ? 'Cancel' : 'Edit'}
                      </button>
                      {d.status === 'pending_review' && (
                        <button onClick={() => updateStatus(d.id, 'active')}
                          className="text-xs bg-green-900/30 border border-green-800 text-green-300 hover:bg-green-900/50 px-2 py-1 rounded transition">
                          Approve
                        </button>
                      )}
                      {d.status === 'active' && (
                        <button onClick={() => updateStatus(d.id, 'pending_review')}
                          className="text-xs bg-amber-900/30 border border-amber-800 text-amber-300 hover:bg-amber-900/50 px-2 py-1 rounded transition">
                          Review
                        </button>
                      )}
                      {d.status !== 'archived' && (
                        <button onClick={() => updateStatus(d.id, 'archived')}
                          className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-600 px-2 py-1 rounded transition">
                          Archive
                        </button>
                      )}
                      {d.status === 'archived' && (
                        <button onClick={() => updateStatus(d.id, 'active')}
                          className="text-xs bg-green-900/30 border border-green-800 text-green-300 hover:bg-green-900/50 px-2 py-1 rounded transition">
                          Restore
                        </button>
                      )}
                      <button
                        onClick={() => deleteDoc(d.id, d.title)}
                        disabled={deleting === d.id}
                        className="text-xs bg-red-900/20 border border-red-900 text-red-500 hover:bg-red-900/40 hover:text-red-300 disabled:opacity-50 px-2 py-1 rounded transition"
                      >
                        {deleting === d.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
                {editing === d.id && (
                  <tr key={`${d.id}-edit`} className="bg-[#0E3D52]/20 border-b border-[#0E3D52]/40">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label className={LABEL}>Title</label>
                          <input value={editForm.title}
                            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                            className={INPUT} />
                        </div>
                        <div>
                          <label className={LABEL}>Expiry Date</label>
                          <input type="date" value={editForm.expiryDate}
                            onChange={e => setEditForm(f => ({ ...f, expiryDate: e.target.value }))}
                            className={INPUT} />
                        </div>
                        <div>
                          <label className={LABEL}>Notes</label>
                          <input value={editForm.notes}
                            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Reference number, authority…"
                            className={INPUT} />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => saveEdit(d.id)} disabled={editSaving || !editForm.title.trim()}
                          className="px-4 py-1.5 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition">
                          {editSaving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button onClick={() => setEditing(null)}
                          className="px-4 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-xs rounded-lg transition">
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                </>
              ))}
            </tbody>
          </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-600 dark:text-gray-400">{filtered.length} document{filtered.length !== 1 ? 's' : ''} shown</p>
          </div>
        </div>
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      {preview && <DocPreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
