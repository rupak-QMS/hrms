'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navGroups = [
  {
    label: 'Core',
    items: [
      { href: '/dashboard',   icon: '', label: 'Dashboard' },
      { href: '/employees',   icon: '', label: 'Employees' },
      { href: '/admin',       icon: '️',  label: 'Admin' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { href: '/screening',   icon: '', label: 'Screening' },
      { href: '/compliance',  icon: '', label: 'Compliance Lock' },
      { href: '/onboarding',  icon: '', label: 'Onboarding' },
    ],
  },
  {
    label: 'Learning',
    items: [
      { href: '/training',    icon: '', label: 'Training & LMS' },
      { href: '/competency',  icon: '', label: 'Competency' },
      { href: '/supervision', icon: '️', label: 'Supervision' },
    ],
  },
  {
    label: 'Talent',
    items: [
      { href: '/workforce',     icon: '️', label: 'Workforce Planning' },
      { href: '/recruitment',   icon: '', label: 'Recruitment' },
      { href: '/contracting',   icon: '️', label: 'Contracting' },
      { href: '/offer-letters', icon: '', label: 'Offer Letters' },
    ],
  },
  {
    label: 'Performance',
    items: [
      { href: '/performance', icon: '', label: 'Performance' },
      { href: '/promotions',  icon: '', label: 'Promotions' },
    ],
  },
  {
    label: 'Safety',
    items: [
      { href: '/whs',         icon: '', label: 'WHS' },
      { href: '/grievances',  icon: '️', label: 'Grievances' },
      { href: '/separation',  icon: '', label: 'Exit Management' },
    ],
  },
  {
    label: 'Experience',
    items: [
      { href: '/reports',     icon: '', label: 'Reports' },
      { href: '/experience',  icon: '', label: 'Experience' },
      { href: '/recognition', icon: '', label: 'Recognition' },
      { href: '/referral',    icon: '', label: 'Referral' },
      { href: '/dei',         icon: '', label: 'DEI' },
      { href: '/engagement',  icon: '', label: 'Engagement' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/assets',      icon: '', label: 'Assets' },
      { href: '/rostering',   icon: '', label: 'Rostering' },
      { href: '/payroll',     icon: '', label: 'Payroll' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto dark:bg-[#0F1E2E] dark:border-[#1A6080]/30">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-[#1A6080]/20">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">Y</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">HRMS</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Enterprise Edition</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[10px] font-semibold st text-gray-600 dark:text-gray-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                        active
                          ? 'bg-brand-50 text-brand-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="text-base leading-none">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-[#1A6080]/20">
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">v1.0 · 28 Modules</p>
      </div>
    </aside>
  )
}
