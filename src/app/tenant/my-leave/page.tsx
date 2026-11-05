'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonPage } from '@/components/ui/Skeleton'

type LeaveRequest = {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: string
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
}

type Stats = {
  total: number
  pending: number
  approved: number
  rejected: number
  cancelled: number
  totalDaysApproved: number
  totalDaysPending: number
}

type Balance = {
  key: string
  label: string
  emoji: string
  color: string
  accrualNote: string
  entitlement: number | null
  taken: number
  pending: number
  remaining: number | null
}

type LeaveTypeConfig = {
  key: string
  label: string
  emoji: string
  isActive: boolean
}

type Employee = { id: string; firstName: string; lastName: string }

const STATUS_STYLE: Record<string, string> = {
  pending:   'badge badge-amber',
  approved:  'badge badge-green',
  rejected:  'badge badge-red',
  cancelled: 'badge badge-gray',
}

const STATUS_ICON: Record<string, string> = {
  pending:   '⏳',
  approved:  '✅',
  rejected:  '❌',
  cancelled: '🚫',
}

const INPUT = 'input-premium'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start), e = new Date(end)
  if (e < s) return 0
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function MyLeavePage() {
  const [requests,    setRequests]    = useState<LeaveRequest[]>([])
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [employee,    setEmployee]    = useState<Employee | null>(null)
  const [linked,      setLinked]      = useState(true)
  const [loading,     setLoading]     = useState(true)
  const [leaveTypes,  setLeaveTypes]  = useState<LeaveTypeConfig[]>([])
  const [balances,    setBalances]    = useState<Balance[]>([])
  const [loadingBal,  setLoadingBal]  = useState(false)

  // New request form
  const [showForm,     setShowForm]     = useState(false)
  const [form,         setForm]         = useState({ leaveType: '', startDate: '', endDate: '', reason: '' })
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState<string | null>(null)
  const [holidays,     setHolidays]     = useState<{ name: string; date: string }[]>([])
  const computedDays = calcDays(form.startDate, form.endDate)
  const overlappingHolidays = (form.startDate && form.endDate)
    ? holidays.filter(h => h.date >= form.startDate && h.date <= form.endDate)
    : []

  // Cancel
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  // Tab
  const [tab, setTab] = useState<'history' | 'balances'>('history')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    const res  = await fetchWithAuth('/api/tenant/my-leave')
    const data = await res.json()
    setLinked(data.employeeLinked !== false)
    setRequests(data.requests ?? [])
    setStats(data.stats ?? null)
    setEmployee(data.employee ?? null)
    setLoading(false)
  }, [])

  const loadBalances = useCallback(async () => {
    setLoadingBal(true)
    const res  = await fetchWithAuth(`/api/tenant/leave/balances?year=${new Date().getFullYear()}`)
    const data = await res.json()
    setBalances(data.balances ?? [])
    setLoadingBal(false)
  }, [])

  useEffect(() => {
    loadRequests()
    fetchWithAuth('/api/tenant/leave/types')
      .then(r => r.json())
      .then(d => {
        const types: LeaveTypeConfig[] = d.types ?? []
        setLeaveTypes(types)
        if (types.length > 0) setForm(f => ({ ...f, leaveType: types[0].key }))
      })
    fetchWithAuth(`/api/tenant/public-holidays?year=${new Date().getFullYear()}`)
      .then(r => r.json()).then(d => setHolidays(d.holidays ?? []))
  }, [])

  useEffect(() => {
    if (tab === 'balances') loadBalances()
  }, [tab])

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (computedDays <= 0) return
    setSaving(true); setFormError(null)
    try {
      const res = await fetchWithAuth('/api/tenant/leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, totalDays: computedDays }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setFormError(d.error ?? `Request failed (${res.status}).`)
        return
      }
      setShowForm(false)
      setForm(f => ({ ...f, startDate: '', endDate: '', reason: '' }))
      loadRequests()
      if (tab === 'balances') loadBalances()
    } catch {
      setFormError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function cancelRequest(id: string) {
    setConfirmState({
      message: 'Cancel this leave request?',
      confirmLabel: 'Cancel Request',
      onConfirm: async () => {
        setCancelling(id)
        await fetchWithAuth('/api/tenant/leave', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'cancel' }),
        })
        setCancelling(null)
        loadRequests()
        if (tab === 'balances') loadBalances()
      }
    })
  }

  if (loading) return <SkeletonPage rows={5} />

  if (!linked) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="card-premium rounded-2xl p-10 text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Profile Not Linked</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Your account is not linked to an employee record. Contact HR to set this up.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Leave</h1>
          {employee && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {employee.firstName} {employee.lastName}
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(null) }}
          className="px-4 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium rounded-lg transition">
          + New Request
        </button>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Days Approved',  value: stats.totalDaysApproved, color: 'text-green-400' },
            { label: 'Days Pending',   value: stats.totalDaysPending,  color: 'text-yellow-400' },
            { label: 'Requests',       value: stats.total,             color: 'text-foreground' },
            { label: 'Pending Review', value: stats.pending,           color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="card-premium p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 w-fit">
        {([
          { id: 'history',  label: '📋 History' },
          { id: 'balances', label: '⚖️ Balances' },
        ] as { id: 'history' | 'balances'; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-white dark:bg-gray-900 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── NEW REQUEST MODAL ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form onSubmit={submitRequest}
            className="card-premium rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">New Leave Request</h2>
              <button type="button" onClick={() => { setShowForm(false); setFormError(null) }}
                className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div>
              <label className={LABEL}>Leave Type *</label>
              <select value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}
                className={INPUT} required>
                {leaveTypes.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Start Date *</label>
                <input type="date" value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className={INPUT} required />
              </div>
              <div>
                <label className={LABEL}>End Date *</label>
                <input type="date" value={form.endDate} min={form.startDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className={INPUT} required />
              </div>
            </div>

            {computedDays > 0 && (
              <div className="bg-[#f0f7fb] dark:bg-[#0E3D52]/30 border border-[#b8d4e0] dark:border-[#1A6080] rounded-lg px-4 py-2.5 space-y-1.5">
                <p className="text-sm text-[#4ebac4] font-medium">
                  {computedDays} calendar day{computedDays !== 1 ? 's' : ''} requested
                </p>
                {overlappingHolidays.length > 0 && (
                  <>
                    <p className="text-xs text-amber-400 font-medium">
                      Public holiday{overlappingHolidays.length > 1 ? 's' : ''} in this period:
                    </p>
                    {overlappingHolidays.map(h => (
                      <p key={h.date} className="text-xs text-amber-300 pl-2">
                        {fmtShort(h.date)} — {h.name}
                      </p>
                    ))}
                  </>
                )}
              </div>
            )}

            <div>
              <label className={LABEL}>Reason (optional)</label>
              <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className={INPUT + ' min-h-[70px] resize-none'} placeholder="Brief description…" />
            </div>

            {formError && (
              <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving || computedDays <= 0}
                className="flex-1 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setFormError(null) }}
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── HISTORY TAB ─────────────────────────────────────────────────── */}
      {tab === 'history' && (
        requests.length === 0 ? (
          <EmptyState
            icon="🌴"
            title="No leave requests"
            message="Your leave requests will appear here."
            action={{ label: 'New Request', onClick: () => { setShowForm(true); setFormError(null) } }}
          />
        ) : (
          <div className="space-y-3">
            {requests.map(r => {
              const isOpen = expanded === r.id
              return (
                <div key={r.id} className="card-premium overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                    <div className="text-2xl shrink-0">
                      {leaveTypes.find(t => t.key === r.leaveType)?.emoji ?? '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {leaveTypes.find(t => t.key === r.leaveType)?.label ?? r.leaveType}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {fmt(r.startDate)} → {fmt(r.endDate)}
                        <span className="ml-2 text-[#1A6080] dark:text-[#4ebac4]">{r.totalDays}d</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`capitalize ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>
                        {STATUS_ICON[r.status]} {r.status}
                      </span>
                      <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-5 pb-4 border-t border-gray-200 dark:border-gray-800 pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Requested on</p>
                          <p className="text-foreground">{fmt(r.createdAt)}</p>
                        </div>
                        {r.reviewedAt && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Reviewed on</p>
                            <p className="text-foreground">{fmt(r.reviewedAt)}</p>
                          </div>
                        )}
                        {r.reason && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Reason</p>
                            <p className="text-gray-600 dark:text-gray-300">{r.reason}</p>
                          </div>
                        )}
                        {r.reviewNote && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Manager note</p>
                            <p className="text-gray-600 dark:text-gray-300 italic">"{r.reviewNote}"</p>
                          </div>
                        )}
                      </div>
                      {r.status === 'pending' && (
                        <button
                          onClick={() => cancelRequest(r.id)}
                          disabled={cancelling === r.id}
                          className="text-xs px-3 py-1.5 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 rounded-lg transition">
                          {cancelling === r.id ? 'Cancelling…' : 'Cancel Request'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ─── BALANCES TAB ────────────────────────────────────────────────── */}
      {tab === 'balances' && (
        loadingBal ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">Calculating balances…</div>
        ) : balances.length === 0 ? (
          <div className="card-premium py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No leave types configured. Contact HR.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.map(b => {
              const pct = b.entitlement && b.entitlement < 999
                ? Math.min(100, Math.round(((b.taken + b.pending) / b.entitlement) * 100))
                : null
              const remainingColor = b.remaining == null ? 'text-gray-400'
                : b.remaining === 0   ? 'text-red-400'
                : b.remaining <= 5    ? 'text-amber-400'
                : 'text-green-400'

              return (
                <div key={b.key} className="card-premium rounded-2xl p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{b.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{b.label}</p>
                      {b.accrualNote && <p className="text-xs text-gray-600 mt-0.5 dark:text-gray-400">{b.accrualNote}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Entitlement</p>
                      <p className="font-semibold text-foreground">
                        {b.entitlement == null || b.entitlement >= 999 ? '∞' : `${b.entitlement}d`}
                      </p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Taken</p>
                      <p className="font-semibold text-foreground">{b.taken}d</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
                      <p className="font-semibold text-yellow-400">{b.pending}d</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Remaining</p>
                      <p className={`font-semibold ${remainingColor}`}>
                        {b.remaining == null ? '∞' : `${b.remaining}d`}
                      </p>
                    </div>
                  </div>

                  {pct != null && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1 dark:text-gray-400">
                        <span>Used</span><span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : b.color,
                          }} />
                      </div>
                    </div>
                  )}

                  {/* Quick request button */}
                  <button
                    onClick={() => {
                      setForm(f => ({ ...f, leaveType: b.key }))
                      setShowForm(true); setFormError(null)
                    }}
                    className="w-full text-xs py-1.5 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-white hover:border-[#0E3D52] rounded-lg transition">
                    Request {b.label}
                  </button>
                </div>
              )
            })}
          </div>
        )
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
