'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import EmptyState from '@/components/ui/EmptyState'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { useEffect, useMemo, useState } from 'react'

type Survey = { id: string; title: string; type: string | null; isAnonymous: boolean; questions: unknown[]; isActive: boolean; createdAt: string }
type Response = { id: string; surveyId: string; employeeId: string | null; answers: unknown; submittedAt: string; employeeFirstName: string | null; employeeLastName: string | null }
type Employee = { id: string; firstName: string; lastName: string }

const INPUT = 'input-premium'

const SURVEY_TYPES = [
  { value: 'new_starter_30', label: 'New Starter 30-day' },
  { value: 'probation_90',   label: 'Probation 90-day' },
  { value: 'annual',         label: 'Annual Engagement' },
  { value: 'pulse',          label: 'Pulse Check' },
  { value: 'exit',           label: 'Exit Survey' },
]
const typeLabel = (v: string | null) => SURVEY_TYPES.find(t => t.value === v)?.label ?? v ?? 'General'

export default function EngagementPage() {
  const [surveys,   setSurveys]   = useState<Survey[]>([])
  const [responses, setResponses] = useState<Response[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<Survey | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [showResp,  setShowResp]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form,     setForm]     = useState({ title:'', type:'pulse', isAnonymous:true })
  const [editSurvey, setEditSurvey] = useState<Survey | null>(null)
  const [respForm, setRespForm] = useState({ employeeId:'', freeText:'' })
  const [confirm,  setConfirm]  = useState<ConfirmState>(null)
  const [toast,    setToast]    = useState<ToastState>(null)

  // Search + filter
  const [search,     setSearch]     = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const load = async () => {
    setLoading(true)
    const data = await fetchWithAuth('/api/tenant/engagement').then(r => r.json())
    setSurveys(data.surveys ?? [])
    setLoading(false)
  }

  const loadResponses = async (surveyId: string) => {
    const data = await fetchWithAuth(`/api/tenant/engagement?surveyId=${surveyId}`).then(r => r.json())
    setResponses(data.responses ?? [])
  }

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function createSurvey(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/engagement', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      setShowForm(false); setForm({ title:'', type:'pulse', isAnonymous:true }); load()
      setToast({ message: 'Survey created', type: 'success' })
    } catch { setToast({ message: 'Failed to create', type: 'error' }) }
    setSaving(false)
  }

  async function saveSurveyEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editSurvey) return; setSaving(true)
    try {
      await fetchWithAuth(`/api/tenant/engagement/${editSurvey.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      setEditSurvey(null); setForm({ title:'', type:'pulse', isAnonymous:true }); load()
      setToast({ message: 'Survey updated', type: 'success' })
    } catch { setToast({ message: 'Failed to update', type: 'error' }) }
    setSaving(false)
  }

  async function submitResponse(e: React.FormEvent) {
    e.preventDefault(); if (!selected) return; setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/engagement', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ _type:'response', surveyId: selected.id, employeeId: respForm.employeeId, answers: { feedback: respForm.freeText } }),
      })
      setShowResp(false); setRespForm({ employeeId:'', freeText:'' })
      if (selected) loadResponses(selected.id)
      setToast({ message: 'Response recorded', type: 'success' })
    } catch { setToast({ message: 'Failed to save', type: 'error' }) }
    setSaving(false)
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetchWithAuth('/api/tenant/engagement', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, isActive }) })
    load()
  }

  async function deleteSurvey(id: string) {
    try {
      await fetchWithAuth(`/api/tenant/engagement/${id}`, { method:'DELETE' })
      if (selected?.id === id) { setSelected(null); setResponses([]) }
      load(); setToast({ message: 'Survey deleted', type: 'success' })
    } catch { setToast({ message: 'Failed to delete', type: 'error' }) }
  }

  function openEdit(s: Survey) {
    setForm({ title: s.title, type: s.type ?? 'pulse', isAnonymous: s.isAnonymous })
    setEditSurvey(s)
    setShowForm(false)
  }

  const filtered = useMemo(() => surveys.filter(s => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && s.type !== filterType) return false
    if (filterStatus === 'active' && !s.isActive) return false
    if (filterStatus === 'closed' && s.isActive) return false
    return true
  }), [surveys, search, filterType, filterStatus])

  function doExport() {
    exportCsv({
      filename: 'engagement-surveys',
      columns: [
        { header: 'Title',     key: 'title' },
        { header: 'Type',      key: 'type',      format: v => typeLabel(v as string | null) },
        { header: 'Status',    key: 'isActive',  format: v => v ? 'Active' : 'Closed' },
        { header: 'Anonymous', key: 'isAnonymous', format: v => v ? 'Yes' : 'No' },
        { header: 'Created',   key: 'createdAt', format: v => fmtCsvDate(v as string) },
      ],
      rows: filtered as unknown as Record<string, unknown>[],
    })
  }

  const surveyForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? saveSurveyEdit : createSurvey} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#4ebac4]">{isEdit ? 'Edit Survey' : 'New Survey'}</p>
        <button type="button" onClick={() => { setShowForm(false); setEditSurvey(null) }} className="text-xs text-gray-500 hover:text-gray-300">✕ Cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Survey Title *</label>
          <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={INPUT} />
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
            {SURVEY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer pt-5">
          <input type="checkbox" checked={form.isAnonymous} onChange={e => setForm(f => ({ ...f, isAnonymous: e.target.checked }))} className="accent-[#0E3D52] w-4 h-4" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Anonymous responses</span>
        </label>
      </div>
      <button type="submit" disabled={saving}
        className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg">
        {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Update Survey' : 'Create Survey')}
      </button>
    </form>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employee Voice &amp; Surveys</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Create surveys, collect responses, and track engagement</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={doExport} disabled={filtered.length === 0} />
          <button onClick={() => { setShowForm(v => !v); setEditSurvey(null) }}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
            {showForm ? 'Cancel' : '+ New Survey'}
          </button>
        </div>
      </div>

      {showForm && !editSurvey && surveyForm(false)}
      {editSurvey && surveyForm(true)}

      {/* Search + filters */}
      {surveys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search surveys…"
            className="input-premium flex-1 min-w-[160px] text-sm py-2" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-premium text-sm py-2 min-w-[160px]">
            <option value="">All types</option>
            {SURVEY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-premium text-sm py-2 min-w-[130px]">
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          {(search || filterType || filterStatus) && (
            <button onClick={() => { setSearch(''); setFilterType(''); setFilterStatus('') }}
              className="text-xs text-gray-500 hover:text-gray-300 px-2">Clear</button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-600 dark:text-gray-400 text-sm">Loading…</p>
      ) : surveys.length === 0 ? (
        <div className="card-premium">
          <EmptyState icon="📋" title="No surveys yet"
            message="Create your first survey to start collecting employee feedback."
            action={{ label: '+ New Survey', onClick: () => setShowForm(true) }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-premium">
          <EmptyState icon="🔍" title="No surveys match" message="Try adjusting your search or filters." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(s => (
            <div key={s.id} className={`card-premium p-5 ${selected?.id === s.id ? 'border-[#0E3D52]' : 'border-[#1A6080]/20'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-foreground font-medium">{s.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
                    {typeLabel(s.type)}{s.isAnonymous && ' · Anonymous'}
                    <span className="ml-2 text-gray-600 dark:text-gray-500">{new Date(s.createdAt).toLocaleDateString('en-AU')}</span>
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${s.isActive ? 'badge badge-green' : 'badge badge-gray'}`}>
                  {s.isActive ? 'Active' : 'Closed'}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap mt-3">
                <button onClick={() => { setSelected(s); loadResponses(s.id); setShowResp(false) }}
                  className="text-xs bg-[#0E3D52]/20 border border-[#1A6080] text-[#4ebac4] hover:bg-[#0E3D52]/40 px-3 py-1.5 rounded transition">
                  View Responses
                </button>
                {s.isActive && (
                  <button onClick={() => { setSelected(s); setShowResp(true) }}
                    className="text-xs bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-300 hover:border-[#0E3D52] px-3 py-1.5 rounded transition">
                    + Record Response
                  </button>
                )}
                <button onClick={() => toggleActive(s.id, !s.isActive)}
                  className="text-xs bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-400 hover:border-[#1A6080]/40 px-3 py-1.5 rounded transition">
                  {s.isActive ? 'Close' : 'Reopen'}
                </button>
                <button onClick={() => openEdit(s)}
                  className="text-xs bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 text-[#1A6080] dark:text-[#4ebac4] hover:border-[#0E3D52] px-3 py-1.5 rounded transition">
                  Edit
                </button>
                <button onClick={() => setConfirm({ message: `Delete survey "${s.title}"? This cannot be undone.`, danger: true, onConfirm: () => deleteSurvey(s.id) })}
                  className="text-xs bg-gray-100 dark:bg-[#0A1929] border border-gray-300 dark:border-[#1A6080]/30 text-red-400 hover:border-red-700 px-3 py-1.5 rounded transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record response form */}
      {showResp && selected && (
        <form onSubmit={submitResponse} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#4ebac4]">Record Response — {selected.title}</h3>
            <button type="button" onClick={() => setShowResp(false)} className="text-xs text-gray-500 hover:text-gray-300">✕ Cancel</button>
          </div>
          {!selected.isAnonymous && (
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee</label>
              <select value={respForm.employeeId} onChange={e => setRespForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Feedback / Response</label>
            <textarea required value={respForm.freeText} onChange={e => setRespForm(f => ({ ...f, freeText: e.target.value }))}
              rows={4} placeholder="Employee feedback…" className={INPUT} />
          </div>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg">
            {saving ? 'Saving…' : 'Submit Response'}
          </button>
        </form>
      )}

      {/* Responses panel */}
      {selected && responses.length > 0 && !showResp && (
        <div className="card-premium p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Responses — {selected.title} ({responses.length})</p>
            <ExportButton label="Export Responses" onClick={() => exportCsv({
              filename: `responses-${selected.title.replace(/\s+/g,'-').toLowerCase()}`,
              columns: [
                { header: 'Employee', key: 'employeeFirstName', format: (_v, r: Record<string,unknown>) => selected.isAnonymous ? 'Anonymous' : `${r.employeeFirstName} ${r.employeeLastName}` },
                { header: 'Feedback', key: 'answers', format: v => typeof v === 'object' && v && 'feedback' in v ? (v as {feedback:string}).feedback : JSON.stringify(v) },
                { header: 'Submitted', key: 'submittedAt', format: v => fmtCsvDate(v as string) },
              ],
              rows: responses as unknown as Record<string, unknown>[],
            })} />
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {responses.map(r => (
              <div key={r.id} className="bg-gray-100 dark:bg-[#0A1929]/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1 dark:text-gray-400">
                  {selected.isAnonymous ? 'Anonymous' : `${r.employeeFirstName} ${r.employeeLastName}`}
                  <span className="ml-2">{new Date(r.submittedAt).toLocaleDateString('en-AU')}</span>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {typeof r.answers === 'object' && r.answers !== null && 'feedback' in (r.answers as object)
                    ? (r.answers as {feedback: string}).feedback
                    : JSON.stringify(r.answers)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
