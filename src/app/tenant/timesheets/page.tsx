'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useState, useEffect, useCallback } from 'react'
import PermissionGate from '@/components/auth/PermissionGate'
import { usePermissions } from '@/hooks/usePermissions'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'

// ── Types ──────────────────────────────────────────────────────────────────────

type Timesheet = {
  id: string
  employeeId: string
  shiftId: string | null
  clockIn: string | null
  clockOut: string | null
  breakMinutes: number | null
  hoursWorked: string | null
  notes: string | null
  status: string
  approvedAt: string | null
  rejectedReason: string | null
  createdAt: string | null
  empFirst: string | null
  empLast: string | null
  empEmail: string | null
  shiftStart: string | null
  shiftEnd: string | null
  shiftType: string | null
  location: string | null
  partFirst: string | null
  partLast: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  submitted: 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/20 dark:text-[#4ebac4]',
  approved:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-AU', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}

// ── Reject modal ───────────────────────────────────────────────────────────────

function RejectModal({ onConfirm, onClose }: {
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="modal-overlay">
      <div className="card-premium w-full max-w-sm shadow-lg">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-gray-900 dark:text-white">Reject Timesheet</h3>
        </div>
        <div className="p-6 space-y-3">
          <label className="block text-xs font-semibold text-gray-500  mb-1 dark:text-gray-400">
            Reason *
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this timesheet is being rejected…"
            className="w-full input-premium resize-none"
          />
          <div className="flex gap-2 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              Cancel
            </button>
            <button
              onClick={() => reason.trim() && onConfirm(reason.trim())}
              disabled={!reason.trim()}
              className="flex-1 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition">
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Clock card (employee) ──────────────────────────────────────────────────────

function ClockCard({ onAction }: { onAction: () => void }) {
  const [status,      setStatus]      = useState<'idle' | 'clocked_in' | 'loading'>('loading')
  const [clockInTime, setClockInTime] = useState<string | null>(null)
  const [elapsed,     setElapsed]     = useState('')
  const [breakMins,   setBreakMins]   = useState('0')
  const [notes,       setNotes]       = useState('')
  const [error,       setError]       = useState('')

  async function fetchStatus() {
    try {
      const r = await fetchWithAuth('/api/tenant/timesheets?status=pending&limit=1')
      const d = await r.json()
      const open = (d.timesheets ?? []).find((t: Timesheet) => t.clockIn && !t.clockOut)
      if (open) {
        setStatus('clocked_in')
        setClockInTime(open.clockIn)
      } else {
        setStatus('idle')
        setClockInTime(null)
      }
    } catch { setStatus('idle') }
  }

  useEffect(() => { fetchStatus() }, [])

  // Live elapsed timer
  useEffect(() => {
    if (status !== 'clocked_in' || !clockInTime) { setElapsed(''); return }
    const tick = () => {
      const ms  = Date.now() - new Date(clockInTime).getTime()
      const h   = Math.floor(ms / 3_600_000)
      const m   = Math.floor((ms % 3_600_000) / 60_000)
      const s   = Math.floor((ms % 60_000) / 1_000)
      setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [status, clockInTime])

  async function clockIn() {
    setError('')
    try {
      const r = await fetchWithAuth('/api/tenant/timesheets/clock-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'Failed to clock in'); return }
      setStatus('clocked_in'); setClockInTime(d.clockIn); onAction()
    } catch { setError('Network error') }
  }

  async function clockOut() {
    setError('')
    try {
      const r = await fetchWithAuth('/api/tenant/timesheets/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breakMinutes: Number(breakMins) || 0, notes: notes || undefined }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'Failed to clock out'); return }
      setStatus('idle'); setClockInTime(null); setBreakMins('0'); setNotes(''); onAction()
    } catch { setError('Network error') }
  }

  if (status === 'loading') {
    return (
      <div className="card-premium p-6 text-sm text-gray-600 dark:text-gray-400">
        Loading clock status…
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border p-6 transition ${
      status === 'clocked_in'
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : 'card-premium'
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400  mb-1">
            {status === 'clocked_in' ? 'Currently Clocked In' : 'Clock Status'}
          </p>
          {status === 'clocked_in' ? (
            <>
              <p className="text-3xl font-mono font-bold text-green-700 dark:text-green-400">{elapsed}</p>
              <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">Started {fmtTime(clockInTime)}</p>
            </>
          ) : (
            <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Not clocked in</p>
          )}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>

        {status === 'clocked_in' ? (
          <div className="flex flex-col gap-2 min-w-[200px]">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">Break (mins)</label>
                <input type="number" min="0" value={breakMins} onChange={e => setBreakMins(e.target.value)}
                  className="w-full input-premium py-1.5" />
              </div>
            </div>
            <input type="text" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full input-premium py-1.5" />
            <button onClick={clockOut}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition">
              Clock Out
            </button>
          </div>
        ) : (
          <button onClick={clockIn}
            className="px-8 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: 'var(--primary)' }}>
            Clock In
          </button>
        )}
      </div>
    </div>
  )
}

// ── Timesheet row ──────────────────────────────────────────────────────────────

function TimesheetRow({
  ts, isManager, onApprove, onReject, onDelete, isSelected, onToggleSelect,
}: {
  ts: Timesheet
  isManager: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onDelete: (id: string) => void
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const c = STATUS_COLOURS[ts.status] ?? STATUS_COLOURS.pending
  const approvable = ts.status === 'pending' || ts.status === 'submitted'
  return (
    <tr className={`hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition border-b border-gray-50 dark:border-gray-800 ${isSelected ? 'bg-green-50/50 dark:bg-green-900/10' : ''}`}>
      {isManager && (
        <td className="px-3 py-3 w-10">
          {approvable && (
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={() => onToggleSelect?.(ts.id)}
              className="accent-green-600 w-4 h-4 cursor-pointer"
            />
          )}
        </td>
      )}
      {isManager && (
        <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap">
          <div className="font-medium">{ts.empFirst} {ts.empLast}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{ts.empEmail}</div>
        </td>
      )}
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {fmtDate(ts.clockIn)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {fmtTime(ts.clockIn)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
        {ts.clockOut ? fmtTime(ts.clockOut) : <span className="text-yellow-600 dark:text-yellow-400">Active</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 text-right whitespace-nowrap">
        {ts.breakMinutes != null && ts.breakMinutes > 0 ? `${ts.breakMinutes}m` : '—'}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200 text-right whitespace-nowrap">
        {ts.hoursWorked ? `${ts.hoursWorked}h` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        {ts.shiftType && (
          <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 mr-1">
            {ts.shiftType.replace(/_/g,' ')}
          </span>
        )}
        {ts.location && <span className="text-xs">{ts.location}</span>}
        {ts.partFirst && <div className="text-xs text-gray-600 dark:text-gray-400">{ts.partFirst} {ts.partLast}</div>}
        {ts.notes && <div className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[180px]">{ts.notes}</div>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${c}`}>
          {ts.status}
        </span>
        {ts.rejectedReason && (
          <div className="text-xs text-red-500 mt-0.5 max-w-[140px] truncate" title={ts.rejectedReason}>
            {ts.rejectedReason}
          </div>
        )}
      </td>
      {isManager && (
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex gap-1.5 items-center">
            {ts.status === 'submitted' && (
              <>
                <button onClick={() => onApprove(ts.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition">
                  Approve
                </button>
                <button onClick={() => onReject(ts.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                  Reject
                </button>
              </>
            )}
            {ts.status === 'approved' && (
              <span className="text-xs text-gray-600 dark:text-gray-400">{fmtDateTime(ts.approvedAt)}</span>
            )}
            {ts.status === 'pending' && (
              <button onClick={() => onDelete(ts.id)}
                title="Delete timesheet"
                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TimesheetsPage() {
  const { can } = usePermissions()
  const isManager = can('timesheets:approve')

  const [timesheets,   setTimesheets]   = useState<Timesheet[]>([])
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [weekStart,    setWeekStart]    = useState<Date>(getMondayOf(new Date()))
  const [rejectId,     setRejectId]     = useState<string | null>(null)
  const [selected,     setSelected]     = useState<Set<string>>(new Set())
  const [bulkApproving,setBulkApproving]= useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [toast,        setToast]        = useState<ToastState>(null)

  const fetchTimesheets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('weekStart', isoDate(weekStart))
      const r = await fetchWithAuth(`/api/tenant/timesheets?${params}`)
      const d = await r.json()
      setTimesheets(d.timesheets ?? [])
    } finally { setLoading(false) }
  }, [statusFilter, weekStart])

  useEffect(() => { fetchTimesheets() }, [fetchTimesheets])

  async function approve(id: string) {
    await fetchWithAuth(`/api/tenant/timesheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    fetchTimesheets()
  }

  async function reject(id: string, reason: string) {
    await fetchWithAuth(`/api/tenant/timesheets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason }),
    })
    setRejectId(null)
    fetchTimesheets()
  }

  async function bulkApprove() {
    if (selected.size === 0) return
    setBulkApproving(true)
    await fetchWithAuth('/api/tenant/timesheets/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    })
    setSelected(new Set())
    setBulkApproving(false)
    fetchTimesheets()
  }

  function deleteTimesheet(id: string) {
    setConfirmState({
      message: 'Delete this timesheet entry? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        const r = await fetchWithAuth(`/api/tenant/timesheets/${id}`, { method: 'DELETE' })
        if (r.ok) {
          setTimesheets(prev => prev.filter(t => t.id !== id))
          setToast({ message: 'Timesheet deleted', type: 'success' })
        } else {
          const d = await r.json()
          setToast({ message: d.error ?? 'Failed to delete timesheet', type: 'error' })
        }
        setConfirmState(null)
      },
    })
  }

  const approvable = timesheets.filter(t => t.status === 'pending' || t.status === 'submitted')
  const allSelected = approvable.length > 0 && approvable.every(t => selected.has(t.id))

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(approvable.map(t => t.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exportTimesheets() {
    exportCsv<Timesheet & Record<string, unknown>>({
      filename: 'timesheets.csv',
      columns: [
        { header: 'Employee',        key: 'empFirst',        format: (_, row) => `${row.empFirst ?? ''} ${row.empLast ?? ''}`.trim() },
        { header: 'Clock In',        key: 'clockIn',         format: v => fmtCsvDate(v) },
        { header: 'Clock Out',       key: 'clockOut',        format: v => fmtCsvDate(v) },
        { header: 'Hours Worked',    key: 'hoursWorked' },
        { header: 'Status',          key: 'status' },
        { header: 'Approved At',     key: 'approvedAt',      format: v => fmtCsvDate(v) },
        { header: 'Rejected Reason', key: 'rejectedReason' },
      ],
      rows: timesheets as (Timesheet & Record<string, unknown>)[],
    })
  }

  // Summary stats
  const totalHours   = timesheets.reduce((s, t) => s + parseFloat(t.hoursWorked ?? '0'), 0)
  const pendingCount = timesheets.filter(t => t.status === 'submitted').length

  const weekDayLabels = Array.from({ length: 7 }, (_, i) =>
    addDays(weekStart, i).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
  )

  return (
    <div className="space-y-5">
      {rejectId && (
        <RejectModal onConfirm={r => reject(rejectId, r)} onClose={() => setRejectId(null)} />
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-premium-title">Timesheets</h1>
          <p className="page-premium-subtitle mt-0.5">
            {weekDayLabels[0]} — {weekDayLabels[6]}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Week nav */}
          <div className="flex items-center card-premium overflow-hidden">
            <button onClick={() => setWeekStart(w => addDays(w, -7))}
              className="px-3 py-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm dark:text-gray-400">←</button>
            <button onClick={() => setWeekStart(getMondayOf(new Date()))}
              className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-x border-gray-200 dark:border-gray-700 transition">
              This week
            </button>
            <button onClick={() => setWeekStart(w => addDays(w, 7))}
              className="px-3 py-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm dark:text-gray-400">→</button>
          </div>
          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="card-premium px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none">
            <option value="">All statuses</option>
            <option value="pending">Pending (active)</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {/* Bulk approve button — only shown when manager has selected some timesheets */}
          {isManager && selected.size > 0 && (
            <button
              onClick={bulkApprove}
              disabled={bulkApproving}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition"
            >
              {bulkApproving ? 'Approving…' : `✓ Approve ${selected.size} selected`}
            </button>
          )}
          <ExportButton onClick={exportTimesheets} disabled={timesheets.length === 0} />
        </div>
      </div>

      {/* Clock in/out card — only for non-managers (employees) */}
      {!isManager && (
        <ClockCard onAction={fetchTimesheets} />
      )}

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Entries',    value: timesheets.length,                                        color: 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]' },
          { label: 'Hours',      value: `${totalHours.toFixed(1)}h`,                              color: 'text-[#0E3D52] dark:text-[#4ebac4]' },
          { label: 'Pending',    value: timesheets.filter(t => t.status === 'pending').length,    color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Submitted',  value: pendingCount,                                             color: 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]' },
          { label: 'Approved',   value: timesheets.filter(t => t.status === 'approved').length,   color: 'text-green-600 dark:text-green-400' },
        ].map(c => (
          <div key={c.label} className="card-premium px-4 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${c.color}`}>{c.value}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card-premium overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400 text-sm">Loading timesheets…</div>
        ) : timesheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600 dark:text-gray-400 text-sm gap-2">
            <span className="text-3xl"></span>
            <span>No timesheet entries this week.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-premium">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  {isManager && (
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="accent-green-600 w-4 h-4 cursor-pointer"
                        title="Select all approvable timesheets"
                      />
                    </th>
                  )}
                  {isManager && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 ">
                      Employee
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 ">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 ">Start</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 ">End</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 ">Break</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 ">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 ">Details</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 ">Status</th>
                  {isManager && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 ">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {timesheets.map(ts => (
                  <TimesheetRow
                    key={ts.id}
                    ts={ts}
                    isManager={isManager}
                    onApprove={approve}
                    onReject={id => setRejectId(id)}
                    onDelete={deleteTimesheet}
                    isSelected={selected.has(ts.id)}
                    onToggleSelect={toggleOne}
                  />
                ))}
              </tbody>
              {isManager && (
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                    <td colSpan={5} className="px-4 py-2 section-label">
                      Total
                    </td>
                    <td className="px-4 py-2 text-sm font-bold text-gray-800 dark:text-gray-200 text-right">
                      {totalHours.toFixed(1)}h
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
