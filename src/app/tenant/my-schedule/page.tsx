'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  partFirst: string | null
  partLast: string | null
  partNdis: string | null
}

type OpenEntry = {
  id: string
  clockIn: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SHIFT_TYPE_LABELS: Record<string, string> = {
  standard:     'Standard',
  sleepover:    'Sleepover',
  active_night: 'Active Night',
  on_call:      'On Call',
}

const SHIFT_TYPE_COLORS: Record<string, string> = {
  standard:     'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/20 dark:text-[#7dcfd7]',
  sleepover:    'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/20 dark:text-[#7dcfd7]',
  active_night: 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/40 dark:text-[#4ebac4]',
  on_call:      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  confirmed: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  completed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.round((ms % 3_600_000) / 60_000)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function shiftDay(iso: string): string {
  return isoDate(new Date(iso))
}

function isToday(dateStr: string): boolean {
  return dateStr === isoDate(new Date())
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MySchedulePage() {
  const [weekStart, setWeekStart] = useState<Date>(getMondayOf(new Date()))
  const [shifts,    setShifts]    = useState<Shift[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  // Clock-in state
  const [openEntry,   setOpenEntry]   = useState<OpenEntry | null>(null)
  const [clocking,    setClocking]    = useState(false)
  const [clockMsg,    setClockMsg]    = useState('')
  const [breakMins,   setBreakMins]   = useState(0)
  const [showClockOut, setShowClockOut] = useState(false)

  // Derive the 7 days of the week
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchShifts = useCallback(async (ws: Date) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchWithAuth(`/api/tenant/roster/shifts?weekStart=${isoDate(ws)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load shifts')
      // API auto-scopes to the logged-in employee's own shifts for non-managers
      setShifts(data.shifts ?? [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Check for open clock-in on mount
  useEffect(() => {
    fetchWithAuth('/api/tenant/timesheets?status=pending')
      .then(r => r.json())
      .then(data => {
        const open = (data.timesheets ?? []).find((t: any) => !t.clockOut)
        if (open) setOpenEntry({ id: open.id, clockIn: open.clockIn })
      })
      .catch(() => {})
  }, [])

  useEffect(() => { fetchShifts(weekStart) }, [weekStart, fetchShifts])

  function prevWeek() { setWeekStart(ws => addDays(ws, -7)) }
  function nextWeek() { setWeekStart(ws => addDays(ws, +7)) }
  function thisWeek() { setWeekStart(getMondayOf(new Date())) }

  // ── Clock in ──
  async function clockIn(shiftId?: string) {
    setClocking(true)
    setClockMsg('')
    try {
      const res = await fetchWithAuth('/api/tenant/timesheets/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: shiftId ?? null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setClockMsg(data.error ?? 'Clock-in failed')
        return
      }
      setOpenEntry({ id: data.timesheet.id, clockIn: data.clockIn })
      setClockMsg(`Clocked in at ${fmtTime(data.clockIn)}`)
    } catch {
      setClockMsg('Clock-in failed')
    } finally {
      setClocking(false)
    }
  }

  // ── Clock out ──
  async function clockOut() {
    if (!openEntry) return
    setClocking(true)
    setClockMsg('')
    try {
      const res = await fetchWithAuth('/api/tenant/timesheets/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ breakMinutes: breakMins }),
      })
      const data = await res.json()
      if (!res.ok) {
        setClockMsg(data.error ?? 'Clock-out failed')
        return
      }
      setOpenEntry(null)
      setShowClockOut(false)
      setBreakMins(0)
      setClockMsg(`Clocked out. Hours worked: ${Number(data.hoursWorked).toFixed(2)}h`)
    } catch {
      setClockMsg('Clock-out failed')
    } finally {
      setClocking(false)
    }
  }

  // ── Week label ──
  const weekLabel = (() => {
    const end = addDays(weekStart, 6)
    const sm = MONTHS[weekStart.getMonth()], em = MONTHS[end.getMonth()]
    if (weekStart.getMonth() === end.getMonth()) {
      return `${weekStart.getDate()}–${end.getDate()} ${sm} ${weekStart.getFullYear()}`
    }
    return `${weekStart.getDate()} ${sm} – ${end.getDate()} ${em} ${weekStart.getFullYear()}`
  })()

  // Compute weekly total hours
  const weeklyHours = shifts.reduce((sum, s) => {
    const ms = new Date(s.endTime).getTime() - new Date(s.startTime).getTime()
    return sum + ms / 3_600_000
  }, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-premium-title">My Schedule</h1>
          <p className="page-premium-subtitle mt-0.5">Your rostered shifts for the week</p>
        </div>

        {/* Week nav */}
        <div className="flex items-center gap-2">
          <button onClick={prevWeek}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={thisWeek}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-700 dark:text-gray-300">
            Today
          </button>
          <button onClick={nextWeek}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Week label + stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-base font-semibold text-gray-900 dark:text-white">{weekLabel}</span>
        {!loading && shifts.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {shifts.length} shift{shifts.length !== 1 ? 's' : ''} · {weeklyHours.toFixed(1)}h scheduled
          </span>
        )}
      </div>

      {/* Clock status bar */}
      {openEntry ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </span>
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Currently clocked in</p>
                <p className="text-xs text-green-600 dark:text-green-400">Since {fmtTime(openEntry.clockIn)}</p>
              </div>
            </div>
            <button onClick={() => setShowClockOut(v => !v)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition">
              {showClockOut ? 'Cancel' : 'Clock Out'}
            </button>
          </div>

          {showClockOut && (
            <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-green-700 dark:text-green-400">Break taken</label>
                <select value={breakMins} onChange={e => setBreakMins(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded-lg px-2 py-1 text-sm text-gray-900 dark:text-white">
                  {[0,15,20,30,45,60].map(m => (
                    <option key={m} value={m}>{m === 0 ? 'No break' : `${m} min`}</option>
                  ))}
                </select>
              </div>
              <button onClick={clockOut} disabled={clocking}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white transition">
                {clocking ? 'Clocking out…' : 'Confirm Clock Out'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Not clocked in</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Clock in when your shift starts</p>
          </div>
          <button onClick={() => clockIn()} disabled={clocking}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition hover:opacity-90"
            style={{ background: 'var(--primary)' }}>
            {clocking ? 'Clocking in…' : 'Clock In Now'}
          </button>
        </div>
      )}

      {/* Feedback message */}
      {clockMsg && (
        <div className="bg-[#E0EEF4] dark:bg-[#0E3D52]/20 border border-blue-200 dark:border-[#1A6080] rounded-xl px-4 py-2 text-sm text-[#0E3D52] dark:text-[#7dcfd7]">
          {clockMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Schedule */}
      {loading ? (
        <div className="card-premium py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Loading shifts…
        </div>
      ) : (
        <div className="space-y-2">
          {days.map(day => {
            const dayStr  = isoDate(day)
            const dayShifts = shifts.filter(s => shiftDay(s.startTime) === dayStr)
            const today   = isToday(dayStr)
            const isPast  = dayStr < isoDate(new Date()) && !today

            return (
              <div key={dayStr}
                className={`card-premium overflow-hidden transition ${
                  today
                    ? 'border-[#9ccfda] dark:border-[#1A6080]'
                    : 'border-gray-200 dark:border-gray-800'
                }`}>
                {/* Day header */}
                <div className={`px-5 py-3 flex items-center gap-3 ${
                  today
                    ? 'bg-[#E0EEF4] dark:bg-[#0E3D52]/20'
                    : 'bg-gray-50 dark:bg-gray-800/50'
                }`}>
                  <div className="min-w-[2.5rem] text-center">
                    <p className={`text-[10px] font-semibold  ${
                      today ? 'text-[#0E3D52] dark:text-[#4ebac4]' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {WEEKDAYS[day.getDay()]}
                    </p>
                    <p className={`text-lg font-bold leading-none mt-0.5 ${
                      today ? 'text-[#0E3D52] dark:text-[#4ebac4]' : isPast ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white'
                    }`}>
                      {day.getDate()}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${today ? 'text-[#0E3D52] dark:text-[#4ebac4]' : 'text-gray-500 dark:text-gray-400'}`}>
                      {today ? 'Today' : `${MONTHS[day.getMonth()]} ${day.getFullYear()}`}
                    </p>
                    {dayShifts.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''} ·{' '}
                        {dayShifts.reduce((sum, s) => {
                          return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3_600_000
                        }, 0).toFixed(1)}h
                      </p>
                    )}
                  </div>
                </div>

                {/* Shifts for this day */}
                {dayShifts.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-gray-400 dark:text-gray-600 italic">No shifts scheduled</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {dayShifts.map(shift => {
                      const isNow = today && new Date() >= new Date(shift.startTime) && new Date() <= new Date(shift.endTime)
                      return (
                        <div key={shift.id} className={`px-5 py-4 flex gap-4 items-start ${isNow ? 'bg-[#f0f7fb]/50 dark:bg-[#0E3D52]/10' : ''}`}>
                          {/* Time column */}
                          <div className="shrink-0 text-right min-w-[72px]">
                            <p className={`text-sm font-semibold ${isNow ? 'text-[#0E3D52] dark:text-[#4ebac4]' : 'text-gray-900 dark:text-white'}`}>
                              {fmtTime(shift.startTime)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{fmtTime(shift.endTime)}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">{fmtDuration(shift.startTime, shift.endTime)}</p>
                          </div>

                          {/* Vertical bar */}
                          <div className={`w-0.5 self-stretch rounded-full mt-0.5 ${isNow ? 'bg-[#4ebac4]' : 'bg-gray-200 dark:bg-gray-700'}`} />

                          {/* Shift details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              {shift.shiftType && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SHIFT_TYPE_COLORS[shift.shiftType] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {SHIFT_TYPE_LABELS[shift.shiftType] ?? shift.shiftType}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[shift.status] ?? 'bg-gray-100 text-gray-500'}`}>
                                {shift.status.charAt(0).toUpperCase() + shift.status.slice(1)}
                              </span>
                              {isNow && (
                                <span className="text-xs font-semibold text-[#0E3D52] dark:text-[#4ebac4] animate-pulse">● Active now</span>
                              )}
                            </div>

                            {/* Participant */}
                            {(shift.partFirst || shift.partLast) && (
                              <p className="text-sm font-medium text-gray-900 dark:text-white mb-0.5">
                                {shift.partFirst} {shift.partLast}
                                {shift.partNdis && (
                                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">NDIS {shift.partNdis}</span>
                                )}
                              </p>
                            )}

                            {/* Location */}
                            {(shift.location || shift.clientSite) && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {shift.clientSite || shift.location}
                              </p>
                            )}

                            {/* Notes */}
                            {shift.notes && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">"{shift.notes}"</p>
                            )}

                            {/* Clock in button for today's shifts */}
                            {today && !openEntry && shift.status !== 'cancelled' && shift.status !== 'completed' && (
                              <button
                                onClick={() => clockIn(shift.id)}
                                disabled={clocking}
                                className="mt-2 px-3 py-1 text-xs font-semibold rounded-lg text-white disabled:opacity-60 transition hover:opacity-90"
                                style={{ background: 'var(--primary)' }}>
                                {clocking ? 'Clocking in…' : 'Clock In for this Shift'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && shifts.length === 0 && !error && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">No shifts scheduled for this week.</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Contact your manager if you believe this is incorrect.</p>
        </div>
      )}
    </div>
  )
}
