'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

// ── Types ──────────────────────────────────────────────────────────────────────

type Plan = {
  id: string
  departmentId: string | null
  positionId: string | null
  plannedCount: number
  currentCount: number
  vacancyCount: number
  targetDate: string | null
  status: string
  notes: string | null
  createdAt: string
  departmentName: string | null
  positionTitle: string | null
}

type PlanStats = {
  totalPlanned: number
  totalCurrent: number
  totalVacancies: number
  openRoles: number
}

type Department = { id: string; name: string }
type Position   = { id: string; title: string; departmentId: string | null }

type Employee = {
  id: string
  firstName: string
  lastName: string
  employmentType: string
  departmentId: string | null
  positionId: string | null
  startDate: string | null
  isActive: boolean
}

type DeptHeadcount = { id: string; name: string; count: number; positions: number }

type WorkforceSummary = {
  totalActive: number
  fullTime: number
  partTime: number
  casual: number
  contractor: number
  departments: number
  positions: number
}

type WorkforceData = {
  employees: Employee[]
  departments: Department[]
  positions: Position[]
  headcountByDepartment: DeptHeadcount[]
  summary: WorkforceSummary
}

// ── Constants ──────────────────────────────────────────────────────────────────

const INPUT = 'input-premium'

const EMP_TYPE_CONFIG: Record<string, { label: string; bg: string }> = {
  full_time:  { label: 'Full-time',  bg: 'bg-[#E0EEF4]0' },
  part_time:  { label: 'Part-time',  bg: 'bg-blue-500' },
  casual:     { label: 'Casual',     bg: 'bg-amber-500' },
  contractor: { label: 'Contractor', bg: 'bg-emerald-500' },
}

const PLAN_STATUS_STYLE: Record<string, string> = {
  open:    'badge badge-blue',
  filled:  'badge badge-green',
  on_hold: 'badge badge-amber',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="card-premium p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WorkforcePlanningPage() {
  const [tab, setTab] = useState<'overview' | 'plans'>('overview')

  // Workforce data
  const [wf,        setWf]        = useState<WorkforceData | null>(null)
  const [wfLoading, setWfLoading] = useState(true)

  // Plans data
  const [plans,        setPlans]        = useState<Plan[]>([])
  const [planStats,    setPlanStats]    = useState<PlanStats>({ totalPlanned: 0, totalCurrent: 0, totalVacancies: 0, openRoles: 0 })
  const [plansLoading, setPlansLoading] = useState(true)

  // Form state
  const [showForm,  setShowForm]  = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [form, setForm] = useState({
    departmentId: '', positionId: '', plannedCount: 1, currentCount: 0,
    vacancyCount: 0, targetDate: '', notes: '', status: 'open',
  })

  // Filters
  const [filterDept,   setFilterDept]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadWorkforce = useCallback(async () => {
    setWfLoading(true)
    const data = await fetchWithAuth('/api/tenant/workforce').then(r => r.json())
    setWf(data)
    setWfLoading(false)
  }, [])

  const loadPlans = useCallback(async () => {
    setPlansLoading(true)
    const data = await fetchWithAuth('/api/tenant/workforce-planning').then(r => r.json())
    setPlans(data.plans ?? [])
    setPlanStats(data.stats ?? { totalPlanned: 0, totalCurrent: 0, totalVacancies: 0, openRoles: 0 })
    setPlansLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadWorkforce(); loadPlans() }, [])

  // ── Form helpers ──────────────────────────────────────────────────────────────

  function openAdd() {
    setEditingId(null)
    setForm({ departmentId: '', positionId: '', plannedCount: 1, currentCount: 0, vacancyCount: 0, targetDate: '', notes: '', status: 'open' })
    setShowForm(true)
  }

  function openEdit(p: Plan) {
    setEditingId(p.id)
    setForm({
      departmentId: p.departmentId ?? '',
      positionId:   p.positionId   ?? '',
      plannedCount: p.plannedCount,
      currentCount: p.currentCount,
      vacancyCount: p.vacancyCount,
      targetDate:   p.targetDate   ?? '',
      notes:        p.notes        ?? '',
      status:       p.status,
    })
    setShowForm(true)
  }

  function cancelForm() { setShowForm(false); setEditingId(null) }

  // Positions filtered by selected dept
  const depts             = wf?.departments   ?? []
  const allPositions      = wf?.positions     ?? []
  const filteredPositions = form.departmentId
    ? allPositions.filter(p => p.departmentId === form.departmentId)
    : allPositions

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function savePlan(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const body = {
      ...form,
      departmentId: form.departmentId || null,
      positionId:   form.positionId   || null,
      targetDate:   form.targetDate   || null,
      notes:        form.notes        || null,
    }
    if (editingId) {
      await fetchWithAuth('/api/tenant/workforce-planning', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, ...body }),
      })
    } else {
      await fetchWithAuth('/api/tenant/workforce-planning', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    setSaving(false)
    cancelForm()
    loadPlans()
  }

  async function markFilled(id: string) {
    await fetchWithAuth('/api/tenant/workforce-planning', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'filled' }),
    })
    loadPlans()
  }

  async function deletePlan(id: string) {
    setConfirmState({
      message: 'Delete this headcount plan?',
      onConfirm: async () => {
        setDeleting(id)
        await fetchWithAuth('/api/tenant/workforce-planning', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        setDeleting(null)
        loadPlans()
      }
    })
  }

  // Filtered plans
  const visiblePlans = plans.filter(p => {
    if (filterDept   && p.departmentId !== filterDept) return false
    if (filterStatus && p.status       !== filterStatus) return false
    return true
  })

  // Employment type breakdown
  const summary    = wf?.summary
  const totalEmp   = summary?.totalActive ?? 0
  const empTypeRows = summary ? [
    { key: 'full_time',  count: summary.fullTime   },
    { key: 'part_time',  count: summary.partTime   },
    { key: 'casual',     count: summary.casual     },
    { key: 'contractor', count: summary.contractor },
  ] : []

  function exportPlansCsv() {
    exportCsv({
      filename: 'workforce-plans',
      columns: [
        { header: 'Position Title',     key: 'positionTitle',  format: v => (v as string) ?? 'General' },
        { header: 'Department',         key: 'departmentName', format: v => (v as string) ?? '' },
        { header: 'Headcount Target',   key: 'plannedCount' },
        { header: 'Current Count',      key: 'currentCount' },
        { header: 'Gap (Vacancies)',    key: 'vacancyCount' },
        { header: 'Status',             key: 'status' },
        { header: 'Target Date',        key: 'targetDate',     format: fmtCsvDate },
        { header: 'Notes',              key: 'notes',          format: v => (v as string) ?? '' },
      ],
      rows: visiblePlans,
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workforce Planning</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Headcount targets, live workforce snapshot, and position management
          </p>
        </div>
        {tab === 'plans' && (
          <div className="flex items-center gap-2">
            <ExportButton onClick={exportPlansCsv} disabled={visiblePlans.length === 0} />
            <button
              onClick={showForm ? cancelForm : openAdd}
              className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition"
            >
              {showForm ? 'Cancel' : '+ Add Plan'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 w-fit">
        {(['overview', 'plans'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {t === 'overview' ? 'Overview' : 'Headcount Plans'}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        wfLoading ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">Loading…</p>
        ) : !wf ? (
          <p className="text-red-400 text-sm">Failed to load workforce data.</p>
        ) : (
          <div className="space-y-6">

            {/* Summary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Active Employees" value={summary!.totalActive} color="text-foreground" />
              <StatCard label="Departments"      value={summary!.departments} color="text-blue-400" />
              <StatCard label="Active Positions" value={summary!.positions}   color="text-[#1A6080] dark:text-[#4ebac4]" />
              <StatCard label="Open Plans"       value={planStats.openRoles}  color="text-amber-400" />
            </div>

            {/* Employment type breakdown */}
            <div className="card-premium p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Employment Type Breakdown</h2>
              <div className="space-y-3">
                {empTypeRows.map(({ key, count }) => {
                  const cfg = EMP_TYPE_CONFIG[key]
                  const pct = totalEmp > 0 ? Math.round((count / totalEmp) * 100) : 0
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{cfg.label}</span>
                        <span className="text-gray-500 dark:text-gray-400">{count} · {pct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${cfg.bg} transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Headcount by department */}
            {wf.headcountByDepartment.length > 0 && (
              <div className="card-premium overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Headcount by Department</h2>
                </div>
                <div className="table-responsive">
            <table className="table-premium">
                  <thead>
                    <tr>
                      {['Department', 'Employees', 'Positions', 'Fill Rate'].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {wf.headcountByDepartment
                      .sort((a, b) => b.count - a.count)
                      .map(d => {
                        const fillRate = d.positions > 0 ? Math.round((d.count / d.positions) * 100) : null
                        return (
                          <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            <td className="px-5 py-3 text-gray-700 dark:text-gray-200 font-medium">{d.name}</td>
                            <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{d.count}</td>
                            <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{d.positions}</td>
                            <td className="px-5 py-3">
                              {fillRate === null ? (
                                <span className="text-gray-400 text-xs">—</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${fillRate >= 100 ? 'bg-green-500' : fillRate >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                      style={{ width: `${Math.min(fillRate, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{fillRate}%</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
          </div>
              </div>
            )}

            {/* Recent hires */}
            {(() => {
              const deptMap = Object.fromEntries(wf.departments.map(d => [d.id, d.name]))
              const posMap  = Object.fromEntries(wf.positions.map(p => [p.id, p.title]))
              const recent  = [...wf.employees]
                .filter(e => e.startDate)
                .sort((a, b) => (b.startDate! > a.startDate! ? 1 : -1))
                .slice(0, 5)
              if (recent.length === 0) return null
              return (
                <div className="card-premium overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Hires</h2>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {recent.map(e => {
                      const cfg = EMP_TYPE_CONFIG[e.employmentType]
                      return (
                        <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="w-8 h-8 rounded-full bg-[#0E3D52] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {e.firstName[0]}{e.lastName[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 dark:text-gray-200 font-medium truncate">
                              {e.firstName} {e.lastName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {e.positionId ? posMap[e.positionId] : '—'}
                              {e.departmentId ? ` · ${deptMap[e.departmentId]}` : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-500 dark:text-gray-400">{fmt(e.startDate)}</p>
                            {cfg && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} text-white`}>
                                {cfg.label}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )
      )}

      {/* ── PLANS TAB ────────────────────────────────────────────────────────── */}
      {tab === 'plans' && (
        <div className="space-y-5">

          {/* Plan stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Planned Headcount" value={planStats.totalPlanned}   color="text-foreground" />
            <StatCard label="Current Headcount" value={planStats.totalCurrent}   color="text-green-400" />
            <StatCard label="Total Vacancies"   value={planStats.totalVacancies} color="text-amber-400" />
            <StatCard label="Open Roles"        value={planStats.openRoles}      color="text-blue-400" />
          </div>

          {/* Add / Edit form */}
          {showForm && (
            <form onSubmit={savePlan} className="card-premium border-[#0E3D52]/30 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#4ebac4]">
                {editingId ? 'Edit Headcount Plan' : 'Add Headcount Plan'}
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Department</label>
                  <select
                    value={form.departmentId}
                    onChange={e => setForm(f => ({ ...f, departmentId: e.target.value, positionId: '' }))}
                    className={INPUT}
                  >
                    <option value="">All departments</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Position</label>
                  <select
                    value={form.positionId}
                    onChange={e => setForm(f => ({ ...f, positionId: e.target.value }))}
                    className={INPUT}
                  >
                    <option value="">General / unspecified</option>
                    {filteredPositions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Planned Count *</label>
                  <input
                    required type="number" min={1}
                    value={form.plannedCount}
                    onChange={e => setForm(f => ({ ...f, plannedCount: Number(e.target.value) }))}
                    className={INPUT}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Current Count</label>
                  <input
                    type="number" min={0}
                    value={form.currentCount}
                    onChange={e => setForm(f => ({ ...f, currentCount: Number(e.target.value) }))}
                    className={INPUT}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Vacancies</label>
                  <input
                    type="number" min={0}
                    value={form.vacancyCount}
                    onChange={e => setForm(f => ({ ...f, vacancyCount: Number(e.target.value) }))}
                    className={INPUT}
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Target Date</label>
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                    className={INPUT}
                  />
                </div>

                {editingId && (
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Status</label>
                    <select
                      value={form.status}
                      onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                      className={INPUT}
                    >
                      <option value="open">Open</option>
                      <option value="filled">Filled</option>
                      <option value="on_hold">On Hold</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Context, hiring timeline, priorities…"
                  className={INPUT}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition"
                >
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Plan'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="input-premium"
            >
              <option value="">All departments</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="input-premium"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="filled">Filled</option>
              <option value="on_hold">On Hold</option>
            </select>
            {(filterDept || filterStatus) && (
              <button
                onClick={() => { setFilterDept(''); setFilterStatus('') }}
                className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] px-2"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Plans table */}
          {plansLoading ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">Loading…</p>
          ) : visiblePlans.length === 0 ? (
            <div className="card-premium py-14 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                {plans.length === 0 ? 'No headcount plans yet' : 'No plans match the filters'}
              </p>
              {plans.length === 0 && (
                <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">
                  Click "+ Add Plan" to create your first headcount plan.
                </p>
              )}
            </div>
          ) : (
            <div className="card-premium overflow-hidden">
              <div className="table-responsive">
            <table className="table-premium">
                <thead>
                  <tr>
                    {['Role / Department', 'Planned', 'Current', 'Vacancies', 'Fill', 'Target Date', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {visiblePlans.map(p => {
                    const fillPct   = p.plannedCount > 0 ? Math.round((p.currentCount / p.plannedCount) * 100) : 0
                    const isDeleting = deleting === p.id
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3">
                          <p className="text-gray-700 dark:text-gray-200 font-medium">
                            {p.positionTitle ?? 'General'}
                          </p>
                          {p.departmentName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{p.departmentName}</p>
                          )}
                          {p.notes && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{p.notes}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{p.plannedCount}</td>
                        <td className="px-4 py-3 text-green-400 font-medium">{p.currentCount}</td>
                        <td className="px-4 py-3">
                          <span className={p.vacancyCount > 0 ? 'text-amber-400 font-medium' : 'text-gray-500'}>
                            {p.vacancyCount}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-14 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${fillPct >= 100 ? 'bg-green-500' : fillPct >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min(fillPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{fillPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {p.targetDate ? fmt(p.targetDate) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PLAN_STATUS_STYLE[p.status] ?? 'badge badge-gray'}`}>
                            {p.status === 'on_hold' ? 'On Hold' : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {p.status === 'open' && (
                              <button
                                onClick={() => markFilled(p.id)}
                                className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-green-700 hover:text-green-400 px-2 py-1 rounded transition"
                              >
                                Mark Filled
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(p)}
                              className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] px-2 py-1 rounded transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deletePlan(p.id)}
                              disabled={isDeleting}
                              className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-red-700 hover:text-red-400 px-2 py-1 rounded transition disabled:opacity-50"
                            >
                              {isDeleting ? '…' : 'Delete'}
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
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
