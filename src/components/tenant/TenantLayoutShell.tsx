'use client'

import { useState } from 'react'
import ThemeToggle from '@/components/ui/ThemeToggle'
import NotificationBell from '@/components/tenant/NotificationBell'
import TenantSidebar from '@/components/tenant/TenantSidebar'
import TenantUserDropdown from '@/components/tenant/TenantUserDropdown'
import CommandPalette from '@/components/ui/CommandPalette'
import QuickAdd from '@/components/ui/QuickAdd'
import PlatformAnnouncementBanner from '@/components/tenant/PlatformAnnouncementBanner'
import Breadcrumbs from '@/components/tenant/Breadcrumbs'

type NavItem = { key: string; label: string }

type Props = {
  children:     React.ReactNode
  navItems:     NavItem[]
  sidebarBg:    string
  primaryColor: string
  tenantName:   string
  logoUrl:      string
  userEmail:    string
  userInitial:  string
  userRole:     string
  borderRadius: string
}

export default function TenantLayoutShell({
  children, navItems, sidebarBg, primaryColor, tenantName,
  logoUrl, userEmail, userInitial, userRole, borderRadius,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[#EDF1F5] dark:bg-[#050c14] overflow-hidden">
      {/* Sidebar — hidden on mobile unless open */}
      <TenantSidebar
        navItems={navItems}
        sidebarBg={sidebarBg}
        primaryColor={primaryColor}
        tenantName={tenantName}
        logoUrl={logoUrl}
        userEmail={userEmail}
        userInitial={userInitial}
        userRole={userRole}
        borderRadius={borderRadius}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 md:px-5 bg-white/90 dark:bg-[#060e1c]/95 backdrop-blur-md shrink-0 border-b border-black/[0.05] dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition mr-1"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div
              className="w-1.5 h-4 rounded-full hidden md:block"
              style={{ background: `linear-gradient(180deg, ${primaryColor}, ${primaryColor}60)` }}
            />
            <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 tracking-tight truncate max-w-[120px] sm:max-w-none">
              {tenantName}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* ⌘K search hint — opens CommandPalette */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }))}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-gray-400 bg-gray-100 dark:bg-white/[0.05] rounded-md border border-gray-200 dark:border-white/[0.07] hover:bg-gray-200 dark:hover:bg-white/[0.09] transition mr-1"
              aria-label="Open search"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <span>Search</span>
              <kbd className="text-[9px] opacity-50 font-mono">⌘K</kbd>
            </button>
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true, ctrlKey: true, bubbles: true }))}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-gray-400 bg-gray-100 dark:bg-white/[0.05] rounded-md border border-gray-200 dark:border-white/[0.07] hover:bg-gray-200 dark:hover:bg-white/[0.09] transition mr-1"
              aria-label="Quick add"
            >
              <span className="text-sm leading-none">＋</span>
              <kbd className="text-[9px] opacity-50 font-mono">⌘N</kbd>
            </button>
            <ThemeToggle className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition" />
            <NotificationBell primaryColor={primaryColor} />
            <div className="w-px h-4 bg-gray-200 dark:bg-white/[0.08] mx-1" />
            <TenantUserDropdown
              email={userEmail}
              role={userRole}
              initial={userInitial}
              primaryColor={primaryColor}
              borderRadius={borderRadius}
            />
          </div>
        </header>

        {/* Platform-wide announcement banner (super admin broadcasts) */}
        <PlatformAnnouncementBanner />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 bg-[#EDF1F5] dark:bg-[#050c14]">
          <Breadcrumbs />
          {children}
        </main>
      </div>

      {/* Global ⌘K command palette — mounts once, handles its own open/close state */}
      <CommandPalette />
      {/* Global ⌘N quick-add picker — mounts once, handles its own open/close state */}
      <QuickAdd />
    </div>
  )
}
