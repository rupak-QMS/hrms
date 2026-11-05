'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import { SkeletonPage } from '@/components/ui/Skeleton'

type Analytics = {
  headcount: {
    total: number; fullTime: number; partTime: number; casual: number; contractor: number
    ndisWorkers: number; newLast30: number
    complianceGreen: number; complianceAmber: number; complianceRed: number
  }
  byEntity: { name: string; count: number }[]
  compliance: {
    screeningTotal: number; screeningVerified: number
    screeningExpired: number; screeningExpiringSoon: number
  }
  training: { total: number; completed: number; inProgress: number; expired: number; completionRate: number }
  whs: { total: number; open: number; critical: number; last30: number }
  performance: { total: number; completed: number; due30Days: number; avgRating: string | null }
  grievances: { total: number; open: number; critical: number }
  turnover: { total90days: number; resignations: number; terminations: number; turnoverRate: string }
  supervision: { overdue: number; due30days: number }
}

function StatCard({ label, value, sub, color = 'text-white', alert = false }: {
  label: string; value: string | number; sub?: string; color?: string; alert?: boolean
}) {
  return (
    <div className={`card-premium p-4 ${alert ? 'border-red-800' : 'border-gray-800'}`}>
      <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-lg">{icon}</span>
      <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{title}</h2>
    </div>
  )
}

function ProgressBar({ value, max, color = 'bg-[#0E3D52]' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied,  setDenied]  = useState(false)

  useEffect(() => {
    fetchWithAuth('/api/tenant/analytics')
      .then(r => {
        if (r.status === 403) { setDenied(true); setLoading(false); return null }
        return r.json()
      })
      .then(d => {
        if (d) { setData(d); setLoading(false) }
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonPage rows={6} />

  if (denied) return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reporting & Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Organisation-wide metrics across all HR modules</p>
      </div>
      <div className="flex flex-col items-center justify-center h-64 card-premium gap-3">
        <span className="text-4xl">📊</span>
        <p className="text-gray-900 dark:text-white font-semibold">Access Restricted</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
          Analytics are available to managers and above. Contact your HR administrator if you need access.
        </p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-red-400">Failed to load analytics. Please try refreshing the page.</p>
    </div>
  )

  const { headcount, byEntity, compliance, training, whs, performance, grievances, turnover, supervision } = data

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reporting & Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Organisation-wide metrics across all HR modules</p>
      </div>

      {/* ── Headcount ── */}
      <section>
        <SectionHeader title="Headcount" icon="" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Active" value={headcount.total} color="text-foreground" />
          <StatCard label="New (30 days)" value={headcount.newLast30} color="text-green-400" />
          <StatCard label="NDIS Workers" value={headcount.ndisWorkers} color="text-[#1A6080] dark:text-[#4ebac4]" />
          <StatCard label="Compliance OK" value={headcount.complianceGreen}
            sub={`${headcount.complianceAmber} amber · ${headcount.complianceRed} red`}
            color="text-green-400" alert={headcount.complianceRed > 0} />
        </div>

        {/* Employment type breakdown */}
        <div className="card-premium p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 dark:text-gray-400">Employment Type</p>
          <div className="space-y-2.5">
            {[
              { label: 'Full Time',   value: headcount.fullTime,   color: 'bg-[#0E3D52]' },
              { label: 'Part Time',   value: headcount.partTime,   color: 'bg-blue-600' },
              { label: 'Casual',      value: headcount.casual,     color: 'bg-amber-600' },
              { label: 'Contractor',  value: headcount.contractor, color: 'bg-teal-600' },
            ].map(row => (
              <div key={row.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">{row.label}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">{row.value}</span>
                </div>
                <ProgressBar value={row.value} max={headcount.total} color={row.color} />
              </div>
            ))}
          </div>
        </div>

        {/* By entity */}
        {byEntity.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {byEntity.map(e => (
              <div key={e.name} className="card-premium p-4">
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{e.name}</p>
                <p className="text-xl font-bold text-white mt-1">{e.count}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Compliance ── */}
      <section>
        <SectionHeader title="Compliance & Screening" icon="" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Screening Records" value={compliance.screeningTotal} />
          <StatCard label="Verified" value={compliance.screeningVerified} color="text-green-400" />
          <StatCard label="Expiring (30d)" value={compliance.screeningExpiringSoon}
            color={compliance.screeningExpiringSoon > 0 ? 'text-amber-400' : 'text-gray-400'}
            alert={compliance.screeningExpiringSoon > 0} />
          <StatCard label="Expired" value={compliance.screeningExpired}
            color={compliance.screeningExpired > 0 ? 'text-red-400' : 'text-gray-400'}
            alert={compliance.screeningExpired > 0} />
        </div>
      </section>

      {/* ── Training ── */}
      <section>
        <SectionHeader title="Training & LMS" icon="" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="Total Enrolments" value={training.total} />
          <StatCard label="Completed" value={training.completed} color="text-green-400" />
          <StatCard label="In Progress" value={training.inProgress} color="text-blue-400" />
          <StatCard label="Expired" value={training.expired}
            color={training.expired > 0 ? 'text-red-400' : 'text-gray-400'}
            alert={training.expired > 0} />
        </div>
        <div className="card-premium p-4">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Completion Rate</span>
            <span className={`text-sm font-bold ${training.completionRate >= 80 ? 'text-green-400' : training.completionRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {training.completionRate}%
            </span>
          </div>
          <ProgressBar value={training.completionRate} max={100}
            color={training.completionRate >= 80 ? 'bg-green-600' : training.completionRate >= 50 ? 'bg-amber-600' : 'bg-red-600'} />
        </div>
      </section>

      {/* ── WHS + Grievances side-by-side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <SectionHeader title="Work Health & Safety" icon="" />
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Incidents" value={whs.total} />
            <StatCard label="Last 30 Days" value={whs.last30} color="text-amber-400" />
            <StatCard label="Open" value={whs.open} color={whs.open > 0 ? 'text-amber-400' : 'text-gray-400'} />
            <StatCard label="Critical" value={whs.critical}
              color={whs.critical > 0 ? 'text-red-400' : 'text-gray-400'} alert={whs.critical > 0} />
          </div>
        </section>

        <section>
          <SectionHeader title="Grievances & Investigations" icon="️" />
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total" value={grievances.total} />
            <StatCard label="Open" value={grievances.open}
              color={grievances.open > 0 ? 'text-amber-400' : 'text-gray-400'} />
            <StatCard label="Critical Risk" value={grievances.critical}
              color={grievances.critical > 0 ? 'text-red-400' : 'text-gray-400'} alert={grievances.critical > 0} />
            <div className="card-premium p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">Resolution Rate</p>
              <p className={`text-2xl font-bold mt-1 ${grievances.total > 0 ? 'text-white' : 'text-gray-600'}`}>
                {grievances.total > 0
                  ? `${Math.round(((grievances.total - grievances.open) / grievances.total) * 100)}%`
                  : '—'}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ── Performance + Turnover ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <SectionHeader title="Performance Reviews" icon="" />
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Reviews" value={performance.total} />
            <StatCard label="Completed" value={performance.completed} color="text-green-400" />
            <StatCard label="Due (30d)" value={performance.due30Days}
              color={performance.due30Days > 0 ? 'text-amber-400' : 'text-gray-400'} />
            <StatCard label="Avg Rating"
              value={performance.avgRating ? `${performance.avgRating}/5` : '—'}
              color={performance.avgRating ? 'text-[#1A6080] dark:text-[#4ebac4]' : 'text-gray-600'} />
          </div>
        </section>

        <section>
          <SectionHeader title="Turnover (90 days)" icon="" />
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Separations" value={turnover.total90days} color="text-amber-400" />
            <StatCard label="Turnover Rate" value={`${turnover.turnoverRate}%`}
              color={parseFloat(turnover.turnoverRate) > 10 ? 'text-red-400' : 'text-white'} />
            <StatCard label="Resignations" value={turnover.resignations} />
            <StatCard label="Terminations" value={turnover.terminations} />
          </div>
        </section>
      </div>

      {/* ── Supervision ── */}
      <section>
        <SectionHeader title="Supervision" icon="" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Overdue Sessions" value={supervision.overdue}
            color={supervision.overdue > 0 ? 'text-red-400' : 'text-gray-400'}
            alert={supervision.overdue > 0} />
          <StatCard label="Due in 30 Days" value={supervision.due30days}
            color={supervision.due30days > 0 ? 'text-amber-400' : 'text-gray-400'} />
        </div>
      </section>

      <p className="text-xs text-gray-600 pb-4 dark:text-gray-400">
        Data refreshes on page load. Figures reflect current database state as of {new Date().toLocaleDateString('en-AU')}.
      </p>
    </div>
  )
}
