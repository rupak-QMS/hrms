'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'

// ── Types ─────────────────────────────────────────────────────────────────────
type LeaveRequest = {
  id: string
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  employeeFirstName: string | null
  employeeLastName: string | null
  employeeEmail: string | null
}

type Stats = {
  total: number
  pending: number
  approved: number
  rejected: number
  cancelled: number
  totalDaysApproved: number
}

type Employee = { id: string; firstName: string; lastName: string }

type LeaveTypeConfig = {
  key: string
  label: string
  emoji: string
  color: string
  accrualNote?: string
  entitlementDaysFT: number
  entitlementDaysPT: number
  entitlementDaysCasual: number
  isActive: boolean
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

type CalendarEvent = {
  id: string
  employeeId: string
  employeeName: string
  leaveType: string
  label: string
  emoji: string
  color: string
  startDate: string
  endDate: string
  totalDays: number
  status: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const STATUS_STYLE: Record<string, string> = {
  pending:   'badge badge-amber',
  approved:  'badge badge-green',
  rejected:  'badge badge-red',
  cancelled: 'badge badge-gray',
}

const MANAGER_ROLES = ['director', 'hr_officer', 'operations_manager', 'team_leader', 'compliance_manager']
const INPUT  = 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]'
const LABEL  = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start), e = new Date(end)
  if (e < s) return 0
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

type Tab = 'requests' | 'balances' | 'calendar'

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeavePage() {
  const [tab, setTab] = useState<Tab>('requests')

  // ── Shared state ──
  const [canApprove, setCanApprove] = useState(false)
  const [userRole,   setUserRole]   = useState('employee')
  const [employees,  setEmployees]  = useState<Employee[]>([])
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeConfig[]>([])

  // ── Requests tab ──
  const [requests,     setRequests]     = useState<LeaveRequest[]>([])
  const [stats,        setStats]        = useState<Stats>({ total:0, pending:0, approved:0, rejected:0, cancelled:0, totalDaysApproved:0 })
  const [loadingReqs,  setLoadingReqs]  = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [form, setForm] = useState({ employeeId: '', leaveType: 'annual', startDate: '', endDate: '', reason: '' })
  const computedDays = calcDays(form.startDate, form.endDate)
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [reviewNote,  setReviewNote]  = useState<Record<string, string>>({})
  const [reviewing,   setReviewing]   = useState<string | null>(null)
  const [formError,   setFormError]   = useState<string | null>(null)
  const [holidays,    setHolidays]    = useState<{ name: string; date: string }[]>([])
  // ── Bulk actions ──
  const [selected,    setSelected]    = useState<Set<string>>(new Set())
  const [bulkBusy,    setBulkBusy]    = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const overlappingHolidays = (form.startDate && form.endDate)
    ? holidays.filter(h => h.date >= form.startDate && h.date <= form.endDate)
    : []

  // ── Balances tab ──
  const [balances,      setBalances]      = useState<Balance[]>([])
  const [loadingBal,    setLoadingBal]    = useState(false)
  const [balYear,       setBalYear]       = useState(new Date().getFullYear())
  const [balEmployee,   setBalEmployee]   = useState('')
  const [balLinked,     setBalLinked]     = useState(true)

  // ── Calendar tab ──
  const [calYear,   setCalYear]   = useState(new Date().getFullYear())
  const [calMonth,  setCalMonth]  = useState(new Date().getMonth() + 1)   // 1-12
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [loadingCal, setLoadingCal] = useState(false)

  // ── Bootstrap ──
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        const role = d.userRole ?? 'employee'
        setUserRole(role)
        setCanApprove(MANAGER_ROLES.includes(role))
      })
      .catch(() => {})

    fetchWithAuth('/api/tenant/leave/types')
      .then(r => r.json())
      .then(d => setLeaveTypes(d.types ?? []))
      .catch(() => {})

    fetchWithAuth('/api/tenant/employees?status=active&limit=500')
      .then(r => r.json())
      .then(d => setEmployees(d.employees ?? []))
      .catch(() => {})
  }, [])

  function handleExport() {
    exportCsv({
      filename: `leave-requests-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { header: 'Employee', key: 'employeeFirstName', format: (_, r: LeaveRequest) => `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim() },
        { header: 'Email', key: 'employeeEmail', format: (v: string | null) => v ?? '' },
        { header: 'Leave Type', key: 'leaveType' },
        { header: 'Start Date', key: 'startDate', format: (v: string) => fmtCsvDate(v) },
        { header: 'End Date', key: 'endDate', format: (v: string) => fmtCsvDate(v) },
        { header: 'Days', key: 'totalDays' },
        { header: 'Status', key: 'status', format: (v: string) => v.charAt(0).toUpperCase() + v.slice(1) },
        { header: 'Reason', key: 'reason', format: (v: string | null) => v ?? '' },
        { header: 'Review Note', key: 'reviewNote', format: (v: string | null) => v ?? '' },
        { header: 'Reviewed At', key: 'reviewedAt', format: (v: string | null) => fmtCsvDate(v) },
        { header: 'Submitted At', key: 'createdAt', format: (v: string) => fmtCsvDate(v) },
      ],
      rows: requests,
    })
  }

  // ── Load requests ──
  const loadRequests = useCallback(async (st = filterStatus, t = filterType) => {
    setLoadingReqs(true)
    const p = new URLSearchParams()
    if (st) p.set('status', st)
    if (t)  p.set('leaveType', t)
    const res  = await fetchWithAuth(`/api/tenant/leave?${p}`)
    const data = await res.json()
    setRequests(data.requests ?? [])
    setStats(data.stats ?? { total:0, pending:0, approved:0, rejected:0, cancelled:0, totalDaysApproved:0 })
    setLoadingReqs(false)
  }, [filterStatus, filterType])

  useEffect(() => { loadRequests() }, [])

  // ── Load balances ──
  const loadBalances = useCallback(async (year = balYear, empId = balEmployee) => {
    setLoadingBal(true)
    const p = new URLSearchParams({ year: String(year) })
    if (empId) p.set('employeeId', empId)
    const res  = await fetchWithAuth(`/api/tenant/leave/balances?${p}`)
    const data = await res.json()
    setBalLinked(data.employeeLinked !== false)
    setBalances(data.balances ?? [])
    setLoadingBal(false)
  }, [balYear, balEmployee])

  useEffect(() => {
    if (tab === 'balances') loadBalances()
  }, [tab])

  // ── Load calendar ──
  const loadCalendar = useCallback(async (year = calYear, month = calMonth) => {
    setLoadingCal(true)
    const res  = await fetchWithAuth(`/api/tenant/leave/calendar?year=${year}&month=${month}`)
    const data = await res.json()
    setCalEvents(data.events ?? [])
    setLoadingCal(false)
  }, [calYear, calMonth])

  useEffect(() => {
    if (tab === 'calendar') loadCalendar()
  }, [tab])

  // ── Submit new request ──
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (computedDays <= 0) return
    setSaving(true); setFormError(null)
    try {
      const res = await fetchWithAuth('/api/tenant/leave', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ ...form, totalDays: computedDays }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setFormError(data.error ?? `Request failed (${res.status}).`)
        return
      }
      setShowForm(false)
      setForm({ employeeId: '', leaveType: 'annual', startDate: '', endDate: '', reason: '' })
      loadRequests()
    } catch {
      setFormError('Network error — please try again.')
    } finally { setSaving(false) }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    setReviewing(id)
    await fetchWithAuth('/api/tenant/leave', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ id, action, reviewNote: reviewNote[id] ?? '' }),
    })
    setReviewing(null); loadRequests()
  }

  async function cancel(id: string) {
    setReviewing(id)
    await fetchWithAuth('/api/tenant/leave', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body:   JSON.stringify({ id, action: 'cancel' }),
    })
    setReviewing(null); loadRequests()
  }

  async function bulkReview(action: 'approve' | 'reject') {
    if (selected.size === 0) return
    const label = action === 'approve' ? 'approve' : 'reject'
    setConfirmState({
      message: `${label.charAt(0).toUpperCase() + label.slice(1)} ${selected.size} selected request${selected.size > 1 ? 's' : ''}?`,
      danger: action === 'reject',
      confirmLabel: label.charAt(0).toUpperCase() + label.slice(1),
      onConfirm: async () => {
        setBulkBusy(true)
        await Promise.all([...selected].map(id =>
          fetchWithAuth('/api/tenant/leave', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action }),
          })
        ))
        setSelected(new Set())
        setBulkBusy(false)
        loadRequests()
      }
    })
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')
  const allPendingSelected = pendingRequests.length > 0 && pendingRequests.every(r => selected.has(r.id))

  function toggleSelectAll() {
    if (allPendingSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(pendingRequests.map(r => r.id)))
    }
  }

  // ── Calendar helpers ──
  function calendarDays(year: number, month: number) {
    const firstDate = new Date(year, month - 1, 1)
    const lastDate  = new Date(year, month, 0)
    const startPad  = firstDate.getDay()   // 0=Sun
    const days: (number | null)[] = Array(startPad).fill(null)
    for (let d = 1; d <= lastDate.getDate(); d++) days.push(d)
    return days
  }

  function eventsOnDay(year: number, month: number, day: number): CalendarEvent[] {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return calEvents.filter(e => e.startDate <= dateStr && e.endDate >= dateStr)
  }

  const days = calendarDays(calYear, calMonth)

  // ── Leave type label map ──
  const typeLabel = Object.fromEntries(leaveTypes.map(t => [t.key, `${t.emoji} ${t.label}`]))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-premium-title">Leave Management</h1>
          <p className="page-premium-subtitle mt-0.5">
            {canApprove ? 'Review team leave requests, balances and calendar' : 'Submit and track your leave'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canApprove && (
            <Link href="/tenant/leave/settings"
              className="px-3 py-2 rounded-lg text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white hover:border-gray-500 transition">
              Leave Settings
            </Link>
          )}
          <button
            onClick={() => {
              setShowForm(true); setFormError(null)
              if (holidays.length === 0) {
                fetchWithAuth(`/api/tenant/public-holidays?year=${new Date().getFullYear()}`)
                  .then(r => r.json()).then(d => setHolidays(d.holidays ?? []))
              }
            }}
            className="px-4 py-2 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium rounded-lg transition-colors"
          >
            + New Request
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {([
          { id: 'requests', label: 'Requests' },
          { id: 'balances', label: 'Balances' },
          { id: 'calendar', label: 'Calendar' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              tab === t.id
                ? 'border-[#0E3D52] text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total',        value: stats.total,             color: 'text-foreground' },
              { label: 'Pending',      value: stats.pending,           color: 'text-yellow-400' },
              { label: 'Approved',     value: stats.approved,          color: 'text-green-400' },
              { label: 'Rejected',     value: stats.rejected,          color: 'text-red-400' },
              { label: 'Cancelled',    value: stats.cancelled,         color: 'text-gray-500' },
              { label: 'Days Approved',value: stats.totalDaysApproved, color: 'text-[#1A6080] dark:text-[#4ebac4]' },
            ].map(s => (
              <div key={s.label} className="card-premium p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters + bulk actions */}
          <div className="flex flex-wrap gap-3 items-center">
            <select value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); loadRequests(e.target.value, filterType); setSelected(new Set()) }}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]">
              <option value="">All statuses</option>
              {['pending','approved','rejected','cancelled'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <select value={filterType}
              onChange={e => { setFilterType(e.target.value); loadRequests(filterStatus, e.target.value); setSelected(new Set()) }}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]">
              <option value="">All types</option>
              {leaveTypes.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
            </select>
            {(filterStatus || filterType) && (
              <button onClick={() => { setFilterStatus(''); setFilterType(''); loadRequests('', ''); setSelected(new Set()) }}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-white px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg">
                Clear filters
              </button>
            )}
            <ExportButton onClick={handleExport} />
            {/* Bulk action bar — only for managers when pending requests exist */}
            {canApprove && pendingRequests.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={toggleSelectAll}
                  className={`text-xs px-3 py-2 rounded-lg border transition ${allPendingSelected ? 'border-[#0E3D52] text-[#1A6080] dark:text-[#4ebac4] bg-[#0E3D52]/20' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                  {allPendingSelected ? '✓ All selected' : `Select all pending (${pendingRequests.length})`}
                </button>
                {selected.size > 0 && (
                  <>
                    <span className="text-xs text-gray-500">{selected.size} selected</span>
                    <button onClick={() => bulkReview('approve')} disabled={bulkBusy}
                      className="text-xs px-3 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg transition font-medium">
                      {bulkBusy ? '…' : '✓ Approve All'}
                    </button>
                    <button onClick={() => bulkReview('reject')} disabled={bulkBusy}
                      className="text-xs px-3 py-2 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition font-medium">
                      {bulkBusy ? '…' : '✕ Reject All'}
                    </button>
                    <button onClick={() => setSelected(new Set())}
                      className="text-xs px-2 py-2 text-gray-400 hover:text-white transition">
                      ✕
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Request list */}
          {loadingReqs ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading…</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 card-premium">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">No leave requests found</p>
              <p className="text-sm text-gray-600 mt-1 dark:text-gray-400">
                {canApprove ? 'No requests match your filters' : 'Submit your first leave request above'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(r => {
                const isExpanded   = expanded === r.id
                const isBusy       = reviewing === r.id
                const isSelected   = selected.has(r.id)
                const isPending    = r.status === 'pending'
                return (
                  <div key={r.id} className={`card-premium overflow-hidden transition ${isSelected ? 'ring-2 ring-[#0E3D52] border-[#0E3D52]' : ''}`}>
                    <div className="flex items-center gap-3 px-4 py-4">
                      {/* Checkbox — only for pending, managers only */}
                      {canApprove && isPending && (
                        <input type="checkbox" checked={isSelected}
                          onChange={e => {
                            const next = new Set(selected)
                            if (e.target.checked) next.add(r.id); else next.delete(r.id)
                            setSelected(next)
                          }}
                          className="w-4 h-4 accent-[#0E3D52] shrink-0 cursor-pointer" />
                      )}
                      {canApprove && !isPending && <div className="w-4 shrink-0" />}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : r.id)}
                      className="flex-1 flex items-center gap-4 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#1A6080] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {(r.employeeFirstName?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {canApprove && (
                            <span className="text-sm font-medium text-foreground">{r.employeeFirstName} {r.employeeLastName}</span>
                          )}
                          <span className="text-xs text-gray-600 dark:text-gray-400">{typeLabel[r.leaveType] ?? r.leaveType}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
                          {fmt(r.startDate)} → {fmt(r.endDate)}
                          <span className="ml-2 text-[#1A6080] dark:text-[#4ebac4]">{r.totalDays}d</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`capitalize ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>
                          {r.status}
                        </span>
                        <span className="text-gray-600 text-xs dark:text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-5 border-t border-gray-300 dark:border-gray-700 pt-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Requested on</p>
                            <p className="text-foreground">{fmt(r.createdAt)}</p>
                          </div>
                          {r.reason && (
                            <div className="col-span-2">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Reason</p>
                              <p className="text-gray-600 dark:text-gray-300">{r.reason}</p>
                            </div>
                          )}
                          {r.reviewedAt && (
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Reviewed on</p>
                              <p className="text-foreground">{fmt(r.reviewedAt)}</p>
                            </div>
                          )}
                          {r.reviewNote && (
                            <div className="col-span-2">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Review note</p>
                              <p className="text-gray-600 dark:text-gray-300">{r.reviewNote}</p>
                            </div>
                          )}
                        </div>

                        {canApprove && r.status === 'pending' && (
                          <div className="space-y-3 pt-2 border-t border-gray-300 dark:border-gray-700">
                            <div>
                              <label className={LABEL}>Note (optional)</label>
                              <input type="text" placeholder="Add a note for the employee…"
                                value={reviewNote[r.id] ?? ''}
                                onChange={e => setReviewNote(prev => ({ ...prev, [r.id]: e.target.value }))}
                                className={INPUT} />
                            </div>
                            <div className="flex gap-3">
                              <button onClick={() => review(r.id, 'approve')} disabled={isBusy}
                                className="flex-1 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                                {isBusy ? '…' : 'Approve'}
                              </button>
                              <button onClick={() => review(r.id, 'reject')} disabled={isBusy}
                                className="flex-1 py-2 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                                {isBusy ? '…' : 'Reject'}
                              </button>
                            </div>
                          </div>
                        )}

                        {!canApprove && r.status === 'pending' && (
                          <div className="pt-2 border-t border-gray-300 dark:border-gray-700">
                            <button onClick={() => cancel(r.id)} disabled={isBusy}
                              className="px-4 py-2 border border-red-800 text-red-400 hover:bg-red-900/30 disabled:opacity-50 text-sm rounded-lg transition-colors">
                              {isBusy ? 'Cancelling…' : 'Cancel Request'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── BALANCES TAB ── */}
      {tab === 'balances' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => { const y = balYear - 1; setBalYear(y); loadBalances(y, balEmployee) }}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white transition">←</button>
              <span className="px-4 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-semibold min-w-[80px] text-center">{balYear}</span>
              <button onClick={() => { const y = balYear + 1; setBalYear(y); loadBalances(y, balEmployee) }}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white transition">→</button>
            </div>
            {canApprove && employees.length > 0 && (
              <select value={balEmployee}
                onChange={e => { setBalEmployee(e.target.value); loadBalances(balYear, e.target.value) }}
                className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]">
                <option value="">My balance</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
            )}
            <button onClick={() => loadBalances(balYear, balEmployee)}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition">
              ↻ Refresh
            </button>
          </div>

          {!balLinked ? (
            <div className="card-premium p-10 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 dark:text-gray-400">Your account is not linked to an employee record. Contact HR.</p>
            </div>
          ) : loadingBal ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Calculating balances…</div>
          ) : balances.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">No leave types configured.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {balances.map(b => {
                const pct = b.entitlement && b.entitlement < 999
                  ? Math.min(100, Math.round(((b.taken + b.pending) / b.entitlement) * 100))
                  : null
                const remainingColor = b.remaining == null ? 'text-gray-400'
                  : b.remaining === 0 ? 'text-red-400'
                  : b.remaining <= 5  ? 'text-amber-400'
                  : 'text-green-400'

                return (
                  <div key={b.key} className="card-premium p-5 space-y-3">
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
                        <p className="font-semibold text-white">
                          {b.entitlement == null || b.entitlement >= 999 ? '∞' : `${b.entitlement}d`}
                        </p>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Taken</p>
                        <p className="font-semibold text-white">{b.taken}d</p>
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
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : b.color,
                            }}
                          />
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

      {/* ── CALENDAR TAB ── */}
      {tab === 'calendar' && (
        <div className="space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                let m = calMonth - 1, y = calYear
                if (m < 1) { m = 12; y-- }
                setCalMonth(m); setCalYear(y); loadCalendar(y, m)
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white transition"
            >← Prev</button>
            <h2 className="text-lg font-semibold text-foreground">{MONTHS[calMonth - 1]} {calYear}</h2>
            <button
              onClick={() => {
                let m = calMonth + 1, y = calYear
                if (m > 12) { m = 1; y++ }
                setCalMonth(m); setCalYear(y); loadCalendar(y, m)
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white transition"
            >Next →</button>
          </div>

          {/* Legend */}
          {calEvents.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {[...new Map(calEvents.map(e => [e.leaveType, { label: e.label, emoji: e.emoji, color: e.color }])).entries()].map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ background: cfg.color }} />
                  {cfg.emoji} {cfg.label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full inline-block shrink-0 border-2 border-yellow-500 bg-transparent" />
                Pending
              </div>
            </div>
          )}

          {loadingCal ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading calendar…</div>
          ) : (
            <div className="card-premium overflow-hidden">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
                {WEEKDAYS.map(d => (
                  <div key={d} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7">
                {days.map((day, idx) => {
                  const today = new Date()
                  const isToday = day !== null
                    && today.getFullYear() === calYear
                    && today.getMonth() + 1 === calMonth
                    && today.getDate() === day

                  const dayEvents = day !== null ? eventsOnDay(calYear, calMonth, day) : []

                  return (
                    <div
                      key={idx}
                      className={`min-h-[90px] border-r border-b border-gray-200 dark:border-gray-800 p-1.5 last:border-r-0 ${
                        !day ? 'bg-gray-900/30' : 'bg-gray-900'
                      }`}
                    >
                      {day && (
                        <>
                          <p className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday ? 'bg-[#0E3D52] text-white' : 'text-gray-400'
                          }`}>
                            {day}
                          </p>
                          <div className="space-y-0.5">
                            {dayEvents.slice(0, 3).map(ev => (
                              <div
                                key={ev.id}
                                className="text-[10px] leading-tight px-1 py-0.5 rounded truncate"
                                style={{
                                  background: `${ev.color}22`,
                                  borderLeft: `2px solid ${ev.status === 'pending' ? '#eab308' : ev.color}`,
                                  color: ev.color,
                                }}
                                title={`${ev.employeeName} — ${ev.label} (${ev.status})\n${fmtShort(ev.startDate)} → ${fmtShort(ev.endDate)}`}
                              >
                                {canApprove ? ev.employeeName || ev.emoji : ev.emoji} {ev.label}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <p className="text-[10px] text-gray-600 dark:text-gray-400">+{dayEvents.length - 3} more</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {calEvents.length === 0 && !loadingCal && (
            <p className="text-center text-sm text-gray-600 py-4 dark:text-gray-400">No approved or pending leave in {MONTHS[calMonth - 1]} {calYear}.</p>
          )}
        </div>
      )}

      {/* ── NEW REQUEST MODAL ── */}
      {showForm && (
        <div className="modal-overlay">
          <form onSubmit={submit}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">New Leave Request</h2>
              <button type="button" onClick={() => { setShowForm(false); setFormError(null) }}
                className="text-gray-500 hover:text-white text-2xl leading-none dark:text-gray-400">×</button>
            </div>

            {canApprove && (
              <div>
                <label className={LABEL}>Employee</label>
                <select value={form.employeeId}
                  onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                  className={INPUT}>
                  <option value="">— My own request —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={LABEL}>Leave Type *</label>
              <select value={form.leaveType}
                onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}
                className={INPUT} required>
                {leaveTypes.map(t => (
                  <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>
                ))}
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
              <div className="bg-[#f0f7fb] dark:bg-[#0E3D52]/30 border border-[#b8d4e0] dark:border-[#1A6080] rounded-lg px-4 py-2.5">
                <p className="text-sm text-[#4ebac4] font-medium">
                  {computedDays} calendar day{computedDays !== 1 ? 's' : ''} requested
                </p>
                {overlappingHolidays.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs text-amber-400 font-medium">
                      Public holiday{overlappingHolidays.length > 1 ? 's' : ''} in this period:
                    </p>
                    {overlappingHolidays.map(h => (
                      <p key={h.date} className="text-xs text-amber-300 pl-2">
                        {fmtShort(h.date)} — {h.name}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className={LABEL}>Reason (optional)</label>
              <textarea value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className={INPUT + ' min-h-[70px] resize-none'}
                placeholder="Brief description…" />
            </div>

            {formError && (
              <div className="bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-700 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {formError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving || computedDays <= 0}
                className="flex-1 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
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
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
