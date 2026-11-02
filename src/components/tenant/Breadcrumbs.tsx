'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

// Human-readable labels for each path segment
const SEGMENT_LABELS: Record<string, string> = {
  tenant:                  'Home',
  dashboard:               'Dashboard',
  'employee-management':   'Employees',
  roles:                   'Roles & Access',
  'audit-logs':            'Audit Logs',
  documents:               'Documents',
  compliance:              'Compliance',
  onboarding:              'Onboarding',
  training:                'Training',
  competencies:            'Competencies',
  supervision:             'Supervision',
  'workforce-planning':    'Workforce',
  recruitment:             'Recruitment',
  contracts:               'Contracts',
  performance:             'Performance',
  whs:                     'Safety (WHS)',
  grievances:              'Grievances',
  separation:              'Separation',
  analytics:               'Analytics',
  benefits:                'Benefits',
  recognition:             'Recognition',
  assets:                  'Assets',
  rostering:               'Rostering',
  payroll:                 'Payroll',
  leave:                   'Leave',
  timesheets:              'Timesheets',
  reports:                 'Reports',
  expenses:                'Expenses',
  participants:            'Participants',
  'payroll-finance':       'Payroll & Finance',
  'self-service':          'Self Service',
  superannuation:          'Superannuation',
  'salary-reviews':        'Salary Reviews',
  toil:                    'TOIL',
  organisation:            'Organisation',
  helpdesk:                'Helpdesk',
  'public-holidays':       'Public Holidays',
  crm:                     'CRM',
}

function toLabel(segment: string): string {
  // UUID-like segment — show truncated
  if (/^[0-9a-f-]{36}$/i.test(segment)) return segment.slice(0, 8) + '…'
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function Breadcrumbs() {
  const pathname = usePathname()
  if (!pathname) return null

  const parts = pathname.split('/').filter(Boolean)
  // Skip rendering if we're at the root tenant dashboard (just one segment)
  if (parts.length <= 1) return null

  const crumbs: { label: string; href: string }[] = []
  let href = ''
  for (const part of parts) {
    href += '/' + part
    crumbs.push({ label: toLabel(part), href })
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400 mb-3 select-none">
      <Link href="/tenant/dashboard" className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 opacity-40" />
          {i === crumbs.length - 1 ? (
            <span className="text-gray-700 dark:text-gray-200 font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
