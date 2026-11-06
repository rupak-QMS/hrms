'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

type Review = {
  id: string; employeeId: string; reviewerId: string | null; type: string; status: string
  scheduledDate: string | null; completedAt: string | null; overallRating: string | null
  kpis: { id: string; area: string; rating: number | null; notes: string }[]
  developmentPlan: string | null; outcome: string | null; employeeInput: any; managerInput: any
  createdAt: string
  employeeFirstName: string | null; employeeLastName: string | null
  employeeEmail: string | null; employeeStartDate: string | null; probationEndDate: string | null
}
type Stats = { total: number; scheduled: number; completed: number; overdue: number; probation: number }
type Employee = { id: string; firstName: string; lastName: string }
type Goal = {
  id: string; employeeId: string; reviewId: string | null
  title: string; description: string | null; category: string | null
  targetDate: string | null; status: string; progress: number
  selfRating: number | null; managerRating: number | null; managerNote: string | null
  createdAt: string; updatedAt: string
}

const REVIEW_TYPES = [
  { value: 'probation_4wk',   label: '4-Week Probation Check' },
  { value: 'mid_probation',   label: 'Mid-Probation Review' },
  { value: 'end_probation',   label: 'End-of-Probation Review' },
  { value: 'annual',          label: 'Annual Performance Review' },
  { value: 'kpi',             label: 'KPI Review' },
  { value: 'pip',             label: 'Performance Improvement Plan' },
]

const OUTCOMES = [
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'extended',   label: '⏳ Extended Probation' },
  { value: 'pip',        label: 'PIP Issued' },
  { value: 'terminated', label: 'Terminated' },
]

const GOAL_STATUSES = [
  { value: 'active',      label: 'Active',      color: 'text-[#4ebac4] border-[#1A6080]/60 bg-[#0E3D52]/30' },
  { value: 'completed',   label: 'Completed',   color: 'text-green-400 border-green-800 bg-green-900/30' },
  { value: 'on_hold',     label: 'On Hold',     color: 'text-amber-400 border-amber-800 bg-amber-900/30' },
  { value: 'cancelled',   label: 'Cancelled',   color: 'text-gray-400 border-gray-700 bg-gray-800/30' },
]

const GOAL_CATEGORIES = ['Communication', 'Leadership', 'Technical Skills', 'Teamwork', 'Customer Service', 'Process Improvement', 'Professional Development', 'Other']

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'badge badge-blue',
  completed: 'badge badge-green',
  overdue:   'badge badge-red',
}

const RATING_LABELS = ['', 'Unsatisfactory', 'Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding']

const INPUT = 'input-premium'

const BLANK_GOAL = { employeeId: '', reviewId: '', title: '', description: '', category: '', targetDate: '', status: 'active', progress: 0 }

function RatingButtons({ value, onChange, color = 'bg-[#0E3D52]' }: { value: number | null; onChange: (n: number) => void; color?: string }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`flex-1 py-1.5 rounded text-xs font-medium transition ${value === n ? `${color} text-white` : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
          {n}
        </button>
      ))}
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-[#E0EEF4]0' : value >= 25 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{value}%</span>
    </div>
  )
}

export default function PerformancePage() {
  const [tab, setTab] = useState<'reviews' | 'goals'>('reviews')

  // ─── Reviews state ───────────────────────────────────────────────────────
  const [reviews,   setReviews]   = useState<Review[]>([])
  const [stats,     setStats]     = useState<Stats>({ total:0, scheduled:0, completed:0, overdue:0, probation:0 })
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [form, setForm] = useState({ employeeId:'', type:'end_probation', scheduledDate:'' })
  const [editing, setEditing] = useState<{ id: string; kpis: Review['kpis']; rating: string; plan: string; outcome: string } | null>(null)
  const [selfAssessModal, setSelfAssessModal] = useState<{ id: string; employeeInput: any } | null>(null)
  const [selfAssessForm, setSelfAssessForm]   = useState({ strengths: '', improvements: '', goals: '', comments: '' })
  const [selfSaving, setSelfSaving] = useState(false)

  // ─── Goals state ─────────────────────────────────────────────────────────
  const [goals,       setGoals]       = useState<Goal[]>([])
  const [goalsLoading, setGoalsLoading] = useState(false)
  const [goalForm,    setGoalForm]    = useState(BLANK_GOAL)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [editingGoal,  setEditingGoal]  = useState<Goal | null>(null)
  const [goalSaving,   setGoalSaving]   = useState(false)
  const [filterGoalStatus, setFilterGoalStatus] = useState('')
  const [filterGoalEmp,    setFilterGoalEmp]    = useState('')

  // ─── Shared ───────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const load = useCallback(async (s = search, st = filterStatus, t = filterType) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (s)  p.set('search', s)
    if (st) p.set('status', st)
    if (t)  p.set('type', t)
    const res  = await fetchWithAuth(`/api/tenant/performance?${p}`)
    const data = await res.json()
    setReviews(data.records ?? [])
    setStats(data.stats ?? { total:0,scheduled:0,completed:0,overdue:0,probation:0 })
    setLoading(false)
  }, [search, filterStatus, filterType])

  const loadGoals = useCallback(async (empId = filterGoalEmp, st = filterGoalStatus) => {
    setGoalsLoading(true)
    const p = new URLSearchParams()
    if (empId) p.set('employeeId', empId)
    const res  = await fetchWithAuth(`/api/tenant/performance-goals?${p}`)
    const data = await res.json()
    let g: Goal[] = data.goals ?? []
    if (st) g = g.filter(x => x.status === st)
    setGoals(g)
    setGoalsLoading(false)
  }, [filterGoalEmp, filterGoalStatus])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=200').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  useEffect(() => { if (tab === 'goals') loadGoals() }, [tab])

  // ─── Review functions ─────────────────────────────────────────────────────
  async function createReview(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/performance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ employeeId:'', type:'end_probation', scheduledDate:'' })
    setSaving(false)
    load()
  }

  async function completeReview() {
    if (!editing) return
    setSaving(true)
    const avgRating = editing.kpis.filter(k => k.rating).length
      ? editing.kpis.reduce((s, k) => s + (k.rating ?? 0), 0) / editing.kpis.filter(k => k.rating).length
      : null
    await fetchWithAuth('/api/tenant/performance', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editing.id, status: 'completed', kpis: editing.kpis,
        overallRating: editing.rating || avgRating,
        developmentPlan: editing.plan, outcome: editing.outcome,
      }),
    })
    setEditing(null)
    setSaving(false)
    load()
  }

  function openSelfAssess(r: Review) {
    const ei = r.employeeInput ?? {}
    setSelfAssessForm({
      strengths:    ei.strengths    ?? '',
      improvements: ei.improvements ?? '',
      goals:        ei.goals        ?? '',
      comments:     ei.comments     ?? '',
    })
    setSelfAssessModal({ id: r.id, employeeInput: r.employeeInput })
  }

  async function saveSelfAssess() {
    if (!selfAssessModal) return
    setSelfSaving(true)
    await fetchWithAuth('/api/tenant/performance', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selfAssessModal.id, employeeInput: selfAssessForm }),
    })
    setSelfAssessModal(null)
    setSelfSaving(false)
    load()
  }

  // ─── Goal functions ───────────────────────────────────────────────────────
  async function createGoal(e: React.FormEvent) {
    e.preventDefault()
    setGoalSaving(true)
    await fetchWithAuth('/api/tenant/performance-goals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...goalForm,
        reviewId:    goalForm.reviewId    || null,
        description: goalForm.description || null,
        category:    goalForm.category    || null,
        targetDate:  goalForm.targetDate  || null,
      }),
    })
    setGoalForm(BLANK_GOAL)
    setShowGoalForm(false)
    setGoalSaving(false)
    loadGoals()
  }

  async function saveGoalEdit() {
    if (!editingGoal) return
    setGoalSaving(true)
    await fetchWithAuth('/api/tenant/performance-goals', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:            editingGoal.id,
        title:         editingGoal.title,
        description:   editingGoal.description,
        category:      editingGoal.category,
        targetDate:    editingGoal.targetDate,
        status:        editingGoal.status,
        progress:      editingGoal.progress,
        selfRating:    editingGoal.selfRating,
        managerRating: editingGoal.managerRating,
        managerNote:   editingGoal.managerNote,
      }),
    })
    setEditingGoal(null)
    setGoalSaving(false)
    loadGoals()
  }

  async function deleteGoal(id: string) {
    setConfirmState({
      message: 'Delete this goal?',
      onConfirm: async () => {
        await fetchWithAuth(`/api/tenant/performance-goals?id=${id}`, { method: 'DELETE' })
        loadGoals()
      }
    })
  }

  function deleteReview(id: string) {
    setConfirmState({
      message: 'Delete this performance review? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        const r = await fetchWithAuth(`/api/tenant/performance/${id}`, { method: 'DELETE' })
        if (r.ok) {
          setReviews(prev => prev.filter(rv => rv.id !== id))
          setToast({ message: 'Review deleted', type: 'success' })
        } else {
          const d = await r.json()
          setToast({ message: d.error ?? 'Failed to delete review', type: 'error' })
        }
        setConfirmState(null)
      },
    })
  }

  const empName = (id: string) => {
    const e = employees.find(x => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }

  const goalStatusStyle = (s: string) => GOAL_STATUSES.find(x => x.value === s)?.color ?? 'text-gray-400 border-gray-700 bg-gray-800/30'

  function exportReviews() {
    exportCsv({
      filename: 'performance-reviews',
      columns: [
        { header: 'Employee Name', key: 'employeeFirstName', format: (_, r) => `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim() },
        { header: 'Review Type', key: 'type', format: v => REVIEW_TYPES.find(t => t.value === v)?.label ?? v },
        { header: 'Status', key: 'status' },
        { header: 'Scheduled Date', key: 'scheduledDate', format: v => fmtCsvDate(v) },
        { header: 'Completed Date', key: 'completedAt', format: v => fmtCsvDate(v) },
        { header: 'Overall Rating', key: 'overallRating', format: v => v ?? '' },
        { header: 'Outcome', key: 'outcome', format: v => v ?? '' },
      ],
      rows: reviews,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance Management</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Probation check-ins, KPI reviews and performance plans</p>
        </div>
        {tab === 'reviews' ? (
          <div className="flex items-center gap-2">
          <ExportButton onClick={exportReviews} disabled={reviews.length === 0} />
          <button onClick={() => setShowForm(v => !v)}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            {showForm ? 'Cancel' : '+ Schedule Review'}
          </button>
          </div>
        ) : (
          <button onClick={() => setShowGoalForm(v => !v)}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            {showGoalForm ? 'Cancel' : '+ Add Goal'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total',      value: stats.total,     color: 'text-foreground' },
          { label: 'Scheduled',  value: stats.scheduled, color: 'text-[#4ebac4]' },
          { label: 'Completed',  value: stats.completed, color: 'text-green-400' },
          { label: 'Overdue',    value: stats.overdue,   color: 'text-red-400' },
          { label: 'Probation',  value: stats.probation, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 w-fit">
        {(['reviews', 'goals'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition capitalize ${
              tab === t ? 'bg-white dark:bg-gray-900 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-300'
            }`}>
            {t === 'reviews' ? 'Reviews' : 'Goals'}
          </button>
        ))}
      </div>

      {/* ─── REVIEWS TAB ─────────────────────────────────────────────────── */}
      {tab === 'reviews' && (
        <>
          {/* Create form */}
          {showForm && (
            <form onSubmit={createReview} className="card-premium border-[#0E3D52]/30 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#4ebac4]">Schedule Review</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
                  <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                    <option value="">— Select —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Review Type *</label>
                  <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={INPUT}>
                    {REVIEW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Scheduled Date</label>
                  <input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
                {saving ? 'Scheduling…' : 'Schedule Review'}
              </button>
            </form>
          )}

          {/* Complete review modal */}
          {editing && (
            <div className="modal-overlay overflow-y-auto">
              <div className="card-premium p-6 w-full max-w-2xl space-y-5 my-4">
                <h3 className="text-lg font-bold text-foreground">Complete Review</h3>
                <div className="space-y-3">
                  <p className="section-label">KPI Ratings (1–5)</p>
                  {editing.kpis.map((kpi, i) => (
                    <div key={kpi.id} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium text-foreground">{kpi.area}</p>
                      <RatingButtons value={kpi.rating} onChange={n => {
                        const k = [...editing.kpis]; k[i] = { ...k[i], rating: n }; setEditing({ ...editing, kpis: k })
                      }} />
                      {kpi.rating && <p className="text-xs text-[#1A6080] dark:text-[#4ebac4]">{RATING_LABELS[kpi.rating]}</p>}
                      <input value={kpi.notes}
                        onChange={e => { const k = [...editing.kpis]; k[i] = { ...k[i], notes: e.target.value }; setEditing({ ...editing, kpis: k }) }}
                        placeholder="Notes for this area…"
                        className="w-full bg-gray-200 dark:bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Overall Rating (override, 1–5)</label>
                  <input type="number" min="1" max="5" step="0.1" value={editing.rating}
                    onChange={e => setEditing({ ...editing, rating: e.target.value })}
                    placeholder="Leave blank to auto-average KPIs"
                    className="w-32 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-[#1A6080]/30 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Outcome</label>
                  <div className="flex gap-2 flex-wrap">
                    {OUTCOMES.map(o => (
                      <button key={o.value} type="button" onClick={() => setEditing({ ...editing, outcome: o.value })}
                        className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                          editing.outcome === o.value ? 'border-[#0E3D52] bg-[#0E3D52]/30 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Development Plan / Notes</label>
                  <textarea value={editing.plan} onChange={e => setEditing({ ...editing, plan: e.target.value })}
                    rows={3} placeholder="Goals, actions, training requirements…" className={INPUT} />
                </div>
                <div className="flex gap-2">
                  <button onClick={completeReview} disabled={saving}
                    className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white text-sm py-2 rounded-lg transition font-medium">
                    {saving ? 'Saving…' : 'Mark Complete'}
                  </button>
                  <button onClick={() => setEditing(null)}
                    className="px-5 border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-300 hover:text-white text-sm rounded-lg transition">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Self-assessment modal */}
          {selfAssessModal && (
            <div className="modal-overlay overflow-y-auto">
              <div className="card-premium p-6 w-full max-w-xl space-y-4 my-4">
                <h3 className="text-lg font-bold text-foreground">Employee Self-Assessment</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">This input is shared with the reviewer ahead of the performance review.</p>
                {[
                  { key: 'strengths',    label: 'Key Strengths',           placeholder: 'What are you most proud of this period?' },
                  { key: 'improvements', label: 'Areas for Improvement',   placeholder: 'Where would you like to grow or develop?' },
                  { key: 'goals',        label: 'Goals for Next Period',    placeholder: 'What do you want to focus on going forward?' },
                  { key: 'comments',     label: 'Additional Comments',     placeholder: 'Any other feedback for your manager…' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">{label}</label>
                    <textarea
                      value={(selfAssessForm as any)[key]}
                      onChange={e => setSelfAssessForm(f => ({ ...f, [key]: e.target.value }))}
                      rows={3} placeholder={placeholder} className={INPUT} />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={saveSelfAssess} disabled={selfSaving}
                    className="flex-1 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm py-2 rounded-lg transition font-medium">
                    {selfSaving ? 'Saving…' : 'Save Self-Assessment'}
                  </button>
                  <button onClick={() => setSelfAssessModal(null)}
                    className="px-5 border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-300 hover:text-white text-sm rounded-lg transition">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <input value={search} onChange={e => { setSearch(e.target.value); load(e.target.value, filterStatus, filterType) }}
              placeholder="Search employee…"
              className="flex-1 min-w-48 input-premium placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]" />
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(search, e.target.value, filterType) }}
              className="input-premium focus:outline-none focus:border-[#0E3D52]">
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
            <select value={filterType} onChange={e => { setFilterType(e.target.value); load(search, filterStatus, e.target.value) }}
              className="input-premium focus:outline-none focus:border-[#0E3D52]">
              <option value="">All types</option>
              {REVIEW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Table */}
          {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : reviews.length === 0 ? (
            <EmptyState
              icon="📊"
              title="No performance reviews"
              message="Performance reviews will appear here."
              action={{ label: 'Schedule Review', onClick: () => setShowForm(true) }}
            />
          ) : (
            <div className="card-premium overflow-hidden">
              <div className="table-responsive">
            <table className="table-premium">
                <thead>
                  <tr>
                    {['Employee','Type','Status','Scheduled','Rating','Outcome','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold  text-gray-600 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviews.map(r => {
                    const ei = r.employeeInput
                    const hasSelfAssess = ei && (ei.strengths || ei.improvements || ei.goals || ei.comments)
                    return (
                      <>
                        <tr key={r.id} className="border-b border-gray-200 dark:border-[#1A6080]/20/50 last:border-0 hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30/20 transition">
                          <td className="px-4 py-3.5">
                            <p className="text-foreground font-medium">{r.employeeFirstName} {r.employeeLastName}</p>
                            <p className="text-gray-500 text-xs dark:text-gray-400">{r.employeeEmail}</p>
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300 text-sm">
                            {REVIEW_TYPES.find(t => t.value === r.type)?.label ?? r.type}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>
                              {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 dark:text-gray-400 text-xs">
                            {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            {r.overallRating ? (
                              <div className="flex items-center gap-2">
                                <span className="text-foreground font-semibold">{Number(r.overallRating).toFixed(1)}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">/5</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            {r.outcome ? <span className="text-xs text-gray-600 dark:text-gray-300">{OUTCOMES.find(o => o.value === r.outcome)?.label ?? r.outcome}</span> : '—'}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex gap-2 flex-wrap">
                              {r.status !== 'completed' && (
                                <button onClick={() => setEditing({ id: r.id, kpis: r.kpis ?? [], rating: '', plan: r.developmentPlan ?? '', outcome: r.outcome ?? '' })}
                                  className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] border border-[#0E3D52] px-2.5 py-1 rounded-lg transition font-medium">
                                  Complete →
                                </button>
                              )}
                              <button onClick={() => { setExpanded(expanded === r.id ? null : r.id) }}
                                className={`text-xs border px-2.5 py-1 rounded-lg transition ${expanded === r.id ? 'border-amber-700 text-amber-400' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                                {expanded === r.id ? 'Hide' : 'Details'}
                              </button>
                              <button onClick={() => openSelfAssess(r)}
                                className={`text-xs border px-2.5 py-1 rounded-lg transition ${hasSelfAssess ? 'border-green-700 text-green-400' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                                title={hasSelfAssess ? 'Self-assessment submitted' : 'Add self-assessment'}>
                                {hasSelfAssess ? '✓ Self-assess' : 'Self-assess'}
                              </button>
                              {r.status !== 'completed' && (
                                <button onClick={() => deleteReview(r.id)} title="Delete review"
                                  className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-900/20 transition">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {expanded === r.id && (
                          <tr key={`${r.id}-detail`} className="border-b border-gray-200 dark:border-[#1A6080]/20/50">
                            <td colSpan={7} className="px-4 pb-4 pt-0">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                {/* KPI breakdown */}
                                {r.kpis?.length > 0 && (
                                  <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-3 space-y-2">
                                    <p className="text-xs font-semibold text-gray-500 ">KPI Ratings</p>
                                    {r.kpis.map(kpi => (
                                      <div key={kpi.id} className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-gray-400 flex-1">{kpi.area}</span>
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${kpi.rating ? 'text-[#4ebac4] bg-[#0E3D52]/30' : 'text-gray-500'}`}>
                                          {kpi.rating ? `${kpi.rating}/5` : '—'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Development plan + self-assessment */}
                                <div className="space-y-3">
                                  {r.developmentPlan && (
                                    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-3">
                                      <p className="text-xs font-semibold text-gray-500  mb-1">Development Plan</p>
                                      <p className="text-xs text-gray-400">{r.developmentPlan}</p>
                                    </div>
                                  )}
                                  {r.employeeInput && (r.employeeInput.strengths || r.employeeInput.improvements) && (
                                    <div className="bg-[#E0EEF4] dark:bg-[#0E3D52]/20 border border-[#1A6080]/30 dark:border-[#1A6080]/20 rounded-lg p-3 space-y-2">
                                      <p className="text-xs font-semibold text-[#4ebac4] ">Employee Self-Assessment</p>
                                      {r.employeeInput.strengths    && <div><p className="text-xs text-gray-500">Strengths</p><p className="text-xs text-gray-300">{r.employeeInput.strengths}</p></div>}
                                      {r.employeeInput.improvements && <div><p className="text-xs text-gray-500">Improvements</p><p className="text-xs text-gray-300">{r.employeeInput.improvements}</p></div>}
                                      {r.employeeInput.goals        && <div><p className="text-xs text-gray-500">Goals</p><p className="text-xs text-gray-300">{r.employeeInput.goals}</p></div>}
                                      {r.employeeInput.comments     && <div><p className="text-xs text-gray-500">Comments</p><p className="text-xs text-gray-300">{r.employeeInput.comments}</p></div>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
          </div>
            </div>
          )}
        </>
      )}

      {/* ─── GOALS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'goals' && (
        <>
          {/* Add goal form */}
          {showGoalForm && (
            <form onSubmit={createGoal} className="card-premium border-[#0E3D52]/30 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#4ebac4]">New Performance Goal</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
                  <select required value={goalForm.employeeId} onChange={e => setGoalForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                    <option value="">— Select —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Title *</label>
                  <input required value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Complete advanced Excel training" className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Category</label>
                  <select value={goalForm.category} onChange={e => setGoalForm(f => ({ ...f, category: e.target.value }))} className={INPUT}>
                    <option value="">— Select —</option>
                    {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Target Date</label>
                  <input type="date" value={goalForm.targetDate} onChange={e => setGoalForm(f => ({ ...f, targetDate: e.target.value }))} className={INPUT} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Description</label>
                  <textarea rows={2} value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} placeholder="Goal details and success criteria…" className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Linked Review (optional)</label>
                  <select value={goalForm.reviewId} onChange={e => setGoalForm(f => ({ ...f, reviewId: e.target.value }))} className={INPUT}>
                    <option value="">— None —</option>
                    {reviews.map(r => <option key={r.id} value={r.id}>{r.employeeFirstName} {r.employeeLastName} — {REVIEW_TYPES.find(t => t.value === r.type)?.label ?? r.type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Initial Progress: {goalForm.progress}%</label>
                  <input type="range" min={0} max={100} step={5} value={goalForm.progress}
                    onChange={e => setGoalForm(f => ({ ...f, progress: Number(e.target.value) }))}
                    className="w-full accent-[#0E3D52]" />
                </div>
              </div>
              <button type="submit" disabled={goalSaving}
                className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
                {goalSaving ? 'Saving…' : 'Create Goal'}
              </button>
            </form>
          )}

          {/* Edit goal modal */}
          {editingGoal && (
            <div className="modal-overlay overflow-y-auto">
              <div className="card-premium p-6 w-full max-w-lg space-y-4 my-4">
                <h3 className="text-lg font-bold text-foreground">Edit Goal</h3>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Title</label>
                  <input value={editingGoal.title} onChange={e => setEditingGoal({ ...editingGoal, title: e.target.value })} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Description</label>
                  <textarea rows={2} value={editingGoal.description ?? ''} onChange={e => setEditingGoal({ ...editingGoal, description: e.target.value })} className={INPUT} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Category</label>
                    <select value={editingGoal.category ?? ''} onChange={e => setEditingGoal({ ...editingGoal, category: e.target.value })} className={INPUT}>
                      <option value="">— Select —</option>
                      {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Target Date</label>
                    <input type="date" value={editingGoal.targetDate ?? ''} onChange={e => setEditingGoal({ ...editingGoal, targetDate: e.target.value })} className={INPUT} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {GOAL_STATUSES.map(s => (
                      <button key={s.value} type="button" onClick={() => setEditingGoal({ ...editingGoal, status: s.value })}
                        className={`text-sm px-3 py-1.5 rounded-lg border transition ${editingGoal.status === s.value ? s.color : 'border-gray-700 text-gray-400 hover:border-gray-600'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Progress: {editingGoal.progress}%</label>
                  <input type="range" min={0} max={100} step={5} value={editingGoal.progress}
                    onChange={e => setEditingGoal({ ...editingGoal, progress: Number(e.target.value) })}
                    className="w-full accent-[#0E3D52]" />
                  <ProgressBar value={editingGoal.progress} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Self Rating (1–5)</label>
                  <RatingButtons value={editingGoal.selfRating} onChange={n => setEditingGoal({ ...editingGoal, selfRating: n })} />
                  {editingGoal.selfRating && <p className="text-xs text-[#4ebac4] mt-1">{RATING_LABELS[editingGoal.selfRating]}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Manager Rating (1–5)</label>
                  <RatingButtons value={editingGoal.managerRating} onChange={n => setEditingGoal({ ...editingGoal, managerRating: n })} color="bg-green-600" />
                  {editingGoal.managerRating && <p className="text-xs text-green-400 mt-1">{RATING_LABELS[editingGoal.managerRating]}</p>}
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Manager Note</label>
                  <textarea rows={2} value={editingGoal.managerNote ?? ''} onChange={e => setEditingGoal({ ...editingGoal, managerNote: e.target.value })}
                    placeholder="Feedback from manager…" className={INPUT} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveGoalEdit} disabled={goalSaving}
                    className="flex-1 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm py-2 rounded-lg transition font-medium">
                    {goalSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditingGoal(null)}
                    className="px-5 border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-300 hover:text-white text-sm rounded-lg transition">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Goals filters */}
          <div className="flex gap-3 flex-wrap">
            <select value={filterGoalEmp} onChange={e => { setFilterGoalEmp(e.target.value); loadGoals(e.target.value, filterGoalStatus) }}
              className="input-premium focus:outline-none focus:border-[#0E3D52]">
              <option value="">All employees</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
            <select value={filterGoalStatus} onChange={e => { setFilterGoalStatus(e.target.value); loadGoals(filterGoalEmp, e.target.value) }}
              className="input-premium focus:outline-none focus:border-[#0E3D52]">
              <option value="">All statuses</option>
              {GOAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={() => loadGoals()} className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg transition">Refresh</button>
          </div>

          {/* Goals list */}
          {goalsLoading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : goals.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No goals found"
              message="Create a goal for an employee to get started."
              action={{ label: 'Add Goal', onClick: () => setShowGoalForm(true) }}
            />
          ) : (
            <div className="space-y-3">
              {goals.map(g => (
                <div key={g.id} className="card-premium p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{g.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${goalStatusStyle(g.status)}`}>
                          {GOAL_STATUSES.find(s => s.value === g.status)?.label ?? g.status}
                        </span>
                        {g.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-gray-700 text-gray-400">{g.category}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{empName(g.employeeId)}</p>
                      {g.description && <p className="text-xs text-gray-400 mt-1">{g.description}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setEditingGoal(g)}
                        className="text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-2.5 py-1 rounded-lg transition">
                        Edit
                      </button>
                      <button onClick={() => deleteGoal(g.id)}
                        className="text-xs border border-red-900 text-red-400 hover:bg-red-900/20 px-2.5 py-1 rounded-lg transition">
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <ProgressBar value={g.progress} />

                  {/* Ratings + target date */}
                  <div className="flex items-center gap-4 flex-wrap text-xs">
                    {g.targetDate && (
                      <span className="text-gray-500 dark:text-gray-400">
                        Target: {new Date(g.targetDate + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {g.selfRating != null && (
                      <span className="text-[#4ebac4]">Self: {g.selfRating}/5 · {RATING_LABELS[g.selfRating]}</span>
                    )}
                    {g.managerRating != null && (
                      <span className="text-green-400">Manager: {g.managerRating}/5 · {RATING_LABELS[g.managerRating]}</span>
                    )}
                    {g.managerNote && (
                      <span className="text-gray-400 italic">"{g.managerNote}"</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
