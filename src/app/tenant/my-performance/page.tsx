'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import { SkeletonPage } from '@/components/ui/Skeleton'

type Review = {
  id: string; type: string; status: string
  scheduledDate: string | null; completedAt: string | null; overallRating: string | null
  kpis: { id: string; area: string; rating: number | null; notes: string }[]
  developmentPlan: string | null; outcome: string | null; employeeInput: any
  createdAt: string
}

type Goal = {
  id: string; reviewId: string | null
  title: string; description: string | null; category: string | null
  targetDate: string | null; status: string; progress: number
  selfRating: number | null; managerRating: number | null; managerNote: string | null
  createdAt: string
}

const REVIEW_TYPES = [
  { value: 'probation_4wk',   label: '4-Week Probation Check' },
  { value: 'mid_probation',   label: 'Mid-Probation Review' },
  { value: 'end_probation',   label: 'End-of-Probation Review' },
  { value: 'annual',          label: 'Annual Performance Review' },
  { value: 'kpi',             label: 'KPI Review' },
  { value: 'pip',             label: 'Performance Improvement Plan' },
]

const GOAL_STATUSES = [
  { value: 'active',    label: 'Active',    color: 'badge badge-blue' },
  { value: 'completed', label: 'Completed', color: 'badge badge-green' },
  { value: 'on_hold',   label: 'On Hold',   color: 'badge badge-amber' },
  { value: 'cancelled', label: 'Cancelled', color: 'badge badge-gray' },
]

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'badge badge-blue',
  completed: 'badge badge-green',
  overdue:   'badge badge-red',
}

const RATING_LABELS = ['', 'Unsatisfactory', 'Needs Improvement', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding']

const INPUT = 'input-premium'

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-amber-400' : value >= 25 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-[#0E3D52]/60 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right">{value}%</span>
    </div>
  )
}

export default function MyPerformancePage() {
  const [reviews, setReviews]   = useState<Review[]>([])
  const [goals,   setGoals]     = useState<Goal[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab,     setTab]       = useState<'reviews' | 'goals'>('reviews')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Self-assessment
  const [selfAssessModal, setSelfAssessModal] = useState<{ id: string } | null>(null)
  const [selfAssessForm,  setSelfAssessForm]  = useState({ strengths: '', improvements: '', goals: '', comments: '' })
  const [selfSaving,      setSelfSaving]      = useState(false)

  // Goal progress update
  const [updatingGoal, setUpdatingGoal] = useState<{ id: string; progress: number; selfRating: number | null } | null>(null)
  const [goalSaving,   setGoalSaving]   = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [revRes, goalRes] = await Promise.all([
      fetchWithAuth('/api/tenant/my-performance'),
      fetchWithAuth('/api/tenant/performance-goals'),
    ])
    const [revData, goalData] = await Promise.all([revRes.json(), goalRes.json()])
    setReviews(revData.reviews ?? [])
    setGoals(goalData.goals ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [])

  function openSelfAssess(r: Review) {
    const ei = r.employeeInput ?? {}
    setSelfAssessForm({
      strengths:    ei.strengths    ?? '',
      improvements: ei.improvements ?? '',
      goals:        ei.goals        ?? '',
      comments:     ei.comments     ?? '',
    })
    setSelfAssessModal({ id: r.id })
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
    loadData()
  }

  async function saveGoalProgress() {
    if (!updatingGoal) return
    setGoalSaving(true)
    await fetchWithAuth('/api/tenant/performance-goals', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: updatingGoal.id, progress: updatingGoal.progress, selfRating: updatingGoal.selfRating }),
    })
    setUpdatingGoal(null)
    setGoalSaving(false)
    loadData()
  }

  if (loading) return <SkeletonPage rows={4} />

  const activeGoals    = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')
  const avgProgress    = activeGoals.length ? Math.round(activeGoals.reduce((s, g) => s + g.progress, 0) / activeGoals.length) : 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Performance</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Your reviews, goals and self-assessments</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Reviews',       value: reviews.length,    color: 'text-foreground' },
          { label: 'Active Goals',  value: activeGoals.length, color: 'text-[#4ebac4]' },
          { label: 'Goals Done',    value: completedGoals.length, color: 'text-green-400' },
          { label: 'Avg Progress',  value: `${avgProgress}%`, color: 'text-[#1A6080] dark:text-[#4ebac4]' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-[#0A1929]/60 rounded-xl p-1 w-fit">
        {(['reviews', 'goals'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition capitalize ${
              tab === t ? 'bg-white dark:bg-[#0F1E2E] text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-300'
            }`}>
            {t === 'reviews' ? 'My Reviews' : 'My Goals'}
          </button>
        ))}
      </div>

      {/* Self-assessment modal */}
      {selfAssessModal && (
        <div className="modal-overlay overflow-y-auto">
          <div className="card-premium p-6 w-full max-w-xl space-y-4 my-4">
            <h3 className="text-lg font-bold text-foreground">My Self-Assessment</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Your input will be shared with your reviewer ahead of the performance meeting.</p>
            {[
              { key: 'strengths',    label: 'Key Strengths',           placeholder: 'What are you most proud of this period?' },
              { key: 'improvements', label: 'Areas for Improvement',   placeholder: 'Where would you like to grow or develop?' },
              { key: 'goals',        label: 'Goals for Next Period',    placeholder: 'What do you want to focus on going forward?' },
              { key: 'comments',     label: 'Additional Comments',     placeholder: 'Any other feedback for your manager…' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">{label}</label>
                <textarea value={(selfAssessForm as any)[key]}
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

      {/* Goal progress modal */}
      {updatingGoal && (
        <div className="modal-overlay">
          <div className="card-premium p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-foreground">Update Progress</h3>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Progress: {updatingGoal.progress}%</label>
              <input type="range" min={0} max={100} step={5} value={updatingGoal.progress}
                onChange={e => setUpdatingGoal({ ...updatingGoal, progress: Number(e.target.value) })}
                className="w-full accent-[#0E3D52] mb-2" />
              <ProgressBar value={updatingGoal.progress} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">My Rating (1–5)</label>
              <div className="flex gap-1.5">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setUpdatingGoal({ ...updatingGoal, selfRating: n })}
                    className={`flex-1 py-2 rounded text-xs font-medium transition ${updatingGoal.selfRating === n ? 'bg-[#0E3D52] text-white' : 'bg-gray-200 dark:bg-[#0E3D52]/60 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                    {n}
                  </button>
                ))}
              </div>
              {updatingGoal.selfRating && <p className="text-xs text-[#1A6080] dark:text-[#4ebac4] mt-1">{RATING_LABELS[updatingGoal.selfRating]}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={saveGoalProgress} disabled={goalSaving}
                className="flex-1 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm py-2 rounded-lg transition font-medium">
                {goalSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setUpdatingGoal(null)}
                className="px-5 border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-300 hover:text-white text-sm rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MY REVIEWS ──────────────────────────────────────────────────── */}
      {tab === 'reviews' && (
        reviews.length === 0 ? (
          <div className="card-premium py-14 text-center">
            <p className="text-gray-600 dark:text-gray-300 font-medium">No reviews yet</p>
            <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">Your manager will schedule a review when it's time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(r => {
              const isOpen = expanded === r.id
              const ei = r.employeeInput
              const hasSelfAssess = ei && (ei.strengths || ei.improvements || ei.goals || ei.comments)
              return (
                <div key={r.id} className="card-premium overflow-hidden">
                  {/* Summary row */}
                  <div className="flex items-center justify-between px-5 py-4 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">
                          {REVIEW_TYPES.find(t => t.value === r.type)?.label ?? r.type}
                        </p>
                        <span className={`capitalize ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {r.scheduledDate ? `Scheduled: ${new Date(r.scheduledDate + 'T00:00:00').toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}` : `Created: ${new Date(r.createdAt).toLocaleDateString('en-AU')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.overallRating && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#1A6080] dark:text-[#4ebac4]">{Number(r.overallRating).toFixed(1)}<span className="text-xs text-gray-500 font-normal">/5</span></p>
                        </div>
                      )}
                      <button onClick={() => openSelfAssess(r)}
                        className={`text-xs border px-3 py-1.5 rounded-lg transition font-medium ${hasSelfAssess ? 'border-green-500 dark:border-green-700 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10' : 'border-[#1A6080] text-[#1A6080] dark:text-[#4ebac4] hover:bg-[#0E3D52]/20'}`}>
                        {hasSelfAssess ? '✓ Self-Assessed' : 'Self-Assess'}
                      </button>
                      <button onClick={() => setExpanded(isOpen ? null : r.id)}
                        className="text-xs border border-gray-700 text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg transition">
                        {isOpen ? 'Hide ▲' : 'Details ▼'}
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-gray-200 dark:border-[#1A6080]/20 px-5 py-4 space-y-4">
                      {/* KPI breakdown */}
                      {r.kpis?.some(k => k.rating) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500  mb-2">KPI Breakdown</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {r.kpis.map(kpi => (
                              <div key={kpi.id} className="flex items-center justify-between bg-gray-50 dark:bg-[#0A1929]/40 rounded-lg px-3 py-2">
                                <span className="text-xs text-gray-400">{kpi.area}</span>
                                <span className={`text-xs font-medium ml-2 ${kpi.rating ? 'text-[#4ebac4]' : 'text-gray-500'}`}>
                                  {kpi.rating ? `${kpi.rating}/5` : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Development plan */}
                      {r.developmentPlan && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500  mb-1">Development Plan</p>
                          <p className="text-sm text-gray-300 bg-gray-50 dark:bg-[#0A1929]/40 rounded-lg px-3 py-2">{r.developmentPlan}</p>
                        </div>
                      )}

                      {/* Self-assessment preview */}
                      {hasSelfAssess && (
                        <div className="bg-[#E0EEF4] dark:bg-[#0E3D52]/20 border border-[#1A6080]/30 dark:border-[#1A6080]/20 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-semibold text-[#4ebac4] ">Your Self-Assessment</p>
                          {ei.strengths    && <div><p className="text-xs text-gray-500">Strengths</p><p className="text-xs text-gray-300">{ei.strengths}</p></div>}
                          {ei.improvements && <div><p className="text-xs text-gray-500">Improvements</p><p className="text-xs text-gray-300">{ei.improvements}</p></div>}
                          {ei.goals        && <div><p className="text-xs text-gray-500">Next Period Goals</p><p className="text-xs text-gray-300">{ei.goals}</p></div>}
                          {ei.comments     && <div><p className="text-xs text-gray-500">Comments</p><p className="text-xs text-gray-300">{ei.comments}</p></div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ─── MY GOALS ────────────────────────────────────────────────────── */}
      {tab === 'goals' && (
        goals.length === 0 ? (
          <div className="card-premium py-14 text-center">
            <p className="text-gray-600 dark:text-gray-300 font-medium">No goals set yet</p>
            <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">Your manager will assign goals or you can request them.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map(g => {
              const statusStyle = GOAL_STATUSES.find(s => s.value === g.status)?.color ?? 'badge badge-gray'
              return (
                <div key={g.id} className="card-premium p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{g.title}</p>
                        <span className={statusStyle}>
                          {GOAL_STATUSES.find(s => s.value === g.status)?.label ?? g.status}
                        </span>
                        {g.category && <span className="text-xs px-2 py-0.5 rounded-full border border-gray-700 text-gray-400">{g.category}</span>}
                      </div>
                      {g.description && <p className="text-xs text-gray-400 mt-1">{g.description}</p>}
                    </div>
                    <button onClick={() => setUpdatingGoal({ id: g.id, progress: g.progress, selfRating: g.selfRating })}
                      className="text-xs border border-[#1A6080] text-[#1A6080] dark:text-[#4ebac4] hover:bg-[#0E3D52]/20 px-2.5 py-1.5 rounded-lg transition shrink-0">
                      Update
                    </button>
                  </div>

                  <ProgressBar value={g.progress} />

                  <div className="flex items-center gap-4 flex-wrap text-xs">
                    {g.targetDate && (
                      <span className="text-gray-500">Target: {new Date(g.targetDate + 'T00:00:00').toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}</span>
                    )}
                    {g.selfRating != null && (
                      <span className="text-[#4ebac4]">My rating: {g.selfRating}/5 · {RATING_LABELS[g.selfRating]}</span>
                    )}
                    {g.managerRating != null && (
                      <span className="text-green-400">Manager: {g.managerRating}/5 · {RATING_LABELS[g.managerRating]}</span>
                    )}
                  </div>
                  {g.managerNote && (
                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-0.5">Manager feedback</p>
                      <p className="text-xs text-green-300">{g.managerNote}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
