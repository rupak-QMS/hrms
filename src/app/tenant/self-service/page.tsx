'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { SkeletonCards } from '@/components/ui/Skeleton'

interface Employee {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  preferredName: string | null
  email: string
  phone: string | null
  photoUrl: string | null
  employmentType: string
  startDate: string
  awardClassification: string | null
  hourlyRate: string | null
  annualSalary: string | null
  isActive: boolean
}

interface LeaveRequest {
  id: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: string
  createdAt: string
}

interface Payslip {
  entryId: string
  runName: string
  periodStart: string
  periodEnd: string
  payDate: string | null
  hoursWorked: string
  grossPay: string
  netPay: string
  paygWithholding: string
  superContribution: string
}

interface Announcement {
  id: string
  title: string
  body: string
  priority: string
  publishedAt: string | null
  createdAt: string
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave', sick: 'Sick Leave', personal: 'Personal Leave',
  unpaid: 'Unpaid Leave', long_service: 'Long Service', carer: "Carer's Leave", compassionate: 'Compassionate',
}

const LEAVE_STATUS_COLORS: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled:'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const PRIORITY_COLORS: Record<string, string> = {
  info:     'border-l-4 border-blue-400 bg-blue-50 dark:bg-blue-900/20',
  warning:  'border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  critical: 'border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20',
}

const PRIORITY_ICONS: Record<string, string> = {
  info: 'ℹ️', warning: '⚠️', critical: '🚨',
}

function fmt(val: string | null | undefined) {
  if (!val) return '$0.00'
  return `$${parseFloat(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TABS = ['🏠 Overview', '🌴 Leave', '💵 Payslips'] as const

export default function SelfServicePage() {
  const [tab, setTab] = useState<typeof TABS[number]>('🏠 Overview')
  const [profile, setProfile] = useState<Employee | null>(null)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'annual', startDate: '', endDate: '', totalDays: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [profRes, announcRes] = await Promise.all([
        fetchWithAuth('/api/tenant/self-service/profile'),
        fetchWithAuth('/api/tenant/self-service/announcements'),
      ])
      if (profRes.ok) {
        const d = await profRes.json()
        setProfile(d.employee)
      }
      if (announcRes.ok) {
        const d = await announcRes.json()
        setAnnouncements(d.announcements || [])
      }
    } finally { setLoading(false) }
  }, [])

  const loadLeave = useCallback(async () => {
    const res = await fetchWithAuth('/api/tenant/self-service/leave-requests')
    if (res.ok) { const d = await res.json(); setLeaveRequests(d.leaveRequests || []) }
  }, [])

  const loadPayslips = useCallback(async () => {
    const res = await fetchWithAuth('/api/tenant/self-service/payslips')
    if (res.ok) { const d = await res.json(); setPayslips(d.payslips || []) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { if (tab === '🌴 Leave') loadLeave() }, [tab, loadLeave])
  useEffect(() => { if (tab === '💵 Payslips') loadPayslips() }, [tab, loadPayslips])

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetchWithAuth('/api/tenant/self-service/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leaveForm,
          totalDays: leaveForm.totalDays ? parseFloat(leaveForm.totalDays) : 1,
        }),
      })
      if (res.ok) {
        await loadLeave()
        setShowLeaveModal(false)
        setLeaveForm({ leaveType: 'annual', startDate: '', endDate: '', totalDays: '', reason: '' })
      }
    } finally { setSubmitting(false) }
  }

  if (loading) return <SkeletonCards count={3} />

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center gap-4">
          {profile?.photoUrl ? (
            <img src={profile.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#E0EEF4] dark:bg-[#0E3D52]/15 flex items-center justify-center text-2xl font-bold text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]">
              {profile ? profile.firstName[0] + profile.lastName[0] : '?'}
            </div>
          )}
          <div>
            <h1 className="page-premium-title">
              {profile ? `${profile.preferredName || profile.firstName} ${profile.lastName}` : 'Employee Self-Service'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {profile?.employeeNumber && <span className="mr-2">#{profile.employeeNumber}</span>}
              {profile?.email}
            </p>
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-[#E0EEF4] dark:bg-[#0E3D52]/15 text-[#0E3D52] dark:text-[#4ebac4]' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* OVERVIEW TAB */}
        {tab === '🏠 Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile card */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">My Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  { label: 'Full Name',        value: profile ? `${profile.firstName} ${profile.lastName}` : '—' },
                  { label: 'Preferred Name',   value: profile?.preferredName || '—' },
                  { label: 'Email',            value: profile?.email || '—' },
                  { label: 'Phone',            value: profile?.phone || '—' },
                  { label: 'Employment Type',  value: profile?.employmentType ? profile.employmentType.replace(/_/g, ' ') : '—' },
                  { label: 'Start Date',       value: fmtDate(profile?.startDate || null) },
                  { label: 'Classification',   value: profile?.awardClassification || '—' },
                  { label: 'Pay Rate',         value: profile?.hourlyRate ? `${fmt(profile.hourlyRate)}/hr` : profile?.annualSalary ? `${fmt(profile.annualSalary)}/yr` : '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="font-medium text-gray-900 dark:text-white mt-0.5 capitalize">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Quick Actions</h2>
                <div className="space-y-2">
                  {[
                    { label: '🌴 Request Leave', action: () => { setTab('🌴 Leave'); setShowLeaveModal(true) } },
                    { label: '💵 View Payslips', action: () => setTab('💵 Payslips') },
                  ].map(({ label, action }) => (
                    <button key={label} onClick={action}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600">
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Announcements */}
              {announcements.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Announcements</h2>
                  {announcements.slice(0, 3).map(a => (
                    <div key={a.id} className={`rounded-xl p-3 ${PRIORITY_COLORS[a.priority]}`}>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {PRIORITY_ICONS[a.priority]} {a.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{a.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* LEAVE TAB */}
        {tab === '🌴 Leave' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">My Leave Requests</h2>
              <button onClick={() => setShowLeaveModal(true)}
                className="px-4 py-2 bg-[#0E3D52] text-white text-sm font-medium rounded-lg hover:bg-[#1A6080]">
                + Request Leave
              </button>
            </div>
            {leaveRequests.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                No leave requests yet
              </div>
            ) : (
              <div className="space-y-3">
                {leaveRequests.map(lr => (
                  <div key={lr.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {LEAVE_TYPE_LABELS[lr.leaveType] || lr.leaveType}
                        </p>
                        <p className="page-premium-subtitle mt-0.5">
                          {fmtDate(lr.startDate)} – {fmtDate(lr.endDate)} · {lr.totalDays} day{lr.totalDays !== 1 ? 's' : ''}
                        </p>
                        {lr.reason && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{lr.reason}</p>}
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${LEAVE_STATUS_COLORS[lr.status]}`}>
                        {lr.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PAYSLIPS TAB */}
        {tab === '💵 Payslips' && (
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">My Payslips</h2>
            {payslips.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                No payslips available yet
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="table-responsive">
            <table className="table-premium">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {['Pay Run', 'Period', 'Pay Date', 'Hours', 'Gross', 'Tax', 'Super', 'Net Pay'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {payslips.map(p => (
                      <tr key={p.entryId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.runName}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{fmtDate(p.payDate)}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{parseFloat(p.hoursWorked || '0').toFixed(1)}h</td>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">{fmt(p.grossPay)}</td>
                        <td className="px-4 py-3 text-red-600 dark:text-red-400">{fmt(p.paygWithholding)}</td>
                        <td className="px-4 py-3 text-[#0E3D52] dark:text-[#4ebac4]">{fmt(p.superContribution)}</td>
                        <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">{fmt(p.netPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LEAVE REQUEST MODAL */}
      {showLeaveModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Request Leave</h3>
              <button onClick={() => setShowLeaveModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl">×</button>
            </div>
            <form onSubmit={submitLeave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Type *</label>
                <select required value={leaveForm.leaveType} onChange={e => setLeaveForm(f => ({ ...f, leaveType: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  {Object.entries(LEAVE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date *</label>
                  <input required type="date" value={leaveForm.startDate} onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date *</label>
                  <input required type="date" value={leaveForm.endDate} onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total Days</label>
                <input type="number" step="0.5" min="0.5" value={leaveForm.totalDays} onChange={e => setLeaveForm(f => ({ ...f, totalDays: e.target.value }))}
                  placeholder="e.g. 2"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <textarea rows={3} value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowLeaveModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2 bg-[#0E3D52] text-white rounded-lg text-sm font-medium hover:bg-[#1A6080] disabled:opacity-50">
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
