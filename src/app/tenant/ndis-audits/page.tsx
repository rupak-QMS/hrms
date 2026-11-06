'use client'

import { useState, useCallback, useEffect } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { useRouter } from 'next/navigation'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

// ── Types ────────────────────────────────────────────────────────────────────

type Audit = {
  id: string
  title: string
  auditType: string
  standard: string
  outcomeGroup: string | null
  status: string
  result: string | null
  riskRating: string | null
  scheduledDate: string
  completedDate: string | null
  nextReviewDate: string | null
  auditorName: string | null
  auditorOrg: string | null
  findingSummary: string | null
  correctiveActions: string | null
  notes: string | null
  assignedTo: string | null
  createdAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIT_TYPES: Record<string, string> = {
  internal:      'Internal',
  external:      'External',
  certification: 'Certification',
  surveillance:  'Surveillance',
}

const OUTCOME_GROUPS: Record<string, string> = {
  rights_protection: 'Rights & Protection',
  governance:        'Governance',
  support_provision: 'Support Provision',
  workforce:         'Workforce',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: 'Scheduled',   cls: 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/20 dark:text-[#4ebac4]' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  completed:   { label: 'Completed',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  overdue:     { label: 'Overdue',     cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
}

const RESULT_BADGE: Record<string, { label: string; cls: string }> = {
  conformant:      { label: 'Conformant',      cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  non_conformant:  { label: 'Non-Conformant',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  partial:         { label: 'Partial',         cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  not_applicable:  { label: 'N/A',             cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

const RISK_BADGE: Record<string, { label: string; cls: string }> = {
  low:      { label: 'Low',      cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  medium:   { label: 'Medium',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  high:     { label: 'High',     cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  critical: { label: 'Critical', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

const BLANK: Partial<Audit> & { auditType: string; standard: string; scheduledDate: string } = {
  title: '', auditType: 'internal', standard: '', outcomeGroup: '',
  status: 'scheduled', result: '', riskRating: '', scheduledDate: '',
  auditorName: '', auditorOrg: '', assignedTo: '', notes: '',
  findingSummary: '', correctiveActions: '',
}

function AuditModal({ initial, onClose, onSaved }: {
  initial?: Audit | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<typeof BLANK>(initial ? {
    ...BLANK,
    ...initial,
    outcomeGroup: initial.outcomeGroup ?? '',
    result: initial.result ?? '',
    riskRating: initial.riskRating ?? '',
    auditorName: initial.auditorName ?? '',
    auditorOrg: initial.auditorOrg ?? '',
    assignedTo: initial.assignedTo ?? '',
    notes: initial.notes ?? '',
    findingSummary: initial.findingSummary ?? '',
    correctiveActions: initial.correctiveActions ?? '',
  } : { ...BLANK })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      const url = initial ? `/api/tenant/ndis/audits/${initial.id}` : '/api/tenant/ndis/audits'
      const method = initial ? 'PATCH' : 'POST'
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          outcomeGroup: form.outcomeGroup || null,
          result: form.result || null,
          riskRating: form.riskRating || null,
          auditorName: form.auditorName || null,
          auditorOrg: form.auditorOrg || null,
          assignedTo: form.assignedTo || null,
          notes: form.notes || null,
          findingSummary: form.findingSummary || null,
          correctiveActions: form.correctiveActions || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Save failed'); return }
      onSaved()
      onClose()
    } catch { setErr('Network error') } finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {initial ? 'Edit Audit' : 'New NDIS Audit'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          {err && <p className="text-red-600 text-sm">{err}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Audit Type *</label>
              <select value={form.auditType} onChange={e => set('auditType', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                {Object.entries(AUDIT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Outcome Group</label>
              <select value={form.outcomeGroup ?? ''} onChange={e => set('outcomeGroup', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                <option value="">— None —</option>
                {Object.entries(OUTCOME_GROUPS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Standard *</label>
            <input value={form.standard} onChange={e => set('standard', e.target.value)} required
              placeholder="e.g. NDIS Practice Standard 1.1 — Person-centred Supports"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                {Object.entries(STATUS_BADGE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Result</label>
              <select value={form.result ?? ''} onChange={e => set('result', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                <option value="">— Pending —</option>
                {Object.entries(RESULT_BADGE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Risk Rating</label>
              <select value={form.riskRating ?? ''} onChange={e => set('riskRating', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                <option value="">— None —</option>
                {Object.entries(RISK_BADGE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Scheduled Date *</label>
              <input type="date" value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Completed Date</label>
              <input type="date" value={form.completedDate ?? ''} onChange={e => set('completedDate', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Next Review</label>
              <input type="date" value={form.nextReviewDate ?? ''} onChange={e => set('nextReviewDate', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Auditor Name</label>
              <input value={form.auditorName ?? ''} onChange={e => set('auditorName', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Auditor Org</label>
              <input value={form.auditorOrg ?? ''} onChange={e => set('auditorOrg', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Assigned To</label>
            <input value={form.assignedTo ?? ''} onChange={e => set('assignedTo', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Finding Summary</label>
            <textarea rows={3} value={form.findingSummary ?? ''} onChange={e => set('findingSummary', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Corrective Actions</label>
            <textarea rows={3} value={form.correctiveActions ?? ''} onChange={e => set('correctiveActions', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#0E3D52] text-white text-sm font-medium hover:bg-[#1A6080] disabled:opacity-50">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Audit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NDISAuditsPage() {
  const router = useRouter()
  const [audits, setAudits] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editAudit, setEditAudit] = useState<Audit | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const fetchAudits = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (search)       p.set('search', search)
      if (filterStatus) p.set('status', filterStatus)
      if (filterType)   p.set('type', filterType)
      p.set('limit', '100')
      const res = await fetchWithAuth(`/api/tenant/ndis/audits?${p}`)
      if (!res.ok) { setAudits([]); return }
      const data = await res.json()
      setAudits(data.audits ?? [])
    } catch { setAudits([]) } finally { setLoading(false) }
  }, [search, filterStatus, filterType])

  useEffect(() => { fetchAudits() }, [fetchAudits])

  async function deleteAudit(id: string) {
    setConfirmState({
      message: 'Delete this audit? This cannot be undone.',
      onConfirm: async () => {
        setDeleting(id)
        await fetchWithAuth(`/api/tenant/ndis/audits/${id}`, { method: 'DELETE' })
        setDeleting(null)
        fetchAudits()
      }
    })
  }

  // Summary counts
  const total       = audits.length
  const overdue     = audits.filter(a => a.status === 'overdue').length
  const nonConf     = audits.filter(a => a.result === 'non_conformant').length
  const scheduled   = audits.filter(a => a.status === 'scheduled').length

  function exportAudits() {
    exportCsv({
      filename: 'ndis-audits',
      columns: [
        { header: 'Title', key: 'title' },
        { header: 'Audit Type', key: 'auditType', format: v => AUDIT_TYPES[v] ?? v },
        { header: 'Status', key: 'status', format: v => STATUS_BADGE[v]?.label ?? v },
        { header: 'Scheduled Date', key: 'scheduledDate', format: v => fmtCsvDate(v) },
        { header: 'Completed Date', key: 'completedDate', format: v => fmtCsvDate(v) },
        { header: 'Outcome', key: 'result', format: v => v ? (RESULT_BADGE[v]?.label ?? v) : '' },
        { header: 'Auditor Name', key: 'auditorName', format: v => v ?? '' },
        { header: 'Notes', key: 'notes', format: v => v ?? '' },
      ],
      rows: audits,
    })
  }

  return (
    <div className="space-y-6">
      {showModal && (
        <AuditModal
          initial={editAudit}
          onClose={() => { setShowModal(false); setEditAudit(null) }}
          onSaved={fetchAudits}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-premium-title">NDIS Practice Standards Audit</h1>
          <p className="page-premium-subtitle mt-0.5">Track audits, findings and corrective actions</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportAudits} disabled={audits.length === 0} />
          <button
            onClick={() => { setEditAudit(null); setShowModal(true) }}
            className="px-4 py-2 bg-[#0E3D52] text-white text-sm font-medium rounded-xl hover:bg-[#1A6080] transition">
            + New Audit
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Audits',    value: total,     cls: 'text-gray-900 dark:text-white' },
          { label: 'Scheduled',       value: scheduled, cls: 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]' },
          { label: 'Overdue',         value: overdue,   cls: 'text-red-600 dark:text-red-400' },
          { label: 'Non-Conformant',  value: nonConf,   cls: 'text-orange-600 dark:text-orange-400' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="card-premium rounded-2xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search audits…"
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm w-56"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_BADGE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
          <option value="">All Types</option>
          {Object.entries(AUDIT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card-premium rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
        ) : audits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <span className="text-3xl">📋</span>
            <p className="text-sm">No audits found</p>
            <button onClick={() => setShowModal(true)} className="text-sm text-[#1A6080] dark:text-[#4ebac4] hover:underline">Create your first audit</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="table-responsive">
            <table className="table-premium">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  {['Title / Standard', 'Type', 'Status', 'Result', 'Risk', 'Scheduled', 'Next Review', 'Auditor', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400  whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {audits.map(audit => {
                  const sb = STATUS_BADGE[audit.status] ?? STATUS_BADGE.scheduled
                  const rb = audit.result ? RESULT_BADGE[audit.result] : null
                  const risk = audit.riskRating ? RISK_BADGE[audit.riskRating] : null
                  return (
                    <tr key={audit.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{audit.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{audit.standard}</p>
                        {audit.outcomeGroup && (
                          <p className="text-xs text-[#0E3D52] dark:text-[#4ebac4]">{OUTCOME_GROUPS[audit.outcomeGroup] ?? audit.outcomeGroup}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {AUDIT_TYPES[audit.auditType] ?? audit.auditType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sb.cls}`}>{sb.label}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {rb ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${rb.cls}`}>{rb.label}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {risk ? <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${risk.cls}`}>{risk.label}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {audit.scheduledDate ? new Date(audit.scheduledDate).toLocaleDateString('en-AU') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {audit.nextReviewDate ? new Date(audit.nextReviewDate).toLocaleDateString('en-AU') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {audit.auditorName ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditAudit(audit); setShowModal(true) }}
                            className="text-xs text-[#1A6080] dark:text-[#4ebac4] hover:text-[#0E3D52] dark:hover:text-[#7dcfd7] font-medium">
                            Edit
                          </button>
                          <button
                            onClick={() => deleteAudit(audit.id)}
                            disabled={deleting === audit.id}
                            className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 font-medium disabled:opacity-40">
                            Delete
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
        )}
      </div>
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
