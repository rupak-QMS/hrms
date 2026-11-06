'use client'

import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import Icon, { type IconName } from '@/components/ui/Icon'

type NavItem = { key: string; label: string; badge?: number }

type Props = {
  navItems:       NavItem[]
  sidebarBg:      string
  primaryColor:   string
  tenantName:     string
  logoUrl:        string
  userEmail:      string
  userInitial:    string
  userRole:       string
  borderRadius:   string
  mobileOpen?:    boolean
  onMobileClose?: () => void
}

const ROLE_LABELS: Record<string, string> = {
  director:           'Director',
  hr_officer:         'HR Officer',
  compliance_manager: 'Compliance Manager',
  operations_manager: 'Operations Manager',
  team_leader:        'Team Leader',
  payroll_officer:    'Payroll Officer',
  employee:           'Employee',
  auditor:            'Auditor',
  it_admin:           'IT Admin',
}

function cleanLabel(label: string): string {
  return label.replace(/^[\p{Emoji}\s]+/u, '').trim()
}

const NAV_ICONS: Record<string, IconName> = {
  'dashboard':          'dashboard',
  'employee-management':'users',
  'roles':              'key',
  'audit-logs':         'clipboard-list',
  'documents':          'document',
  'compliance':         'lock',
  'onboarding':         'onboarding',
  'training':           'training',
  'competencies':       'target',
  'supervision':        'eye',
  'workforce-planning': 'org-chart',
  'recruitment':        'search',
  'contracts':          'file-contract',
  'performance':        'chart-line',
  'whs':                'shield',
  'grievances':         'balance-scale',
  'separation':         'door-exit',
  'analytics':          'bar-chart',
  'benefits':           'gift',
  'recognition':        'trophy',
  'referrals':          'handshake',
  'dei':                'globe',
  'engagement':         'chat',
  'assets':             'monitor',
  'rostering':          'rostering',
  'timesheets':         'timesheet',
  'payroll':            'currency',
  'leave':              'calendar',
  'public-holidays':    'calendar',
  'reports':            'bar-chart',
  'reports-analytics':  'bar-chart',
  'ndis-audits':        'clipboard-list',
  'ndis-incidents':     'shield',
  'participants':       'users',
  'schads':             'currency',
  'crm':                'search',
  'expenses':           'currency',
  'screening':          'screening',
  'medication-health':       'shield',
  'ess-onboarding':         'onboarding',
  'ess-onboarding-review':  'clipboard-list',
  'superannuation':         'currency',
  'salary-reviews':         'chart-line',
  'toil':                   'calendar',
  'promotions':             'chart-line',
  'experience':             'trophy',
  'my-profile':         'user-circle',
  'my-payslips':        'payslip',
  'my-documents':       'folder',
  'my-schedule':        'rostering',
  'my-performance':     'chart-line',
  'my-leave':           'beach',
  'my-benefits':        'gift',
  'helpdesk':           'ticket',
}

export default function TenantSidebar({
  navItems, sidebarBg, primaryColor, tenantName,
  logoUrl, userEmail, userInitial, userRole, borderRadius,
  mobileOpen, onMobileClose,
}: Props) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [open, setOpen]         = useState(false)
  const [isDark, setIsDark]     = useState(false)
  const [expiryCount, setExpiryCount] = useState(0)
  const [trainingExpiryCount, setTrainingExpiryCount] = useState(0)
  const [screeningCount, setScreeningCount] = useState(0)
  const dropdownRef         = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/tenant/documents/expiry-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setExpiryCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/tenant/training/expiry-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setTrainingExpiryCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/tenant/employees/screening-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(d => setScreeningCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Deep teal sidebar — always dark regardless of app theme
  const bg          = sidebarBg   // deep teal (e.g. #0E3D52) or tenant's primaryColor
  const borderClr   = 'rgba(255,255,255,0.08)'
  const textColor   = 'rgba(255,255,255,0.90)'
  const mutedText   = 'rgba(255,255,255,0.45)'
  const hoverBg     = 'rgba(255,255,255,0.08)'
  const activeBg    = 'rgba(255,255,255,0.14)'
  const labelColor  = 'rgba(255,255,255,0.35)'

  async function handleSignOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  function isActive(key: string) {
    return pathname.includes(`/tenant/${key}`)
  }

  const isDashboard = pathname === '/tenant/dashboard' || pathname === '/tenant'

  function NavLink({ navKey, label, badge }: { navKey: string; label: string; badge?: number }) {
    const active = navKey === 'dashboard' ? isDashboard : isActive(navKey)
    const icon   = NAV_ICONS[navKey] ?? 'document'

    return (
      <Link
        href={`/tenant/${navKey}`}
        onClick={onMobileClose}
        className="flex items-center gap-2.5 py-[7px] px-3 rounded-lg text-[13px] transition-all duration-150"
        style={{
          background: active ? activeBg : 'transparent',
          color: active ? '#ffffff' : textColor,
          fontWeight: active ? 500 : 400,
        }}
        onMouseEnter={e => {
          if (!active) {
            const el = e.currentTarget as HTMLElement
            el.style.background = hoverBg
            el.style.color = '#ffffff'
          }
        }}
        onMouseLeave={e => {
          if (!active) {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.color = textColor
          }
        }}
      >
        <span style={{ color: active ? '#ffffff' : mutedText, flexShrink: 0 }}>
          <Icon
            name={icon}
            className="w-4 h-4"
            strokeWidth={active ? 2 : 1.6}
          />
        </span>
        <span className="truncate leading-none flex-1">{cleanLabel(label)}</span>
        {badge !== undefined && badge > 0 && (
          <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full"
            style={{ background: 'rgba(232,151,58,0.9)', color: '#fff' }}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    )
  }

  const sidebarContent = (
    <aside
      className="w-60 flex flex-col shrink-0 select-none h-full"
      style={{
        background: bg,
        borderRight: `1px solid ${borderClr}`,
      }}
    >
      {/* Brand */}
      <div
        className="px-4 py-4 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${borderClr}` }}
      >
        {logoUrl ? (
          <Image src={logoUrl} alt={tenantName} width={140} height={28} className="h-7 max-w-[140px] object-contain" unoptimized />
        ) : (
          <>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              {tenantName[0]}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight truncate text-white">
                {tenantName}
              </p>
              <p className="text-[10px] font-medium" style={{ color: mutedText }}>
                HR Management
              </p>
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-0.5">
        <NavLink navKey="dashboard" label="Dashboard" />

        {navItems.map(({ key, label, badge }) => (
          <NavLink key={key} navKey={key} label={label} badge={key === 'documents' ? (expiryCount || badge) : key === 'training' ? (trainingExpiryCount || badge) : key === 'screening' ? (screeningCount || badge) : badge} />
        ))}

        {/* My Portal */}
        <div className="pt-4 mt-1" style={{ borderTop: `1px solid ${borderClr}` }}>
          <p
            className="px-3 pb-2 text-[11px] font-medium"
            style={{ color: labelColor }}
          >
            My Portal
          </p>
          {[
            { key: 'my-schedule',     label: 'My Schedule' },
            { key: 'my-profile',      label: 'My Profile' },
            { key: 'my-payslips',     label: 'My Payslips' },
            { key: 'my-documents',    label: 'My Documents' },
            { key: 'my-performance',  label: 'My Performance' },
            { key: 'my-leave',        label: 'My Leave' },
            { key: 'my-benefits',     label: 'My Benefits' },
          ].map(({ key, label }) => (
            <NavLink key={key} navKey={key} label={label} />
          ))}
        </div>
      </nav>

      {/* User section */}
      <div
        ref={dropdownRef}
        className="relative px-2.5 pb-3 pt-2"
        style={{ borderTop: `1px solid ${borderClr}` }}
      >
        {open && (
          <div
            className="absolute bottom-full left-2 right-2 mb-2 rounded-xl overflow-hidden"
            style={{
              background: isDark ? '#0d1427' : '#ffffff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: isDark
                ? '0 -8px 32px rgba(0,0,0,0.5)'
                : '0 -4px 24px rgba(0,0,0,0.14)',
            }}
          >
            <Link
              href="/tenant/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] transition-colors"
              style={{ color: isDark ? 'rgba(226,232,244,0.9)' : '#1A2E3B' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <span style={{ color: isDark ? 'rgba(148,163,184,0.7)' : 'rgba(14,61,82,0.6)' }}>
                <Icon name="gear" className="w-4 h-4 shrink-0" />
              </span>
              Settings
            </Link>
            <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-left transition-colors"
              style={{ color: '#e05252' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.07)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <Icon name="logout" className="w-4 h-4 shrink-0" />
              Sign out
            </button>
          </div>
        )}

        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors text-left"
          style={{ background: open ? hoverBg : 'transparent' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = hoverBg }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = open ? hoverBg : 'transparent' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0"
            style={{ background: 'rgba(232,151,58,0.85)' }}
          >
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium truncate" style={{ color: textColor }}>{userEmail}</p>
            <p className="text-[11px]" style={{ color: mutedText }}>{ROLE_LABELS[userRole] ?? userRole}</p>
          </div>
          <svg
            className="w-3 h-3 shrink-0 transition-transform duration-200"
            style={{ color: mutedText, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="md:hidden fixed inset-y-0 left-0 z-50 flex h-full">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
