'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import { SkeletonCards } from '@/components/ui/Skeleton'

type Benefit = {
  id: string
  type: string
  description: string | null
  startDate: string | null
  endDate: string | null
  notes: string | null
  createdAt: string
}

type Employee = { id: string; firstName: string; lastName: string }

const BENEFIT_TYPES = [
  { value: 'eap',               label: 'Employee Assistance Program', emoji: '🧠', color: '#0E3D52',
    detail: 'Confidential counselling and support services for mental health, financial stress, relationships and more.' },
  { value: 'study_support',     label: 'Study Support',               emoji: '📚', color: '#3b82f6',
    detail: 'Financial support or paid study leave to assist with approved educational programs.' },
  { value: 'discount',          label: 'Employee Discount',           emoji: '🏷️', color: '#f59e0b',
    detail: 'Access to discounted products or services through our employee discount program.' },
  { value: 'wellbeing',         label: 'Wellbeing Allowance',         emoji: '💚', color: '#10b981',
    detail: 'Annual allowance to spend on health, fitness, or wellness activities of your choice.' },
  { value: 'salary_packaging',  label: 'Salary Packaging',            emoji: '💼', color: '#6366f1',
    detail: 'Pre-tax salary packaging arrangements for eligible expenses to maximise take-home pay.' },
  { value: 'extra_leave',       label: 'Extra Leave',                 emoji: '🌴', color: '#14b8a6',
    detail: 'Additional paid leave days beyond the statutory entitlement.' },
  { value: 'flexible_work',     label: 'Flexible Work',               emoji: '🏠', color: '#f97316',
    detail: 'Approved arrangement for remote work, modified hours, or job sharing.' },
  { value: 'other',             label: 'Other Benefit',               emoji: '⭐', color: '#94a3b8',
    detail: 'A benefit specific to your role or circumstances. See description for details.' },
]

function getStatus(b: Benefit): 'active' | 'expiring' | 'expired' | 'permanent' {
  const today = new Date().toISOString().slice(0, 10)
  if (!b.endDate) return 'permanent'
  if (b.endDate < today) return 'expired'
  const soon = new Date(); soon.setDate(soon.getDate() + 30)
  if (b.endDate <= soon.toISOString().slice(0, 10)) return 'expiring'
  return 'active'
}

const STATUS_STYLE: Record<string, string> = {
  active:    'badge badge-green',
  expiring:  'badge badge-amber',
  expired:   'badge badge-gray',
  permanent: 'badge badge-blue',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Active', expiring: 'Expiring Soon', expired: 'Expired', permanent: 'Ongoing',
}

function fmt(d: string | null): string {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntilExpiry(endDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end   = new Date(endDate + 'T00:00:00')
  return Math.ceil((end.getTime() - today.getTime()) / 86400000)
}

export default function MyBenefitsPage() {
  const [benefits,  setBenefits]  = useState<Benefit[]>([])
  const [employee,  setEmployee]  = useState<Employee | null>(null)
  const [linked,    setLinked]    = useState(true)
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string | null>(null)

  useEffect(() => {
    fetchWithAuth('/api/tenant/my-benefits')
      .then(r => r.json())
      .then(d => {
        setLinked(d.employeeLinked !== false)
        setBenefits(d.benefits ?? [])
        setEmployee(d.employee ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonCards count={4} />

  if (!linked) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="card-premium rounded-2xl p-10 text-center">
          <p className="text-lg font-semibold text-white mb-2">Profile Not Linked</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Your account is not linked to an employee record. Contact HR to set this up.
          </p>
        </div>
      </div>
    )
  }

  const activeBenefits  = benefits.filter(b => getStatus(b) !== 'expired')
  const expiredBenefits = benefits.filter(b => getStatus(b) === 'expired')
  const expiringCount   = benefits.filter(b => getStatus(b) === 'expiring').length

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Benefits</h1>
        {employee && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {employee.firstName} {employee.lastName} · {activeBenefits.length} active benefit{activeBenefits.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Expiry warning */}
      {expiringCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-3.5 flex items-center gap-3">
          <span className="text-amber-400 text-lg">⚠️</span>
          <p className="text-sm text-amber-300">
            <span className="font-semibold">{expiringCount} benefit{expiringCount > 1 ? 's' : ''}</span> expiring within 30 days. Contact HR if you need to renew.
          </p>
        </div>
      )}

      {/* No benefits state */}
      {benefits.length === 0 && (
        <div className="card-premium rounded-2xl py-16 text-center">
          <div className="text-4xl mb-3">🎁</div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">No benefits assigned yet</p>
          <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">
            Benefits will appear here once HR assigns them to your profile.
          </p>
        </div>
      )}

      {/* Active benefits */}
      {activeBenefits.length > 0 && (
        <div className="space-y-3">
          {activeBenefits.map(b => {
            const status  = getStatus(b)
            const info    = BENEFIT_TYPES.find(t => t.value === b.type)
            const isOpen  = expanded === b.id
            const daysLeft = b.endDate && status === 'expiring' ? daysUntilExpiry(b.endDate) : null
            return (
              <div key={b.id}
                className="card-premium overflow-hidden"
                style={{ borderLeft: `4px solid ${info?.color ?? '#6b7280'}` }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition">
                  <span className="text-3xl shrink-0">{info?.emoji ?? '⭐'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{info?.label ?? b.type}</p>
                    {b.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{b.description}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                      {b.startDate ? `From ${fmt(b.startDate)}` : 'No start date'}
                      {b.endDate ? ` · Ends ${fmt(b.endDate)}` : ' · Ongoing'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className={`${STATUS_STYLE[status]}`}>
                        {STATUS_LABEL[status]}
                      </span>
                      {daysLeft !== null && (
                        <p className="text-xs text-amber-400 mt-1">{daysLeft}d left</p>
                      )}
                    </div>
                    <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 space-y-3">
                    {/* Program detail */}
                    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium ">About this benefit</p>
                      <p className="text-sm text-gray-300">{info?.detail ?? 'Contact HR for details on this benefit.'}</p>
                    </div>
                    {/* Your specific details */}
                    {b.description && (
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 font-medium">Your details</p>
                        <p className="text-sm text-gray-300">{b.description}</p>
                      </div>
                    )}
                    <div className="flex gap-6 text-xs">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Start Date</p>
                        <p className="text-foreground font-medium">{fmt(b.startDate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">End Date</p>
                        <p className="text-foreground font-medium">{b.endDate ? fmt(b.endDate) : 'Ongoing'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Assigned</p>
                        <p className="text-foreground font-medium">{fmt(b.createdAt.slice(0, 10))}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-500">
                      Questions about this benefit? Contact your HR team.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Expired benefits (collapsed section) */}
      {expiredBenefits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 ">Expired Benefits ({expiredBenefits.length})</p>
          <div className="card-premium overflow-hidden opacity-60">
            {expiredBenefits.map((b, i) => {
              const info = BENEFIT_TYPES.find(t => t.value === b.type)
              return (
                <div key={b.id}
                  className={`flex items-center gap-3 px-5 py-3 text-sm ${i > 0 ? 'border-t border-gray-100 dark:border-gray-800' : ''}`}>
                  <span>{info?.emoji}</span>
                  <span className="text-gray-500">{info?.label ?? b.type}</span>
                  <span className="ml-auto text-xs text-gray-600 dark:text-gray-600">Ended {fmt(b.endDate)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
