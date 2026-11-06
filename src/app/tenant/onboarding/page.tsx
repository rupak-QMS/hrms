'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'

type OnboardingRecord = {
  id: string
  employeeId: string
  stage: string
  status: string
  completedAt: string | null
  buddyId: string | null
  checklist: { id: string; task: string; done: boolean; category: string }[]
  notes: string | null
  createdAt: string
  updatedAt: string
  employeeFirstName: string | null
  employeeLastName:  string | null
  employeeEmail:     string | null
  employeePositionId: string | null
  employeeStartDate: string | null
  employeeIsActive:  boolean | null
}

type Stats = { total: number; pending: number; in_progress: number; completed: number }

const STAGES = [
  { value: 'pre_start',     label: 'Pre-start',        color: 'bg-gray-500' },
  { value: 'day1',          label: 'Day 1',             color: 'bg-[#E0EEF4]0' },
  { value: 'week1',         label: 'Week 1',            color: 'bg-[#E0EEF4]0' },
  { value: 'weeks2_4',      label: 'Weeks 2–4',         color: 'bg-[#f0f7fb]0' },
  { value: 'end_probation', label: 'End of Probation',  color: 'bg-amber-500' },
  { value: 'fully_active',  label: 'Fully Active',      color: 'bg-green-500' },
]

const STAGE_LABELS: Record<string, string> = Object.fromEntries(STAGES.map(s => [s.value, s.label]))
const STAGE_ORDER = STAGES.map(s => s.value)

const STATUS_STYLE: Record<string, string> = {
  pending:     'badge badge-amber',
  in_progress: 'badge badge-blue',
  completed:   'badge badge-green',
}

const CATEGORY_COLOR: Record<string, string> = {
  admin:      'bg-gray-700 text-gray-300',
  it:         'bg-blue-900/60 text-[#7dcfd7]',
  hr:         'bg-[#0E3D52]/60 text-[#4ebac4]',
  legal:      'bg-amber-900/60 text-amber-300',
  compliance: 'bg-red-900/60 text-red-300',
  culture:    'bg-pink-900/60 text-pink-300',
}

const TABS = ['Overview', 'Pipeline'] as const
type Tab = typeof TABS[number]

export default function OnboardingPage() {
  const [tab,     setTab]     = useState<Tab>('Overview')
  const [records, setRecords] = useState<OnboardingRecord[]>([])
  const [stats,   setStats]   = useState<Stats>({ total: 0, pending: 0, in_progress: 0, completed: 0 })
  const [stageBreakdown, setStageBreakdown] = useState<Record<string, number>>({})
  const [avgDays,        setAvgDays]        = useState<number | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterStage,  setFilterStage]  = useState('')
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const load = useCallback(async (s = search, fs = filterStatus, fg = filterStage) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (s)  p.set('search', s)
    if (fs) p.set('status', fs)
    if (fg) p.set('stage',  fg)
    const res  = await fetchWithAuth(`/api/tenant/onboarding?${p}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setStats(data.stats ?? { total: 0, pending: 0, in_progress: 0, completed: 0 })
    setStageBreakdown(data.stageBreakdown ?? {})
    setAvgDays(data.avgDaysToComplete ?? null)
    setLoading(false)
  }, [search, filterStatus, filterStage])

  useEffect(() => { load() }, [])

  async function deleteRecord(id: string) {
    setConfirmState({
      message: 'Delete this onboarding record? This cannot be undone.',
      onConfirm: async () => {
        setDeleting(id)
        await fetchWithAuth('/api/tenant/onboarding', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        setDeleting(null)
        setExpanded(null)
        load()
      }
    })
  }

  function exportOnboarding() {
    exportCsv({
      filename: 'onboarding',
      columns: [
        { header: 'Employee First Name', key: 'employeeFirstName' },
        { header: 'Employee Last Name', key: 'employeeLastName' },
        { header: 'Employee Email', key: 'employeeEmail' },
        { header: 'Stage', key: 'stage', format: v => STAGE_LABELS[v as string] ?? v ?? '' },
        { header: 'Status', key: 'status', format: v => v === 'in_progress' ? 'In Progress' : v ? (v as string).charAt(0).toUpperCase() + (v as string).slice(1) : '' },
        { header: 'Start Date', key: 'employeeStartDate', format: v => fmtCsvDate(v as string | null) },
        { header: 'Completion Date', key: 'completedAt', format: v => fmtCsvDate(v as string | null) },
        { header: 'Onboarding Created', key: 'createdAt', format: v => fmtCsvDate(v as string) },
        { header: 'Notes', key: 'notes' },
        { header: 'Tasks Done', key: 'checklist', format: v => `${(v as OnboardingRecord['checklist']).filter(t => t.done).length}/${(v as OnboardingRecord['checklist']).length}` },
      ],
      rows: records,
    })
  }

  function progress(checklist: OnboardingRecord['checklist']) {
    if (!checklist?.length) return 0
    return Math.round(checklist.filter(t => t.done).length / checklist.length * 100)
  }

  // ── Overview helpers ──────────────────────────────────────────────
  const upcoming = records
    .filter(r => r.employeeStartDate && r.status !== 'completed')
    .map(r => ({
      ...r,
      daysUntilStart: Math.ceil((new Date(r.employeeStartDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    }))
    .filter(r => r.daysUntilStart >= 0 && r.daysUntilStart <= 30)
    .sort((a, b) => a.daysUntilStart - b.daysUntilStart)

  const recentCompletions = records
    .filter(r => r.status === 'completed' && r.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 5)

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Onboarding & Induction</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Track new employee onboarding progress across all stages</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportOnboarding} disabled={records.length === 0} />
          <Link href="/tenant/onboarding/new"
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2.5 rounded-lg transition">
            + Start Onboarding
          </Link>
        </div>
      </div>

      {/* Stat cards — clickable to filter Pipeline tab */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',       value: stats.total,       color: 'text-foreground',       fs: '' },
          { label: 'Pending',     value: stats.pending,     color: 'text-yellow-400',  fs: 'pending' },
          { label: 'In Progress', value: stats.in_progress, color: 'text-[#4ebac4]',    fs: 'in_progress' },
          { label: 'Completed',   value: stats.completed,   color: 'text-green-400',   fs: 'completed' },
        ].map(s => (
          <button key={s.label}
            onClick={() => { setFilterStatus(s.fs); setTab('Pipeline'); load(search, s.fs, filterStage) }}
            className={`card-premium p-5 text-left transition hover:border-[#1A6080] ${
              filterStatus === s.fs && tab === 'Pipeline' ? 'border-[#0E3D52]' : 'border-gray-200 dark:border-gray-800'
            }`}>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t
                ? 'border-[#0E3D52] text-[#1A6080] dark:text-[#4ebac4]'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
      {tab === 'Overview' && (
        <div className="space-y-6">

          {/* Metric row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-premium p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400  font-semibold mb-1">Active Onboardings</p>
              <p className="text-3xl font-bold text-[#4ebac4]">{stats.pending + stats.in_progress}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.pending} pending · {stats.in_progress} in progress</p>
            </div>
            <div className="card-premium p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400  font-semibold mb-1">Avg. Days to Complete</p>
              <p className="text-3xl font-bold text-[#1A6080] dark:text-[#4ebac4]">{avgDays !== null ? avgDays : '—'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Based on {stats.completed} completed</p>
            </div>
            <div className="card-premium p-5">
              <p className="text-xs text-gray-500 dark:text-gray-400  font-semibold mb-1">Completion Rate</p>
              <p className="text-3xl font-bold text-green-400">
                {stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stats.completed} of {stats.total} fully onboarded</p>
            </div>
          </div>

          {/* Stage funnel */}
          {Object.keys(stageBreakdown).length > 0 && (
            <div className="card-premium p-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Pipeline by Stage</h3>
              <div className="space-y-3">
                {STAGES.map(s => {
                  const count = stageBreakdown[s.value] ?? 0
                  const pct   = stats.total ? Math.round((count / stats.total) * 100) : 0
                  return (
                    <div key={s.value}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-gray-300">{s.label}</span>
                        <span className="text-gray-500 dark:text-gray-400">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full">
                        <div className={`h-2 rounded-full transition-all ${s.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Upcoming starters */}
          {upcoming.length > 0 && (
            <div className="bg-[#E0EEF4] dark:bg-blue-950/30 border border-blue-200 dark:border-[#1A6080]/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#7dcfd7] mb-3">📅 Upcoming Starters (next 30 days)</h3>
              <div className="space-y-2">
                {upcoming.map(r => (
                  <div key={r.id} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-200 font-medium">{r.employeeFirstName} {r.employeeLastName}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[r.status] ?? ''}`}>
                        {r.status === 'in_progress' ? 'In Progress' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${r.daysUntilStart <= 3 ? 'text-red-400' : r.daysUntilStart <= 7 ? 'text-amber-300' : 'text-[#7dcfd7]'}`}>
                        {r.daysUntilStart === 0 ? 'Today!' : r.daysUntilStart === 1 ? 'Tomorrow' : `In ${r.daysUntilStart} days`}
                      </span>
                      <Link href={`/tenant/onboarding/${r.id}`}
                        className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4]">
                        Manage →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent completions */}
          {recentCompletions.length > 0 && (
            <div className="card-premium overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Recent Completions</h3>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentCompletions.map(r => (
                  <li key={r.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-900/50 flex items-center justify-center text-green-300 text-sm font-bold">
                        {(r.employeeFirstName?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{r.employeeFirstName} {r.employeeLastName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{r.employeeEmail}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-green-400 font-medium">✓ Completed</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empty state */}
          {stats.total === 0 && !loading && (
            <EmptyState
              icon="🚀"
              title="No onboarding tasks"
              message="Create onboarding checklists for new employees."
            />
          )}
        </div>
      )}

      {/* ── PIPELINE TAB ─────────────────────────────────────────── */}
      {tab === 'Pipeline' && (
        <div className="space-y-4">

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); load(e.target.value, filterStatus, filterStage) }}
              placeholder="Search by name or email…"
              className="input-premium placeholder-gray-400 focus:outline-none focus:border-[#0E3D52] w-56"
            />
            <select value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); load(search, e.target.value, filterStage) }}
              className="input-premium focus:outline-none focus:border-[#0E3D52]">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <select value={filterStage}
              onChange={e => { setFilterStage(e.target.value); load(search, filterStatus, e.target.value) }}
              className="input-premium focus:outline-none focus:border-[#0E3D52]">
              <option value="">All stages</option>
              {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {(search || filterStatus || filterStage) && (
              <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterStage(''); load('', '', '') }}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-white border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg transition">
                Clear
              </button>
            )}
          </div>

          {/* Records */}
          {loading ? (
            <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div>
          ) : records.length === 0 ? (
            <EmptyState
              icon="🚀"
              title="No onboarding tasks"
              message="Create onboarding checklists for new employees."
            />
          ) : (
            <div className="space-y-3">
              {records.map(r => {
                const isOpen = expanded === r.id
                const pct    = progress(r.checklist)
                const done   = r.checklist?.filter(t => t.done).length ?? 0
                const tot    = r.checklist?.length ?? 0

                // Stage position
                const stageIdx = STAGE_ORDER.indexOf(r.stage)

                return (
                  <div key={r.id} className={`card-premium overflow-hidden transition ${
                    r.status === 'completed' ? 'border-green-900' : 'border-gray-200 dark:border-gray-800'
                  }`}>
                    {/* Card header */}
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => setExpanded(isOpen ? null : r.id)}>
                        <div className="flex items-center gap-3 flex-wrap mb-1.5">
                          <div className="w-8 h-8 rounded-full bg-[#0E3D52] flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {(r.employeeFirstName?.[0] ?? '?').toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-gray-900 dark:text-white font-medium text-sm truncate">
                              {r.employeeFirstName} {r.employeeLastName}
                            </p>
                            {r.employeeEmail && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.employeeEmail}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[r.status] ?? 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                            {r.status === 'in_progress' ? 'In Progress' : r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                            {STAGE_LABELS[r.stage] ?? r.stage}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="flex items-center gap-2 pl-11">
                          <div className="flex-1 max-w-xs h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
                            <div className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-[#f0f7fb]0'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{done}/{tot} tasks</span>
                          {r.employeeStartDate && (
                            <span className="text-xs text-amber-400 font-medium hidden sm:block">
                              Start {new Date(r.employeeStartDate).toLocaleDateString('en-AU')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/tenant/onboarding/${r.id}`}
                          className="text-xs bg-[#0E3D52]/20 border border-[#1A6080] text-[#4ebac4] hover:bg-[#0E3D52]/40 px-2.5 py-1.5 rounded-lg transition">
                          Manage
                        </Link>
                        <button
                          onClick={() => deleteRecord(r.id)}
                          disabled={deleting === r.id}
                          title="Delete record"
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 px-1 py-1 rounded transition">
                          {deleting === r.id ? '…' : '🗑'}
                        </button>
                        <button
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                          className="text-gray-500 dark:text-gray-400 ml-1 text-sm">
                          {isOpen ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 space-y-4">

                        {/* Stage stepper */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500  mb-3 dark:text-gray-400">Stage Progress</p>
                          <div className="flex items-center gap-1">
                            {STAGES.map((s, i) => (
                              <div key={s.value} className="flex items-center flex-1">
                                <div className={`flex flex-col items-center flex-1 ${i <= stageIdx ? 'opacity-100' : 'opacity-40'}`}>
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                                    i < stageIdx  ? 'bg-green-600 text-white' :
                                    i === stageIdx ? 'bg-[#0E3D52] text-white ring-2 ring-[#4ebac4]' :
                                    'bg-gray-700 text-gray-400'
                                  }`}>
                                    {i < stageIdx ? '✓' : i + 1}
                                  </div>
                                  <p className="text-[10px] text-gray-600 dark:text-gray-400 text-center leading-tight">{s.label}</p>
                                </div>
                                {i < STAGES.length - 1 && (
                                  <div className={`h-0.5 flex-1 mx-1 rounded ${i < stageIdx ? 'bg-green-600' : 'bg-gray-700'}`} />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Checklist preview — first 5 items */}
                        {r.checklist?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500  mb-2 dark:text-gray-400">Checklist Preview</p>
                            <div className="space-y-1.5">
                              {r.checklist.slice(0, 5).map(item => (
                                <div key={item.id} className="flex items-center gap-2.5">
                                  <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                    item.done ? 'bg-[#0E3D52] border-[#0E3D52]' : 'border-gray-600'
                                  }`}>
                                    {item.done && <span className="text-white text-[10px]">✓</span>}
                                  </div>
                                  <span className={`text-xs ${item.done ? 'line-through text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {item.task}
                                  </span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-auto ${CATEGORY_COLOR[item.category] ?? 'bg-gray-700 text-gray-300'}`}>
                                    {item.category}
                                  </span>
                                </div>
                              ))}
                              {r.checklist.length > 5 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 pl-6">
                                  +{r.checklist.length - 5} more — <Link href={`/tenant/onboarding/${r.id}`} className="text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4]">view all</Link>
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Key info */}
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Start Date',   value: r.employeeStartDate ? new Date(r.employeeStartDate).toLocaleDateString('en-AU') : '—' },
                            { label: 'Onboarding Since', value: new Date(r.createdAt).toLocaleDateString('en-AU') },
                            { label: 'Completed At', value: r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-AU') : '—' },
                          ].map(d => (
                            <div key={d.label} className="bg-gray-100 dark:bg-gray-800/60 rounded-lg p-3">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{d.label}</p>
                              <p className="text-sm text-gray-700 dark:text-gray-200">{d.value}</p>
                            </div>
                          ))}
                        </div>

                        {r.notes && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500  mb-1 dark:text-gray-400">Notes</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{r.notes}</p>
                          </div>
                        )}

                        <div className="pt-1">
                          <Link href={`/tenant/onboarding/${r.id}`}
                            className="text-sm text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] font-medium">
                            Open full onboarding record →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
