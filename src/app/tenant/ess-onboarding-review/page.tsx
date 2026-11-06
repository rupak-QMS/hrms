'use client'

/**
 * HR — ESS Onboarding Submissions Review
 * Lists all employee onboarding submissions; HR can view details and mark reviewed.
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

// ── types ────────────────────────────────────────────────────────────────────
interface Submission {
  id: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  departmentId?: string
  positionId?: string
  preferredName?: string
  status: string
  submittedAt?: string
  reviewedAt?: string
  reviewedBy?: string
  hrNotes?: string
  updatedAt: string
}

interface FullSubmission extends Submission {
  dateOfBirth?: string
  gender?: string
  phone?: string
  address?: string
  tfnDeclared?: boolean
  taxResidency?: string
  taxFreeThreshold?: boolean
  hasHelpDebt?: boolean
  taxFileNumber?: string
  superFundName?: string
  superFundAbn?: string
  superUsi?: string
  superMemberNumber?: string
  isSmsf?: boolean
  bankName?: string
  bankBsb?: string
  bankAccountNumber?: string
  bankAccountName?: string
  emergencyName?: string
  emergencyRelation?: string
  emergencyPhone?: string
  emergencyPhone2?: string
}

// ── badges ───────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  draft:             'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  submitted:         'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/20 dark:text-[#4ebac4]',
  hr_reviewed:       'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/30 dark:text-[#1A6080] dark:text-[#4ebac4]',
  completed:         'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[status] ?? STATUS_BADGE.draft}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function DetailRow({ label, value }: { label: string; value?: string | boolean | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-44 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100">
        {typeof value === 'boolean' ? (value ? '✓ Yes' : '✗ No') : value}
      </span>
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────────
export default function EssOnboardingReviewPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('submitted')
  const [selected, setSelected]       = useState<FullSubmission | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [hrNotes, setHrNotes]         = useState('')
  const [saving, setSaving]           = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusFilter })
      if (search) params.set('search', search)
      const res = await fetchWithAuth(`/api/tenant/ess/onboarding-submissions?${params}`)
      const { submissions: rows } = await res.json()
      setSubmissions(rows ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  async function openDetail(id: string) {
    setDetailLoading(true)
    setSelected(null)
    try {
      const res = await fetchWithAuth(`/api/tenant/ess/onboarding-submissions/${id}`)
      const { submission } = await res.json()
      setSelected(submission)
      setHrNotes(submission.hrNotes ?? '')
    } catch (e) {
      console.error(e)
    } finally {
      setDetailLoading(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    setSaving(true)
    try {
      await fetchWithAuth(`/api/tenant/ess/onboarding-submissions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, hrNotes }),
      })
      setSelected(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  // KPIs
  const byStatus = (s: string) => submissions.filter(x => x.status === s).length
  const allSubmissions = submissions

  const kpis = [
    { label: 'Total',        value: allSubmissions.length,       color: 'text-gray-900 dark:text-white' },
    { label: 'Submitted',    value: byStatus('submitted'),        color: 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]' },
    { label: 'HR Reviewed',  value: byStatus('hr_reviewed'),      color: 'text-[#0E3D52] dark:text-[#4ebac4]' },
    { label: 'Completed',    value: byStatus('completed'),        color: 'text-green-600 dark:text-green-400' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-premium-title">Onboarding Submissions</h1>
        <p className="page-premium-subtitle mt-1">
          Review employee self-service onboarding forms submitted for HR processing.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="card-premium p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{k.label}</p>
            <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-[#0E3D52]/20"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-[#0E3D52]/20"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="hr_reviewed">HR Reviewed</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#0F1E2E] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#0E3D52] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <div className="w-14 h-14 rounded-2xl bg-[#0E3D52]/[0.07] dark:bg-[#4ebac4]/10 flex items-center justify-center mb-4 mx-auto ring-1 ring-[#0E3D52]/10 dark:ring-[#4ebac4]/15"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#1A6080] dark:text-[#4ebac4] opacity-70"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
            <p className="font-medium">No submissions found</p>
            <p className="text-sm mt-1">Try a different filter</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-premium">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {['Employee', 'Department', 'Status', 'Submitted', 'Reviewed By', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 ">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {submissions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{sub.employeeName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{sub.employeeEmail}</p>
                    {sub.preferredName && <p className="text-xs text-gray-400">Prefers: {sub.preferredName}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-700 dark:text-gray-300">{sub.departmentId ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {sub.reviewedBy
                      ? <><p>{sub.reviewedBy}</p><p className="text-xs">{sub.reviewedAt ? new Date(sub.reviewedAt).toLocaleDateString() : ''}</p></>
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDetail(sub.id)}
                      className="px-3 py-1 text-xs font-medium text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]
                        border border-blue-200 dark:border-[#1A6080] rounded-lg hover:bg-[#E0EEF4]
                        dark:hover:bg-blue-900/20 transition"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {(selected || detailLoading) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-2xl bg-white dark:bg-gray-900 h-full overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-[#0E3D52] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selected ? (
              <div className="p-6">
                {/* Drawer header */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="page-premium-title">{selected.employeeName}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selected.employeeEmail}</p>
                    <div className="mt-2"><StatusBadge status={selected.status} /></div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Sections */}
                <Section title="Personal Details">
                  <DetailRow label="Preferred Name"    value={selected.preferredName} />
                  <DetailRow label="Date of Birth"     value={selected.dateOfBirth} />
                  <DetailRow label="Gender"            value={selected.gender} />
                  <DetailRow label="Phone"             value={selected.phone} />
                  <DetailRow label="Address"           value={selected.address} />
                </Section>

                <Section title="Tax Declaration">
                  <DetailRow label="TFN Declared"        value={selected.tfnDeclared} />
                  <DetailRow label="Tax Residency"       value={selected.taxResidency} />
                  <DetailRow label="Tax-Free Threshold"  value={selected.taxFreeThreshold} />
                  <DetailRow label="HELP/HECS Debt"      value={selected.hasHelpDebt} />
                  <DetailRow label="TFN (masked)"        value={selected.taxFileNumber ? `•••••${selected.taxFileNumber.slice(-3)}` : undefined} />
                </Section>

                <Section title="Superannuation">
                  <DetailRow label="Is SMSF"          value={selected.isSmsf} />
                  <DetailRow label="Fund Name"         value={selected.superFundName} />
                  <DetailRow label="Fund ABN"          value={selected.superFundAbn} />
                  <DetailRow label="USI / ESA"         value={selected.superUsi} />
                  <DetailRow label="Member Number"     value={selected.superMemberNumber} />
                </Section>

                <Section title="Bank Details">
                  <DetailRow label="Bank Name"         value={selected.bankName} />
                  <DetailRow label="BSB"               value={selected.bankBsb} />
                  <DetailRow label="Account Number"    value={selected.bankAccountNumber ? `•••• ${selected.bankAccountNumber.slice(-4)}` : undefined} />
                  <DetailRow label="Account Name"      value={selected.bankAccountName} />
                </Section>

                <Section title="Emergency Contact">
                  <DetailRow label="Name"              value={selected.emergencyName} />
                  <DetailRow label="Relationship"      value={selected.emergencyRelation} />
                  <DetailRow label="Primary Phone"     value={selected.emergencyPhone} />
                  <DetailRow label="Secondary Phone"   value={selected.emergencyPhone2} />
                </Section>

                {/* HR Notes */}
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    HR Notes
                  </label>
                  <textarea
                    rows={3}
                    value={hrNotes}
                    onChange={e => setHrNotes(e.target.value)}
                    placeholder="Add review notes or comments for payroll…"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                      bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                      focus:outline-none focus:ring-2 focus:ring-[#0E3D52]/20 resize-none"
                  />
                </div>

                {/* Actions */}
                {(selected.status === 'submitted' || selected.status === 'hr_reviewed') && (
                  <div className="flex gap-3 mt-6">
                    {selected.status === 'submitted' && (
                      <button
                        onClick={() => updateStatus(selected.id, 'hr_reviewed')}
                        disabled={saving}
                        className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-[#0E3D52] hover:bg-[#1A6080]
                          rounded-lg disabled:opacity-60 transition"
                      >
                        {saving ? 'Saving…' : '✓ Mark as HR Reviewed'}
                      </button>
                    )}
                    {selected.status === 'hr_reviewed' && (
                      <button
                        onClick={() => updateStatus(selected.id, 'completed')}
                        disabled={saving}
                        className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700
                          rounded-lg disabled:opacity-60 transition"
                      >
                        {saving ? 'Saving…' : '✓ Mark as Completed'}
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        setSaving(true)
                        await fetchWithAuth(`/api/tenant/ess/onboarding-submissions/${selected.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ hrNotes }),
                        })
                        setSaving(false)
                      }}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                        border border-gray-200 dark:border-gray-700 rounded-lg
                        hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition"
                    >
                      Save Notes
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold st text-gray-400 dark:text-gray-600 mb-2">{title}</p>
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-1">
        {children}
      </div>
    </div>
  )
}
