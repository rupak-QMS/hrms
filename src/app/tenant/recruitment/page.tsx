'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

// ── Types ──────────────────────────────────────────────────────────────────────

type Requisition = {
  id: string; title: string; description: string | null; status: string
  createdAt: string; closedAt: string | null
  applicationCount: number; hiredCount: number
}

type Application = {
  id: string; requisitionId: string; candidateId: string; status: string
  interviewScore: string | null; notes: string | null
  createdAt: string; updatedAt: string
  candidateFirstName: string | null; candidateLastName: string | null
  candidateEmail: string | null; candidateSource: string | null
}

type Candidate = {
  id: string; firstName: string; lastName: string; email: string
  phone: string | null; source: string | null; createdAt: string
}

type Stats = { total: number; open: number; draft: number; closed: number; totalApps: number; hired: number }

// ── Constants ──────────────────────────────────────────────────────────────────

const APP_STATUSES = [
  { value: 'received',    label: 'Received',    color: 'badge badge-blue' },
  { value: 'shortlisted', label: 'Shortlisted', color: 'badge badge-teal' },
  { value: 'interviewed', label: 'Interviewed', color: 'badge badge-amber' },
  { value: 'checks',      label: 'Ref Checks',  color: 'badge badge-amber' },
  { value: 'offer',       label: 'Offer',       color: 'badge badge-teal' },
  { value: 'hired',       label: 'Hired',       color: 'badge badge-green' },
  { value: 'rejected',    label: 'Rejected',    color: 'badge badge-red' },
]

const REQ_STATUS_STYLE: Record<string, string> = {
  draft:  'badge badge-gray',
  open:   'badge badge-green',
  closed: 'badge badge-red',
}

const INPUT = 'input-premium'

const SOURCES = ['Seek', 'LinkedIn', 'Indeed', 'Referral', 'Walk-in', 'Agency', 'Internal', 'Other']

// ── Helpers ────────────────────────────────────────────────────────────────────

const appStyle = (v: string) => APP_STATUSES.find(s => s.value === v)?.color ?? 'badge badge-gray'
const appLabel = (v: string) => APP_STATUSES.find(s => s.value === v)?.label ?? v

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RecruitmentPage() {
  const [tab,          setTab]          = useState<'jobs' | 'pipeline' | 'candidates'>('jobs')
  const [requisitions, setRequisitions] = useState<Requisition[]>([])
  const [stats,        setStats]        = useState<Stats>({ total:0, open:0, draft:0, closed:0, totalApps:0, hired:0 })
  const [applications, setApplications] = useState<Application[]>([])
  const [candidates,   setCandidates]   = useState<Candidate[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selectedReq,  setSelectedReq]  = useState<Requisition | null>(null)

  // Forms
  const [showReqForm,  setShowReqForm]  = useState(false)
  const [showAppForm,  setShowAppForm]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [reqForm, setReqForm] = useState({ title: '', description: '' })
  const [appForm, setAppForm] = useState({ firstName:'', lastName:'', email:'', phone:'', source:'', notes:'' })

  // Edit requisition
  const [editingReq,  setEditingReq]  = useState<Requisition | null>(null)
  const [editForm,    setEditForm]    = useState({ title: '', description: '' })
  const [savingEdit,  setSavingEdit]  = useState(false)

  // Pipeline card state
  const [expandedId,   setExpandedId]   = useState<string | null>(null)
  const [editingScore, setEditingScore] = useState<Record<string, string>>({})
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({})
  const [savingCard,   setSavingCard]   = useState<string | null>(null)
  const [deletingApp,  setDeletingApp]  = useState<string | null>(null)

  // Jobs filter
  const [filterStatus, setFilterStatus] = useState('')
  const [jobSearch,    setJobSearch]    = useState('')
  const [deletingReq,  setDeletingReq]  = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  // Candidate search
  const [candSearch, setCandSearch] = useState('')

  // Convert to employee
  const [convertApp,        setConvertApp]        = useState<Application | null>(null)
  const [convertForm,       setConvertForm]        = useState({ startDate: '', employmentType: 'full_time', createOnboarding: true })
  const [convertSaving,     setConvertSaving]      = useState(false)
  const [convertResult,     setConvertResult]      = useState<{ employeeId: string; employeeNumber: string } | null>(null)
  const [convertError,      setConvertError]       = useState('')

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadReqs = useCallback(async () => {
    setLoading(true)
    const data = await fetchWithAuth('/api/tenant/recruitment').then(r => r.json())
    setRequisitions(data.requisitions ?? [])
    setStats(data.stats ?? { total:0, open:0, draft:0, closed:0, totalApps:0, hired:0 })
    setLoading(false)
  }, [])

  const loadApps = useCallback(async (reqId: string) => {
    const data = await fetchWithAuth(`/api/tenant/recruitment?view=applications&requisitionId=${reqId}`).then(r => r.json())
    setApplications(data.applications ?? [])
  }, [])

  const loadCandidates = useCallback(async () => {
    const data = await fetchWithAuth('/api/tenant/recruitment?view=candidates').then(r => r.json())
    setCandidates(data.candidates ?? [])
  }, [])

  useEffect(() => { loadReqs() }, [])

  // ── Actions ───────────────────────────────────────────────────────────────────

  function openPipeline(req: Requisition) {
    setSelectedReq(req); setTab('pipeline'); loadApps(req.id)
  }

  async function createReq(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetchWithAuth('/api/tenant/recruitment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqForm),
    })
    setShowReqForm(false)
    setReqForm({ title: '', description: '' })
    setSaving(false); loadReqs()
  }

  async function saveEditReq(e: React.FormEvent) {
    e.preventDefault(); if (!editingReq) return; setSavingEdit(true)
    await fetchWithAuth('/api/tenant/recruitment', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingReq.id, title: editForm.title, description: editForm.description }),
    })
    setSavingEdit(false); setEditingReq(null); loadReqs()
  }

  async function deleteReq(id: string) {
    setConfirmState({
      message: 'Delete this requisition and all its applications?',
      onConfirm: async () => {
        setDeletingReq(id)
        await fetchWithAuth('/api/tenant/recruitment', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        setDeletingReq(null)
        if (selectedReq?.id === id) { setSelectedReq(null); setTab('jobs') }
        loadReqs()
      }
    })
  }

  async function updateReqStatus(id: string, status: string) {
    await fetchWithAuth('/api/tenant/recruitment', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    loadReqs()
  }

  async function addCandidate(e: React.FormEvent) {
    e.preventDefault(); if (!selectedReq) return; setSaving(true)
    const cRes  = await fetchWithAuth('/api/tenant/recruitment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _type: 'candidate', ...appForm }),
    })
    const cData = await cRes.json()
    if (cData.record?.id) {
      await fetchWithAuth('/api/tenant/recruitment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _type: 'application', requisitionId: selectedReq.id, candidateId: cData.record.id, notes: appForm.notes }),
      })
    }
    setShowAppForm(false)
    setAppForm({ firstName: '', lastName: '', email: '', phone: '', source: '', notes: '' })
    setSaving(false); loadApps(selectedReq.id)
  }

  async function moveStatus(appId: string, status: string) {
    await fetchWithAuth('/api/tenant/recruitment', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: appId, _type: 'application', status }),
    })
    if (selectedReq) loadApps(selectedReq.id)
  }

  async function saveCardNotes(appId: string) {
    setSavingCard(appId)
    await fetchWithAuth('/api/tenant/recruitment', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: appId, _type: 'application',
        notes:          editingNotes[appId] ?? '',
        interviewScore: editingScore[appId] !== '' ? editingScore[appId] : null,
      }),
    })
    setSavingCard(null)
    if (selectedReq) loadApps(selectedReq.id)
  }

  async function deleteApp(appId: string) {
    setConfirmState({
      message: 'Remove this candidate from the pipeline?',
      onConfirm: async () => {
        setDeletingApp(appId)
        await fetchWithAuth('/api/tenant/recruitment', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: appId, _type: 'application' }),
        })
        setDeletingApp(null)
        if (selectedReq) loadApps(selectedReq.id)
      }
    })
  }

  function openOfferLetter(app: Application) {
    const params = new URLSearchParams({
      candidateName:  `${app.candidateFirstName ?? ''} ${app.candidateLastName ?? ''}`.trim(),
      candidateEmail: app.candidateEmail ?? '',
    })
    window.location.href = `/tenant/offer-letters?${params}`
  }

  async function convertCandidate() {
    if (!convertApp) return
    setConvertSaving(true)
    const res = await fetchWithAuth('/api/tenant/recruitment/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: convertApp.id, ...convertForm }),
    })
    const data = await res.json()
    setConvertSaving(false)
    if (res.ok) {
      setConvertResult({ employeeId: data.employee.id, employeeNumber: data.employee.employeeNumber })
      if (selectedReq) loadApps(selectedReq.id)
    } else {
      // employee already exists case (409)
      if (res.status === 409 && data.employeeId) {
        setConvertResult({ employeeId: data.employeeId, employeeNumber: '' })
      } else {
        setConvertError(data.error ?? 'Failed to convert')
      }
    }
  }

  // ── CSV Exports ───────────────────────────────────────────────────────────────

  function exportJobs() {
    exportCsv({
      filename: 'job-requisitions',
      columns: [
        { header: 'Job Title',     key: 'title' },
        { header: 'Status',        key: 'status', format: v => (v as string).charAt(0).toUpperCase() + (v as string).slice(1) },
        { header: 'Applications',  key: 'applicationCount' },
        { header: 'Hired',         key: 'hiredCount' },
        { header: 'Description',   key: 'description', format: v => v ?? '' },
        { header: 'Created Date',  key: 'createdAt',  format: v => fmtCsvDate(v as string) },
        { header: 'Closed Date',   key: 'closedAt',   format: v => fmtCsvDate(v as string | null) },
      ],
      rows: requisitions,
    })
  }

  function exportApplications() {
    exportCsv({
      filename: `pipeline-${selectedReq?.title ?? 'applications'}`,
      columns: [
        { header: 'First Name',      key: 'candidateFirstName', format: v => v ?? '' },
        { header: 'Last Name',       key: 'candidateLastName',  format: v => v ?? '' },
        { header: 'Email',           key: 'candidateEmail',     format: v => v ?? '' },
        { header: 'Source',          key: 'candidateSource',    format: v => v ?? '' },
        { header: 'Stage',           key: 'status',             format: v => appLabel(v as string) },
        { header: 'Interview Score', key: 'interviewScore',     format: v => v ?? '' },
        { header: 'Notes',           key: 'notes',              format: v => v ?? '' },
        { header: 'Applied Date',    key: 'createdAt',          format: v => fmtCsvDate(v as string) },
        { header: 'Last Updated',    key: 'updatedAt',          format: v => fmtCsvDate(v as string) },
      ],
      rows: applications,
    })
  }

  function exportCandidates() {
    exportCsv({
      filename: 'candidates',
      columns: [
        { header: 'First Name', key: 'firstName' },
        { header: 'Last Name',  key: 'lastName' },
        { header: 'Email',      key: 'email' },
        { header: 'Phone',      key: 'phone',     format: v => v ?? '' },
        { header: 'Source',     key: 'source',    format: v => v ?? '' },
        { header: 'Added Date', key: 'createdAt', format: v => fmtCsvDate(v as string) },
      ],
      rows: candidates,
    })
  }

  // ── Filtered data ─────────────────────────────────────────────────────────────

  const visibleReqs = requisitions.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false
    if (jobSearch && !r.title.toLowerCase().includes(jobSearch.toLowerCase())) return false
    return true
  })

  const visibleCandidates = candidates.filter(c =>
    !candSearch ||
    `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(candSearch.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Edit Requisition Modal */}
      {editingReq && (
        <div className="modal-overlay">
          <form
            onSubmit={saveEditReq}
            className="card-premium shadow-2xl p-6 w-full max-w-lg mx-4 space-y-4"
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Edit Requisition</h3>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Job Title *</label>
              <input
                required value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                className={INPUT}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Description</label>
              <textarea
                rows={4} value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Role summary, responsibilities, requirements…"
                className={INPUT}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEditingReq(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
              <button type="submit" disabled={savingEdit}
                className="px-4 py-2 text-sm rounded-lg bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white font-medium transition">
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recruitment & ATS</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage job requisitions and candidate pipelines</p>
        </div>
        <div className="flex gap-2">
          {tab === 'jobs' && (
            <button onClick={() => setShowReqForm(v => !v)}
              className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
              {showReqForm ? 'Cancel' : '+ New Job'}
            </button>
          )}
          {tab === 'pipeline' && selectedReq && (
            <button onClick={() => setShowAppForm(v => !v)}
              className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
              {showAppForm ? 'Cancel' : '+ Add Candidate'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Jobs',   value: stats.total,    color: 'text-foreground' },
          { label: 'Open',         value: stats.open,     color: 'text-green-400' },
          { label: 'Draft',        value: stats.draft,    color: 'text-gray-400' },
          { label: 'Closed',       value: stats.closed,   color: 'text-red-400' },
          { label: 'Applications', value: stats.totalApps, color: 'text-blue-400' },
          { label: 'Hired',        value: stats.hired,    color: 'text-teal-400' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 w-fit">
        {(['jobs', 'pipeline', 'candidates'] as const).map(t => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              if (t === 'candidates' && candidates.length === 0) loadCandidates()
            }}
            disabled={t === 'pipeline' && !selectedReq}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t === 'jobs' ? 'Job Requisitions' : t === 'pipeline' ? `Pipeline${selectedReq ? ` — ${selectedReq.title}` : ''}` : 'Candidates'}
          </button>
        ))}
      </div>

      {/* ── JOBS TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'jobs' && (
        <div className="space-y-4">

          {/* Create form */}
          {showReqForm && (
            <form onSubmit={createReq} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#4ebac4]">Create Job Requisition</h3>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Job Title *</label>
                <input required value={reqForm.title}
                  onChange={e => setReqForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Support Worker — Community" className={INPUT} />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Description</label>
                <textarea value={reqForm.description}
                  onChange={e => setReqForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="Role summary, key responsibilities, requirements…" className={INPUT} />
              </div>
              <button type="submit" disabled={saving}
                className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
                {saving ? 'Creating…' : 'Create Requisition'}
              </button>
            </form>
          )}

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <input
              type="search" placeholder="Search jobs…" value={jobSearch}
              onChange={e => setJobSearch(e.target.value)}
              className="input-premium w-48"
            />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="input-premium">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            {(filterStatus || jobSearch) && (
              <button onClick={() => { setFilterStatus(''); setJobSearch('') }}
                className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] px-2">
                Clear
              </button>
            )}
            <ExportButton onClick={exportJobs} disabled={requisitions.length === 0} />
          </div>

          {/* Jobs list */}
          {loading ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading…</p>
          ) : visibleReqs.length === 0 ? (
            <div className="card-premium py-14 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                {requisitions.length === 0 ? 'No requisitions yet' : 'No jobs match the current filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleReqs.map(r => (
                <div key={r.id} className="card-premium p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-foreground font-semibold">{r.title}</span>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${REQ_STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </div>
                      {r.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{r.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Created {fmt(r.createdAt)}</span>
                        <span className="text-blue-400">{r.applicationCount} application{r.applicationCount !== 1 ? 's' : ''}</span>
                        <span className="text-teal-400">{r.hiredCount} hired</span>
                        {r.closedAt && <span>Closed {fmt(r.closedAt)}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => openPipeline(r)}
                        className="text-xs bg-[#0E3D52]/20 border border-[#1A6080] text-[#4ebac4] hover:bg-[#0E3D52]/40 px-3 py-1.5 rounded-lg transition">
                        View Pipeline
                      </button>
                      <button
                        onClick={() => { setEditingReq(r); setEditForm({ title: r.title, description: r.description ?? '' }) }}
                        className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-600 hover:text-blue-400 px-3 py-1.5 rounded-lg transition">
                        Edit
                      </button>
                      {r.status === 'draft' && (
                        <button onClick={() => updateReqStatus(r.id, 'open')}
                          className="text-xs bg-green-900/40 border border-green-800 text-green-300 hover:bg-green-900/60 px-3 py-1.5 rounded-lg transition">
                          Open Role
                        </button>
                      )}
                      {r.status === 'open' && (
                        <button onClick={() => updateReqStatus(r.id, 'closed')}
                          className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-red-700 hover:text-red-400 px-3 py-1.5 rounded-lg transition">
                          Close Role
                        </button>
                      )}
                      {r.status === 'closed' && (
                        <button onClick={() => updateReqStatus(r.id, 'open')}
                          className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-700 hover:text-green-400 px-3 py-1.5 rounded-lg transition">
                          Reopen
                        </button>
                      )}
                      <button
                        onClick={() => deleteReq(r.id)}
                        disabled={deletingReq === r.id}
                        className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-red-700 hover:text-red-400 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                        {deletingReq === r.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PIPELINE TAB ─────────────────────────────────────────────────────── */}
      {tab === 'pipeline' && selectedReq && (
        <div className="space-y-4">

          {/* Add candidate form */}
          {showAppForm && (
            <form onSubmit={addCandidate} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#4ebac4]">Add Candidate to Pipeline</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">First Name *</label>
                  <input required value={appForm.firstName}
                    onChange={e => setAppForm(f => ({ ...f, firstName: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Last Name *</label>
                  <input required value={appForm.lastName}
                    onChange={e => setAppForm(f => ({ ...f, lastName: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Email *</label>
                  <input required type="email" value={appForm.email}
                    onChange={e => setAppForm(f => ({ ...f, email: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Phone</label>
                  <input value={appForm.phone}
                    onChange={e => setAppForm(f => ({ ...f, phone: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Source</label>
                  <select value={appForm.source}
                    onChange={e => setAppForm(f => ({ ...f, source: e.target.value }))} className={INPUT}>
                    <option value="">— Select —</option>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Initial Notes</label>
                <textarea value={appForm.notes}
                  onChange={e => setAppForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="First impressions, referral context…" className={INPUT} />
              </div>
              <button type="submit" disabled={saving}
                className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
                {saving ? 'Adding…' : 'Add to Pipeline'}
              </button>
            </form>
          )}

          {/* Pipeline actions */}
          {applications.length > 0 && (
            <div className="flex justify-end">
              <ExportButton onClick={exportApplications} />
            </div>
          )}

          {/* Kanban board */}
          {applications.length === 0 ? (
            <div className="card-premium py-14 text-center">
              <p className="text-gray-600 dark:text-gray-300 font-medium">No candidates in pipeline</p>
              <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">Click "+ Add Candidate" to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3 min-w-max">
                {APP_STATUSES.map(stage => {
                  const cols = applications.filter(a => a.status === stage.value)
                  return (
                    <div key={stage.value} className="w-60 flex-none space-y-2">
                      {/* Column header */}
                      <div className="flex items-center justify-between px-1">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{stage.label}</p>
                        <span className="text-xs bg-gray-800 text-gray-400 rounded-full px-2 py-0.5">{cols.length}</span>
                      </div>

                      {/* Cards */}
                      <div className="space-y-2 min-h-[80px]">
                        {cols.map(a => {
                          const isExpanded  = expandedId === a.id
                          const isSaving    = savingCard === a.id
                          const isDeleting  = deletingApp === a.id
                          const otherStages = APP_STATUSES.filter(s => s.value !== stage.value)
                          return (
                            <div key={a.id}
                              className={`card-premium p-3 space-y-2 transition ${
                                stage.value === 'hired'    ? 'border-green-800' :
                                stage.value === 'rejected' ? 'border-red-900/70' :
                                stage.value === 'offer'    ? 'border-teal-800' :
                                'border-gray-200 dark:border-gray-800'
                              }`}>

                              {/* Card header */}
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-white truncate">
                                    {a.candidateFirstName} {a.candidateLastName}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">{a.candidateEmail}</p>
                                  {a.candidateSource && (
                                    <p className="text-xs text-gray-600 dark:text-gray-500 mt-0.5">via {a.candidateSource}</p>
                                  )}
                                  {a.interviewScore && (
                                    <p className="text-xs text-amber-400 mt-0.5">⭐ {a.interviewScore}/10</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    setExpandedId(isExpanded ? null : a.id)
                                    if (!isExpanded) {
                                      setEditingNotes(p => ({ ...p, [a.id]: a.notes ?? '' }))
                                      setEditingScore(p => ({ ...p, [a.id]: a.interviewScore ?? '' }))
                                    }
                                  }}
                                  className="text-gray-500 hover:text-white text-xs shrink-0 mt-0.5 transition"
                                >
                                  {isExpanded ? '▲' : '▼'}
                                </button>
                              </div>

                              {/* Expanded notes/score */}
                              {isExpanded && (
                                <div className="space-y-2 pt-1 border-t border-gray-200 dark:border-gray-800">
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Interview Score (0–10)</label>
                                    <input type="number" min="0" max="10" step="0.5"
                                      value={editingScore[a.id] ?? ''}
                                      onChange={e => setEditingScore(p => ({ ...p, [a.id]: e.target.value }))}
                                      placeholder="—"
                                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-[#0E3D52]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                                    <textarea
                                      value={editingNotes[a.id] ?? ''}
                                      onChange={e => setEditingNotes(p => ({ ...p, [a.id]: e.target.value }))}
                                      rows={3} placeholder="Interview notes, feedback…"
                                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white resize-none focus:outline-none focus:border-[#0E3D52]"
                                    />
                                  </div>
                                  <button disabled={isSaving} onClick={() => saveCardNotes(a.id)}
                                    className="w-full py-1 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition">
                                    {isSaving ? 'Saving…' : 'Save Notes'}
                                  </button>
                                  <button disabled={isDeleting} onClick={() => deleteApp(a.id)}
                                    className="w-full py-1 bg-gray-800 hover:bg-red-900/50 border border-gray-700 hover:border-red-800 disabled:opacity-50 text-gray-400 hover:text-red-400 text-xs rounded-lg transition">
                                    {isDeleting ? 'Removing…' : 'Remove from Pipeline'}
                                  </button>
                                </div>
                              )}

                              {/* Create offer letter CTA */}
                              {stage.value === 'offer' && (
                                <button onClick={() => openOfferLetter(a)}
                                  className="w-full py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-600 text-white rounded-lg transition">
                                  📄 Create Offer Letter
                                </button>
                              )}

                              {/* Convert to employee CTA */}
                              {stage.value === 'hired' && (
                                <button
                                  onClick={() => { setConvertApp(a); setConvertResult(null); setConvertForm({ startDate: '', employmentType: 'full_time', createOnboarding: true }) }}
                                  className="w-full py-1.5 text-xs font-medium bg-green-700 hover:bg-green-600 text-white rounded-lg transition">
                                  👤 Convert to Employee
                                </button>
                              )}

                              {/* Move to stage */}
                              <div className="relative group">
                                <button className="w-full py-1 text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition">
                                  Move to stage ▾
                                </button>
                                <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-900 border border-gray-700 rounded-xl shadow-xl z-10 overflow-hidden hidden group-hover:block">
                                  {otherStages.map(s => (
                                    <button key={s.value} onClick={() => moveStatus(a.id, s.value)}
                                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition">
                                      → {s.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CANDIDATES TAB ───────────────────────────────────────────────────── */}
      {tab === 'candidates' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="search" placeholder="Search candidates…" value={candSearch}
              onChange={e => setCandSearch(e.target.value)}
              className="input-premium w-64"
            />
            <ExportButton onClick={exportCandidates} disabled={candidates.length === 0} />
          </div>

          {candidates.length === 0 ? (
            <div className="card-premium py-14 text-center">
              <p className="text-gray-600 dark:text-gray-300 font-medium">No candidates yet</p>
              <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">
                Candidates appear here once added to a pipeline.
              </p>
            </div>
          ) : (
            <div className="card-premium overflow-hidden">
              <div className="table-responsive">
            <table className="table-premium">
                <thead>
                  <tr>
                    {['Candidate', 'Email', 'Phone', 'Source', 'Added'].map(h => (
                      <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {visibleCandidates.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#0E3D52] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {c.firstName[0]}{c.lastName[0]}
                          </div>
                          <span className="text-gray-700 dark:text-gray-200 font-medium">{c.firstName} {c.lastName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{c.email}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{c.phone ?? '—'}</td>
                      <td className="px-5 py-3">
                        {c.source ? (
                          <span className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                            {c.source}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400 text-xs">{fmt(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
            </div>
          )}
        </div>
      )}

      {/* ── Convert to Employee Modal ─────────────────────────────────────── */}
      {convertApp && (
        <div className="modal-overlay backdrop-blur-sm p-4">
          <div className="card-premium shadow-2xl w-full max-w-md p-6 space-y-4">
            {convertResult ? (
              /* Success state */
              <div className="text-center space-y-4">
                <div className="text-5xl">🎉</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Employee Created!</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>{convertApp.candidateFirstName} {convertApp.candidateLastName}</strong> has been added as an employee
                  {convertResult.employeeNumber ? ` (${convertResult.employeeNumber})` : ''}.
                </p>
                <p className="text-xs text-gray-500">An onboarding record has been created in the Onboarding module.</p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setConvertApp(null)}
                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >Close</button>
                  <a
                    href="/tenant/employees"
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium text-center transition"
                  >View in Employees →</a>
                </div>
              </div>
            ) : (
              /* Form state */
              <>
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Convert to Employee</h3>
                  <p className="page-premium-subtitle mt-0.5">
                    Create an employee record for <strong>{convertApp.candidateFirstName} {convertApp.candidateLastName}</strong>
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Start Date *</label>
                    <input
                      type="date" required
                      value={convertForm.startDate}
                      onChange={e => setConvertForm(f => ({ ...f, startDate: e.target.value }))}
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Employment Type</label>
                    <select
                      value={convertForm.employmentType}
                      onChange={e => setConvertForm(f => ({ ...f, employmentType: e.target.value }))}
                      className={INPUT}
                    >
                      <option value="full_time">Full-time</option>
                      <option value="part_time">Part-time</option>
                      <option value="casual">Casual</option>
                      <option value="contractor">Contractor</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={convertForm.createOnboarding}
                      onChange={e => setConvertForm(f => ({ ...f, createOnboarding: e.target.checked }))}
                    />
                    Create onboarding checklist automatically
                  </label>
                </div>

                {convertError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{convertError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setConvertApp(null); setConvertError('') }}
                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  >Cancel</button>
                  <button
                    disabled={!convertForm.startDate || convertSaving}
                    onClick={convertCandidate}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                  >{convertSaving ? 'Creating…' : '👤 Create Employee'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
