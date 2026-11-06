'use client'

import { useState, useCallback, useEffect } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

// ── Types ────────────────────────────────────────────────────────────────────

type Incident = {
  id: string
  incidentType: string
  incidentCategory: string | null
  isReportable: boolean
  status: string
  severity: string
  participantName: string | null
  workerName: string | null
  workerRole: string | null
  title: string
  description: string
  location: string | null
  incidentDate: string
  commissionNotified: boolean
  commissionNotifyDate: string | null
  commissionRefNumber: string | null
  policeNotified: boolean
  immediateActions: string | null
  rootCause: string | null
  assignedTo: string | null
  notes: string | null
  createdAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const INCIDENT_TYPES: Record<string, string> = {
  death:                          'Death',
  serious_injury:                 'Serious Injury',
  abuse:                          'Abuse/Neglect',
  neglect:                        'Neglect',
  unlawful_sexual:                'Unlawful Sexual Contact',
  unauthorised_restrictive_practice: 'Unauthorised Restrictive Practice',
  other:                          'Other',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open:                    { label: 'Open',                 cls: 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/20 dark:text-[#4ebac4]' },
  under_review:            { label: 'Under Review',         cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  reported_to_commission:  { label: 'Reported to Commission', cls: 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/40 dark:text-[#1A6080] dark:text-[#4ebac4]' },
  closed:                  { label: 'Closed',               cls: 'bg-gray-100 text-gray-600 dark:bg-[#0E3D52]/60 dark:text-gray-400' },
}

const SEVERITY_BADGE: Record<string, { label: string; cls: string }> = {
  low:      { label: 'Low',      cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  medium:   { label: 'Medium',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  high:     { label: 'High',     cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  critical: { label: 'Critical', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
}

// ── Create / Edit Modal ───────────────────────────────────────────────────────

const BLANK = {
  incidentType: 'other', incidentCategory: '', isReportable: true, status: 'open',
  severity: 'medium', participantName: '', workerName: '', workerRole: '',
  title: '', description: '', location: '',
  incidentDate: '', discoveredDate: '',
  reportedInternally: false, internalReportDate: '',
  commissionNotified: false, commissionNotifyDate: '', commissionRefNumber: '',
  policeNotified: false, policeReportNumber: '',
  immediateActions: '', rootCause: '', outcomeDescription: '',
  assignedTo: '', notes: '',
}

function IncidentModal({ initial, onClose, onSaved }: {
  initial?: Incident | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    ...BLANK,
    ...(initial ? {
      ...initial,
      incidentDate: initial.incidentDate ? initial.incidentDate.slice(0, 16) : '',
      incidentCategory: initial.incidentCategory ?? '',
      participantName: initial.participantName ?? '',
      workerName: initial.workerName ?? '',
      workerRole: initial.workerRole ?? '',
      location: initial.location ?? '',
      commissionNotifyDate: initial.commissionNotifyDate ?? '',
      commissionRefNumber: initial.commissionRefNumber ?? '',
      immediateActions: initial.immediateActions ?? '',
      rootCause: initial.rootCause ?? '',
      assignedTo: initial.assignedTo ?? '',
      notes: initial.notes ?? '',
    } : {}),
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErr('')
    try {
      const url = initial ? `/api/tenant/ndis/incidents/${initial.id}` : '/api/tenant/ndis/incidents'
      const method = initial ? 'PATCH' : 'POST'
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          incidentCategory: form.incidentCategory || null,
          participantName: form.participantName || null,
          workerName: form.workerName || null,
          workerRole: form.workerRole || null,
          location: form.location || null,
          commissionNotifyDate: form.commissionNotifyDate || null,
          commissionRefNumber: form.commissionRefNumber || null,
          immediateActions: form.immediateActions || null,
          rootCause: form.rootCause || null,
          assignedTo: form.assignedTo || null,
          notes: form.notes || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Save failed'); return }
      onSaved()
      onClose()
    } catch { setErr('Network error') } finally { setSaving(false) }
  }

  const chk = (k: string, checked: boolean) => set(k, checked)

  return (
    <div className="modal-overlay">
      <div className="bg-white dark:bg-[#0F1E2E] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-[#1A6080]/20">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {initial ? 'Edit Incident' : 'New Reportable Incident'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          {err && <p className="text-red-600 text-sm">{err}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Incident Type *</label>
              <select value={form.incidentType} onChange={e => set('incidentType', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm">
                {Object.entries(INCIDENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Sub-category</label>
              <input value={form.incidentCategory} onChange={e => set('incidentCategory', e.target.value)}
                placeholder="Optional sub-category"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm">
                {Object.entries(STATUS_BADGE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Severity</label>
              <select value={form.severity} onChange={e => set('severity', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm">
                {Object.entries(SEVERITY_BADGE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Incident Date *</label>
              <input type="datetime-local" value={form.incidentDate} onChange={e => set('incidentDate', e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Participant Name</label>
              <input value={form.participantName} onChange={e => set('participantName', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Worker Name</label>
              <input value={form.workerName} onChange={e => set('workerName', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description *</label>
            <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Immediate Actions Taken</label>
            <textarea rows={2} value={form.immediateActions} onChange={e => set('immediateActions', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm resize-none" />
          </div>

          {/* Reporting flags */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 ">Reporting Obligations</p>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="reportable" checked={form.isReportable}
                onChange={e => chk('isReportable', e.target.checked)}
                className="rounded" />
              <label htmlFor="reportable" className="text-sm text-gray-700 dark:text-gray-300">Reportable to NDIS Commission</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="commNotified" checked={form.commissionNotified}
                onChange={e => chk('commissionNotified', e.target.checked)}
                className="rounded" />
              <label htmlFor="commNotified" className="text-sm text-gray-700 dark:text-gray-300">NDIS Commission Notified</label>
            </div>
            {form.commissionNotified && (
              <div className="grid grid-cols-2 gap-3 ml-5">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notify Date</label>
                  <input type="date" value={form.commissionNotifyDate} onChange={e => set('commissionNotifyDate', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Commission Ref #</label>
                  <input value={form.commissionRefNumber} onChange={e => set('commissionRefNumber', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="policeNotified" checked={form.policeNotified}
                onChange={e => chk('policeNotified', e.target.checked)}
                className="rounded" />
              <label htmlFor="policeNotified" className="text-sm text-gray-700 dark:text-gray-300">Police Notified</label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Root Cause Analysis</label>
            <textarea rows={2} value={form.rootCause} onChange={e => set('rootCause', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Assigned To</label>
            <input value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Log Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NDISIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editIncident, setEditIncident] = useState<Incident | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (search)         p.set('search', search)
      if (filterStatus)   p.set('status', filterStatus)
      if (filterSeverity) p.set('severity', filterSeverity)
      if (filterType)     p.set('type', filterType)
      p.set('limit', '100')
      const res = await fetchWithAuth(`/api/tenant/ndis/incidents?${p}`)
      if (!res.ok) { setIncidents([]); return }
      const data = await res.json()
      setIncidents(data.incidents ?? [])
    } catch { setIncidents([]) } finally { setLoading(false) }
  }, [search, filterStatus, filterSeverity, filterType])

  useEffect(() => { fetchIncidents() }, [fetchIncidents])

  async function deleteIncident(id: string) {
    setConfirmState({
      message: 'Delete this incident? This cannot be undone.',
      onConfirm: async () => {
        setDeleting(id)
        await fetchWithAuth(`/api/tenant/ndis/incidents/${id}`, { method: 'DELETE' })
        setDeleting(null)
        fetchIncidents()
      }
    })
  }

  // Summary
  const total      = incidents.length
  const open       = incidents.filter(i => i.status === 'open').length
  const critical   = incidents.filter(i => i.severity === 'critical').length
  const unnotified = incidents.filter(i => i.isReportable && !i.commissionNotified).length

  function exportIncidents() {
    exportCsv({
      filename: 'ndis-incidents',
      columns: [
        { header: 'Incident Type', key: 'incidentType', format: v => INCIDENT_TYPES[v] ?? v },
        { header: 'Severity', key: 'severity', format: v => SEVERITY_BADGE[v]?.label ?? v },
        { header: 'Date', key: 'incidentDate', format: v => fmtCsvDate(v) },
        { header: 'Status', key: 'status', format: v => STATUS_BADGE[v]?.label ?? v },
        { header: 'Participant Name', key: 'participantName', format: v => v ?? '' },
        { header: 'Description', key: 'description' },
        { header: 'Reported By', key: 'workerName', format: v => v ?? '' },
        { header: 'Notes', key: 'notes', format: v => v ?? '' },
      ],
      rows: incidents,
    })
  }

  return (
    <div className="space-y-6">
      {showModal && (
        <IncidentModal
          initial={editIncident}
          onClose={() => { setShowModal(false); setEditIncident(null) }}
          onSaved={fetchIncidents}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-premium-title">NDIS Reportable Incidents</h1>
          <p className="page-premium-subtitle mt-0.5">Manage, investigate and report incidents to the NDIS Commission</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportIncidents} disabled={incidents.length === 0} />
          <button
            onClick={() => { setEditIncident(null); setShowModal(true) }}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition">
            + Log Incident
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Incidents',       value: total,       cls: 'text-gray-900 dark:text-white' },
          { label: 'Open',                  value: open,        cls: 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]' },
          { label: 'Critical Severity',     value: critical,    cls: 'text-red-600 dark:text-red-400' },
          { label: 'Pending NDIS Notify',   value: unnotified,  cls: 'text-orange-600 dark:text-orange-400' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="card-premium p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Alert banner for unnotified reportable incidents */}
      {unnotified > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-sm text-orange-700 dark:text-orange-400 font-medium">
            {unnotified} reportable incident{unnotified > 1 ? 's' : ''} pending NDIS Commission notification.
            Review and notify within required timeframes.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search incidents…"
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm w-56"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_BADGE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm">
          <option value="">All Severities</option>
          {Object.entries(SEVERITY_BADGE).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-[#0A1929] text-gray-900 dark:text-white text-sm">
          <option value="">All Types</option>
          {Object.entries(INCIDENT_TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card-premium overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <span className="text-3xl">🛡</span>
            <p className="text-sm">No incidents recorded</p>
            <button onClick={() => setShowModal(true)} className="text-sm text-red-500 hover:underline">Log first incident</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="table-responsive">
            <table className="table-premium">
              <thead className="bg-gray-50 dark:bg-[#0A1929]/60">
                <tr>
                  {['Title', 'Type', 'Severity', 'Status', 'Participant', 'Date', 'Commission', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400  whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#1A6080]/20">
                {incidents.map(inc => {
                  const sb = STATUS_BADGE[inc.status] ?? STATUS_BADGE.open
                  const sev = SEVERITY_BADGE[inc.severity] ?? SEVERITY_BADGE.medium
                  return (
                    <tr key={inc.id} className="hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30/50 transition">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{inc.title}</p>
                        {inc.location && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">📍 {inc.location}</p>}
                        {inc.isReportable && !inc.commissionNotified && (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 font-medium">⚠ Notify NDIS</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">
                        {INCIDENT_TYPES[inc.incidentType] ?? inc.incidentType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sev.cls}`}>{sev.label}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sb.cls}`}>{sb.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {inc.participantName ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {new Date(inc.incidentDate).toLocaleDateString('en-AU')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {inc.commissionNotified ? (
                          <span className="text-green-600 dark:text-green-400 text-xs font-medium">✓ Notified{inc.commissionRefNumber ? ` #${inc.commissionRefNumber}` : ''}</span>
                        ) : inc.isReportable ? (
                          <span className="text-orange-600 dark:text-orange-400 text-xs font-medium">⏳ Pending</span>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditIncident(inc); setShowModal(true) }}
                            className="text-xs text-[#1A6080] dark:text-[#4ebac4] hover:text-[#0E3D52] dark:hover:text-[#7dcfd7] font-medium">
                            Edit
                          </button>
                          <button
                            onClick={() => deleteIncident(inc.id)}
                            disabled={deleting === inc.id}
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
