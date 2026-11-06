'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useState, useEffect, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import PermissionGate from '@/components/auth/PermissionGate'
import EmptyState from '@/components/ui/EmptyState'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv } from '@/lib/exportCsv'

// ── Types ──────────────────────────────────────────────────────────────────────

type Shift = {
  id: string
  employeeId: string
  participantId: string | null
  startTime: string
  endTime: string
  shiftType: string | null
  location: string | null
  clientSite: string | null
  status: string
  publishedAt: string | null
  notes: string | null
  empFirst: string | null
  empLast: string | null
  empEmail: string | null
  partFirst: string | null
  partLast: string | null
  partNdis: string | null
}

type Employee = {
  id: string
  firstName: string
  lastName: string
  employmentType: string
}

type Participant = {
  id: string
  firstName: string
  lastName: string
  ndisNumber: string | null
}

type ShiftFormData = {
  employeeId: string
  participantId: string
  date: string
  startHour: string
  startMin: string
  endHour: string
  endMin: string
  shiftType: string
  location: string
  clientSite: string
  notes: string
}

type AvailabilitySlot = {
  id: string
  employeeId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isAvailable: boolean
  note: string | null
}

type FillResult = {
  created: number
  skipped: number
  failed: number
  results: Array<{ shiftId: string; status: string; reason?: string }>
  message?: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const SHIFT_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  standard:     { bg: 'bg-[#E0EEF4] dark:bg-[#0E3D52]/20',    text: 'text-blue-800 dark:text-blue-200',    border: 'border-blue-300 dark:border-[#0E3D52]' },
  sleepover:    { bg: 'bg-[#E0EEF4] dark:bg-[#0E3D52]/40', text: 'text-[#1A6080] dark:text-[#9ccfda]', border: 'border-[#9ccfda] dark:border-[#0E3D52]' },
  active_night: { bg: 'bg-[#E0EEF4] dark:bg-[#0E3D52]/20', text: 'text-[#0E3D52] dark:text-[#9ccfda]', border: 'border-[#b8d4e0] dark:border-[#0E3D52]' },
  on_call:      { bg: 'bg-amber-100 dark:bg-amber-900/40',   text: 'text-amber-800 dark:text-amber-200',   border: 'border-amber-300 dark:border-amber-600' },
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  confirmed: 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/20 dark:text-[#4ebac4]',
  completed: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtDate(date: Date) {
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function shiftDuration(start: string, end: string) {
  const hrs = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000
  return `${hrs.toFixed(1)}h`
}

// ── Availability modal ─────────────────────────────────────────────────────────

function AvailabilityModal({
  employeeId,
  employeeName,
  slots,
  onSave,
  onDelete,
  onClose,
}: {
  employeeId: string
  employeeName: string
  slots: AvailabilitySlot[]
  onSave: (dayOfWeek: number, startTime: string, endTime: string, isAvailable: boolean, note: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({
    dayOfWeek: 0,
    startTime: '09:00',
    endTime: '17:00',
    isAvailable: true,
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      await onSave(form.dayOfWeek, form.startTime, form.endTime, form.isAvailable, form.note)
      setForm(f => ({ ...f, note: '' }))
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="card-premium w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Availability</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{employeeName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">✕</button>
        </div>

        {/* Existing slots */}
        <div className="px-6 pt-4">
          {slots.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No availability set yet.</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {slots.map(slot => (
                <li key={slot.id} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-sm ${slot.isAvailable ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-300'}`}>
                  <span className="font-medium">{DAYS[slot.dayOfWeek]}</span>
                  <span>{slot.startTime} – {slot.endTime}</span>
                  <span className="flex-1 text-xs opacity-70 truncate">{slot.note ?? (slot.isAvailable ? 'Available' : 'Unavailable')}</span>
                  <button onClick={() => onDelete(slot.id)} className="text-xs opacity-50 hover:opacity-100 hover:text-red-500 transition">✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add slot form */}
        <form onSubmit={handleSave} className="px-6 pb-6 space-y-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 ">Add / update slot</p>
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Day</label>
              <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Status</label>
              <select value={form.isAvailable ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, isAvailable: e.target.value === 'yes' }))}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
                <option value="yes">Available</option>
                <option value="no">Unavailable</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">From</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">To</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Note (optional)</label>
            <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Prefer mornings"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              Close
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              {saving ? 'Saving…' : 'Save slot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Fill Timesheets modal ──────────────────────────────────────────────────────

function FillTimesheetsModal({
  weekStart,
  onClose,
}: {
  weekStart: Date
  onClose: () => void
}) {
  const [running, setRunning] = useState(false)
  const [result, setResult]   = useState<FillResult | null>(null)
  const [error, setError]     = useState('')

  async function run() {
    setRunning(true); setError('')
    try {
      const res = await fetchWithAuth('/api/tenant/roster/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: isoDate(weekStart) }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Failed'); return }
      setResult(d)
    } catch { setError('Request failed') }
    finally { setRunning(false) }
  }

  return (
    <div className="modal-overlay">
      <div className="card-premium w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Fill Timesheets</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Auto-create timesheet entries from <strong>published, confirmed, and completed</strong> shifts for the week of{' '}
            <strong>{fmtDate(weekStart)} — {fmtDate(addDays(weekStart, 6))}</strong>.
            Shifts that already have a timesheet are skipped.
          </p>

          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          {result && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
              <div className="grid grid-cols-3 text-center py-3">
                <div>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.created}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-500 dark:text-gray-400">{result.skipped}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Skipped</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{result.failed}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
                </div>
              </div>
              {result.message && (
                <p className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{result.message}</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button onClick={run} disabled={running}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition hover:opacity-90"
                style={{ background: 'var(--primary)' }}>
                {running ? 'Filling…' : 'Fill Timesheets'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shift modal ────────────────────────────────────────────────────────────────

function ShiftModal({
  mode, initialData, employees, participants, onSave, onDelete, onRepeat, onClose,
}: {
  mode: 'create' | 'edit'
  initialData: Partial<ShiftFormData> & { id?: string }
  employees: Employee[]
  participants: Participant[]
  onSave: (data: ShiftFormData & { id?: string }) => Promise<void>
  onDelete?: () => Promise<void>
  onRepeat?: () => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<ShiftFormData>({
    employeeId:    initialData.employeeId    ?? '',
    participantId: initialData.participantId ?? '',
    date:          initialData.date          ?? isoDate(new Date()),
    startHour:     initialData.startHour     ?? '09',
    startMin:      initialData.startMin      ?? '00',
    endHour:       initialData.endHour       ?? '17',
    endMin:        initialData.endMin        ?? '00',
    shiftType:     initialData.shiftType     ?? 'standard',
    location:      initialData.location      ?? '',
    clientSite:    initialData.clientSite    ?? '',
    notes:         initialData.notes         ?? '',
  })
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [repeating, setRepeating] = useState(false)
  const [error,     setError]     = useState('')
  const [repeated,  setRepeated]  = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const f = (k: keyof ShiftFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employeeId) { setError('Please select an employee'); return }
    setSaving(true); setError('')
    try {
      await onSave({ ...form, id: initialData.id })
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    setConfirmState({
      message: 'Delete this shift?',
      onConfirm: async () => {
        setDeleting(true)
        try { await onDelete() } finally { setDeleting(false) }
      }
    })
  }

  async function handleRepeat() {
    if (!onRepeat) return
    setRepeating(true); setError('')
    try {
      await onRepeat()
      setRepeated(true)
    } catch (err: any) {
      setError(err.message ?? 'Failed to repeat')
    } finally {
      setRepeating(false)
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const mins  = ['00', '15', '30', '45']

  return (
    <div className="modal-overlay">
      <div className="card-premium w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Add Shift' : 'Edit Shift'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">✕</button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Employee *</label>
            <select value={form.employeeId} onChange={f('employeeId')} required
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
              <option value="">Select employee…</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">NDIS Participant</label>
            <select value={form.participantId} onChange={f('participantId')}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
              <option value="">No participant linked</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}{p.ndisNumber ? ` (${p.ndisNumber})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Date *</label>
              <input type="date" value={form.date} onChange={f('date')} required
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Shift Type</label>
              <select value={form.shiftType} onChange={f('shiftType')}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
                <option value="standard">Standard</option>
                <option value="sleepover">Sleepover</option>
                <option value="active_night">Active Night</option>
                <option value="on_call">On-Call</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Start</label>
              <div className="flex gap-1">
                <select value={form.startHour} onChange={f('startHour')}
                  className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
                  {hours.map(h => <option key={h}>{h}</option>)}
                </select>
                <span className="self-center text-gray-600 dark:text-gray-400 text-sm">:</span>
                <select value={form.startMin} onChange={f('startMin')}
                  className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
                  {mins.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">End</label>
              <div className="flex gap-1">
                <select value={form.endHour} onChange={f('endHour')}
                  className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
                  {hours.map(h => <option key={h}>{h}</option>)}
                </select>
                <span className="self-center text-gray-600 dark:text-gray-400 text-sm">:</span>
                <select value={form.endMin} onChange={f('endMin')}
                  className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none">
                  {mins.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Location</label>
              <input type="text" value={form.location} onChange={f('location')} placeholder="Site / address"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Client Site</label>
              <input type="text" value={form.clientSite} onChange={f('clientSite')} placeholder="Property name"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1  dark:text-gray-400">Notes</label>
            <textarea value={form.notes} onChange={f('notes')} rows={2} placeholder="Care instructions, special notes…"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none resize-none" />
          </div>

          <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
          <div className="flex gap-3 pt-1 flex-wrap">
            {mode === 'edit' && onDelete && (
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
            {mode === 'edit' && onRepeat && (
              <button type="button" onClick={handleRepeat} disabled={repeating || repeated}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#b8d4e0] dark:border-[#1A6080] text-[#0E3D52] dark:text-[#4ebac4] hover:bg-[#f0f7fb] dark:hover:bg-[#0E3D52]/20 disabled:opacity-50 transition">
                {repeated ? '✓ Repeated' : repeating ? 'Repeating…' : '↻ Repeat next week'}
              </button>
            )}
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition hover:opacity-90"
              style={{ background: 'var(--primary)' }}>
              {saving ? 'Saving…' : mode === 'create' ? 'Add Shift' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function RosteringPage() {
  const [weekStart,    setWeekStart]    = useState<Date>(getMondayOf(new Date()))
  const [shifts,       setShifts]       = useState<Shift[]>([])
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([])
  const [loading,      setLoading]      = useState(true)
  const [publishing,   setPublishing]   = useState(false)
  const [showAvail,    setShowAvail]    = useState(false) // toggle availability row
  const [showFill,     setShowFill]     = useState(false) // fill timesheets modal
  const [availModal,   setAvailModal]   = useState<{ empId: string; empName: string } | null>(null)

  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const [modal, setModal] = useState<{
    mode: 'create' | 'edit'
    data: Partial<ShiftFormData> & { id?: string }
  } | null>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const empMap = new Map<string, Employee>()
  employees.forEach(e => empMap.set(e.id, e))

  const empIdsInWeek = [...new Set(shifts.map(s => s.employeeId))]
  const visibleEmployees = empIdsInWeek
    .map(id => {
      const fromApi = empMap.get(id)
      if (fromApi) return fromApi
      const s = shifts.find(x => x.employeeId === id)
      return { id, firstName: s?.empFirst ?? '?', lastName: s?.empLast ?? '', employmentType: '' }
    })
    .sort((a, b) => a.firstName.localeCompare(b.firstName))

  // Build availability map: empId → dayOfWeek → slot
  const availMap = new Map<string, Map<number, AvailabilitySlot>>()
  for (const slot of availability) {
    if (!availMap.has(slot.employeeId)) availMap.set(slot.employeeId, new Map())
    availMap.get(slot.employeeId)!.set(slot.dayOfWeek, slot)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [sd, ed, pd, avd] = await Promise.all([
        fetchWithAuth(`/api/tenant/roster/shifts?weekStart=${isoDate(weekStart)}`).then(r => r.json()),
        fetchWithAuth('/api/tenant/employees?limit=200&status=active').then(r => r.json()),
        fetchWithAuth('/api/tenant/participants').then(r => r.json()),
        fetchWithAuth('/api/tenant/roster/availability').then(r => r.json()),
      ])
      setShifts(sd.shifts ?? [])
      setEmployees(ed.employees ?? [])
      setParticipants(pd.participants ?? [])
      setAvailability(avd.availability ?? [])
    } catch {
      setShifts([])
    } finally {
      setLoading(false)
    }
  }, [weekStart])

  useEffect(() => { fetchData() }, [fetchData])

  const draftCount  = shifts.filter(s => s.status === 'draft').length
  const totalHours  = shifts.reduce((sum, s) =>
    sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3_600_000, 0)

  async function publishAll() {
    setConfirmState({
      message: `Publish ${draftCount} draft shift${draftCount !== 1 ? 's' : ''}? Employees will be notified.`,
      confirmLabel: 'Publish',
      danger: false,
      onConfirm: async () => {
        setPublishing(true)
        try {
          const drafts = shifts.filter(s => s.status === 'draft')
          await Promise.all(drafts.map(s =>
            fetchWithAuth(`/api/tenant/roster/shifts/${s.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ publish: true }),
            })
          ))
          await fetchData()
        } finally { setPublishing(false) }
      }
    })
  }

  function openCreate(date: Date, employeeId?: string) {
    setModal({ mode: 'create', data: {
      date: isoDate(date), startHour: '09', startMin: '00',
      endHour: '17', endMin: '00', employeeId: employeeId ?? '', shiftType: 'standard',
    }})
  }

  function openEdit(shift: Shift) {
    const s = new Date(shift.startTime)
    const e = new Date(shift.endTime)
    setModal({ mode: 'edit', data: {
      id: shift.id,
      employeeId: shift.employeeId, participantId: shift.participantId ?? '',
      date: isoDate(s),
      startHour: String(s.getHours()).padStart(2,'0'), startMin: String(s.getMinutes()).padStart(2,'0'),
      endHour:   String(e.getHours()).padStart(2,'0'), endMin:   String(e.getMinutes()).padStart(2,'0'),
      shiftType: shift.shiftType ?? 'standard',
      location: shift.location ?? '', clientSite: shift.clientSite ?? '', notes: shift.notes ?? '',
    }})
  }

  async function handleSave(data: ShiftFormData & { id?: string }) {
    const startTime = `${data.date}T${data.startHour}:${data.startMin}:00`
    const endTime   = `${data.date}T${data.endHour}:${data.endMin}:00`
    const payload   = {
      employeeId: data.employeeId, participantId: data.participantId || null,
      startTime, endTime,
      shiftType: data.shiftType, location: data.location || null,
      clientSite: data.clientSite || null, notes: data.notes || null,
    }
    if (data.id) {
      await fetchWithAuth(`/api/tenant/roster/shifts/${data.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
    } else {
      await fetchWithAuth('/api/tenant/roster/shifts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
    }
    setModal(null)
    await fetchData()
  }

  async function handleDelete() {
    if (!modal?.data.id) return
    await fetchWithAuth(`/api/tenant/roster/shifts/${modal.data.id}`, { method: 'DELETE' })
    setModal(null)
    await fetchData()
  }

  async function handleRepeat() {
    if (!modal?.data.id || !modal.data.date) return
    const origDate = new Date(modal.data.date)
    const nextDate = addDays(origDate, 7)
    const startTime = `${isoDate(nextDate)}T${modal.data.startHour}:${modal.data.startMin}:00`
    const endTime   = `${isoDate(nextDate)}T${modal.data.endHour}:${modal.data.endMin}:00`
    await fetchWithAuth('/api/tenant/roster/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId:    modal.data.employeeId,
        participantId: modal.data.participantId || null,
        startTime, endTime,
        shiftType:  modal.data.shiftType  || 'standard',
        location:   modal.data.location   || null,
        clientSite: modal.data.clientSite || null,
        notes:      modal.data.notes      || null,
      }),
    })
    // No modal close — let user see the "✓ Repeated" confirmation
  }

  // Availability helpers
  async function saveAvailability(empId: string, dayOfWeek: number, startTime: string, endTime: string, isAvailable: boolean, note: string) {
    const res = await fetchWithAuth('/api/tenant/roster/availability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: empId, dayOfWeek, startTime, endTime, isAvailable, note }),
    })
    if (!res.ok) throw new Error('Failed to save')
    await fetchData()
  }

  async function deleteAvailability(id: string) {
    await fetchWithAuth(`/api/tenant/roster/availability?id=${id}`, { method: 'DELETE' })
    await fetchData()
  }

  function getShiftsFor(empId: string, day: Date) {
    const d = isoDate(day)
    return shifts.filter(s => s.employeeId === empId && s.startTime.startsWith(d))
  }

  function exportRosterCsv() {
    exportCsv({
      filename: 'roster',
      columns: [
        { header: 'Employee Name', key: 'empFirst',   format: (v, r) => `${r.empFirst ?? ''} ${r.empLast ?? ''}`.trim() },
        { header: 'Shift Date',    key: 'startTime',  format: v => v ? (v as string).split('T')[0] : '' },
        { header: 'Start Time',    key: 'startTime',  format: v => v ? fmtTime(v as string) : '' },
        { header: 'End Time',      key: 'endTime',    format: v => v ? fmtTime(v as string) : '' },
        { header: 'Hours',         key: 'startTime',  format: (v, r) => r.startTime && r.endTime ? shiftDuration(r.startTime, r.endTime) : '' },
        { header: 'Department',    key: 'clientSite', format: v => (v as string) ?? '' },
        { header: 'Position',      key: 'shiftType',  format: v => (v as string) ?? '' },
        { header: 'Status',        key: 'status' },
      ],
      rows: shifts,
    })
  }

  return (
    <div className="space-y-5">
      {modal && (
        <ShiftModal
          mode={modal.mode} initialData={modal.data}
          employees={employees} participants={participants}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
          onRepeat={modal.mode === 'edit' ? handleRepeat : undefined}
          onClose={() => setModal(null)}
        />
      )}

      {availModal && (
        <AvailabilityModal
          employeeId={availModal.empId}
          employeeName={availModal.empName}
          slots={availability.filter(a => a.employeeId === availModal.empId)}
          onSave={(day, start, end, isAvail, note) =>
            saveAvailability(availModal.empId, day, start, end, isAvail, note)}
          onDelete={deleteAvailability}
          onClose={() => setAvailModal(null)}
        />
      )}

      {showFill && (
        <FillTimesheetsModal weekStart={weekStart} onClose={() => setShowFill(false)} />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-premium-title">Roster</h1>
          <p className="page-premium-subtitle mt-0.5">
            {fmtDate(weekStart)} — {fmtDate(addDays(weekStart, 6))}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center card-premium overflow-hidden">
            <button onClick={() => setWeekStart(w => addDays(w, -7))}
              className="px-3 py-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm dark:text-gray-400">←</button>
            <button onClick={() => setWeekStart(getMondayOf(new Date()))}
              className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-x border-gray-200 dark:border-gray-700 transition">
              Today
            </button>
            <button onClick={() => setWeekStart(w => addDays(w, 7))}
              className="px-3 py-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm dark:text-gray-400">→</button>
          </div>

          {/* Availability toggle */}
          <button
            onClick={() => setShowAvail(v => !v)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border transition ${showAvail ? 'bg-teal-600 border-teal-600 text-white' : 'border-teal-500 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'}`}>
            {showAvail ? '✓ Availability' : '👁 Availability'}
          </button>

          <PermissionGate permission="rostering:write">
            <>
              {/* Fill timesheets */}
              <button onClick={() => setShowFill(true)}
                className="px-3 py-2 rounded-xl text-sm font-semibold border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                📋 Fill Timesheets
              </button>

              {draftCount > 0 && (
                <button onClick={publishAll} disabled={publishing}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition">
                  {publishing ? 'Publishing…' : `Publish ${draftCount} draft${draftCount !== 1 ? 's' : ''}`}
                </button>
              )}
              <ExportButton onClick={exportRosterCsv} disabled={shifts.length === 0} />
              <button onClick={() => openCreate(weekStart)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: 'var(--primary)' }}>
                + Add Shift
              </button>
            </>
          </PermissionGate>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Shifts',      value: shifts.length,                                        color: 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]' },
          { label: 'Total hours', value: `${totalHours.toFixed(1)}h`,                          color: 'text-[#0E3D52] dark:text-[#4ebac4]' },
          { label: 'Draft',       value: draftCount,                                           color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Published',   value: shifts.filter(s => s.status === 'published').length,  color: 'text-green-600 dark:text-green-400' },
          { label: 'Staff',       value: new Set(shifts.map(s => s.employeeId)).size,          color: 'text-gray-700 dark:text-gray-300' },
        ].map(c => (
          <div key={c.label} className="card-premium px-4 py-2 flex items-center gap-2">
            <span className={`text-lg font-bold ${c.color}`}>{c.value}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="card-premium overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-600 dark:text-gray-400 text-sm">Loading roster…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-premium">
              <thead>
                <tr>
                  <th className="w-36 px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400  bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-100 dark:border-gray-700">
                    Employee
                  </th>
                  {weekDays.map((day, i) => {
                    const isToday = isoDate(day) === isoDate(new Date())
                    return (
                      <th key={i} className={`px-2 py-3 text-center bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 ${i < 6 ? 'border-r border-gray-100 dark:border-gray-700' : ''}`}>
                        <div className={`text-xs font-semibold  ${isToday ? 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]' : 'text-gray-500 dark:text-gray-400'}`}>
                          {DAYS[i]}
                        </div>
                        <div className={`text-sm font-bold mt-0.5 ${isToday ? 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]' : 'text-gray-700 dark:text-gray-200'}`}>
                          {day.getDate()}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {visibleEmployees.length === 0 ? (
                  <EmptyState
                    as="table"
                    cols={8}
                    icon="🗓️"
                    title="No shifts scheduled"
                    message="Create shifts to start building your roster."
                    action={{ label: 'Add Shift', onClick: () => openCreate(weekStart) }}
                  />
                ) : visibleEmployees.map(emp => (
                  <>
                    {/* Shift row */}
                    <tr key={emp.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition">
                      <td className="px-4 py-2 border-r border-gray-100 dark:border-gray-700 w-36">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: 'var(--primary)' }}>
                            {emp.firstName[0]}{emp.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{emp.firstName}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{emp.lastName}</p>
                          </div>
                        </div>
                        {/* Availability button under name */}
                        <button
                          onClick={() => setAvailModal({ empId: emp.id, empName: `${emp.firstName} ${emp.lastName}` })}
                          className="mt-1 text-[10px] text-teal-600 dark:text-teal-400 hover:underline">
                          avail…
                        </button>
                      </td>
                      {weekDays.map((day, di) => {
                        const dayShifts = getShiftsFor(emp.id, day)
                        return (
                          <td key={di} className={`px-1 py-1 align-top min-w-[110px] ${di < 6 ? 'border-r border-gray-100 dark:border-gray-700' : ''}`}>
                            <div className="space-y-1 min-h-14">
                              {dayShifts.map(shift => {
                                const c = SHIFT_COLOURS[shift.shiftType ?? 'standard'] ?? SHIFT_COLOURS.standard
                                return (
                                  <button key={shift.id} onClick={() => openEdit(shift)}
                                    className={`w-full text-left px-2 py-1.5 rounded-lg border text-xs transition hover:opacity-80 ${c.bg} ${c.text} ${c.border}`}>
                                    <div className="font-semibold">{fmtTime(shift.startTime)}–{fmtTime(shift.endTime)}</div>
                                    <div className="opacity-70">
                                      {shiftDuration(shift.startTime, shift.endTime)}
                                      {shift.shiftType && shift.shiftType !== 'standard' && ` · ${shift.shiftType.replace(/_/g,' ')}`}
                                    </div>
                                    {shift.partFirst && <div className="opacity-70 truncate">{shift.partFirst} {shift.partLast}</div>}
                                    <span className={`inline-block mt-0.5 px-1.5 py-px rounded text-[10px] font-medium ${STATUS_BADGE[shift.status] ?? STATUS_BADGE.draft}`}>
                                      {shift.status}
                                    </span>
                                  </button>
                                )
                              })}
                              <PermissionGate permission="rostering:write">
                                <button onClick={() => openCreate(day, emp.id)}
                                  className="w-full py-1 text-[11px] text-gray-400 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition text-center rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                                  + add
                                </button>
                              </PermissionGate>
                            </div>
                          </td>
                        )
                      })}
                    </tr>

                    {/* Availability row (shown when toggled) */}
                    {showAvail && (
                      <tr key={`avail-${emp.id}`} className="bg-teal-50/30 dark:bg-teal-900/10">
                        <td className="px-4 py-1 border-r border-gray-100 dark:border-gray-700">
                          <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 ">Avail</span>
                        </td>
                        {weekDays.map((_, di) => {
                          const slot = availMap.get(emp.id)?.get(di)
                          return (
                            <td key={di} className={`px-1 py-1 text-center ${di < 6 ? 'border-r border-gray-100 dark:border-gray-700' : ''}`}>
                              {slot ? (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${slot.isAvailable ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'}`}>
                                  {slot.isAvailable ? `${slot.startTime}–${slot.endTime}` : '✕'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400 dark:text-gray-600">—</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(SHIFT_COLOURS).map(([type, c]) => (
          <span key={type} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${c.bg} ${c.text} ${c.border}`}>
            {type.replace(/_/g, ' ')}
          </span>
        ))}
        {showAvail && (
          <>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700">available</span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-red-100 text-red-600 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700">unavailable</span>
          </>
        )}
      </div>
    </div>
  )
}
