'use client'

import { useState } from 'react'
import AdminDropdown from '@/components/auth/AdminDropdown'
import ThemeToggle from '@/components/ui/ThemeToggle'
import AdminSidebar from '@/components/super-admin/AdminSidebar'

const ACCENT = '#0E3D52'

type Props = {
  children: React.ReactNode
  name:     string
  email:    string
}

export default function AdminLayoutShell({ children, name, email }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen text-foreground overflow-hidden bg-background">

      <AdminSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-4 md:px-5 flex-shrink-0 backdrop-blur-md bg-card/90 dark:bg-[#070c1a]/92 border-b border-border dark:border-white/[0.05]">
          <div className="flex items-center gap-2 md:gap-2.5">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition mr-0.5"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Purple accent pill — desktop only */}
            <div
              className="w-1 h-4 rounded-full shrink-0 hidden md:block"
              style={{ background: `linear-gradient(to bottom, ${ACCENT}, ${ACCENT}88)` }}
            />
            <span className="text-[13px] font-medium text-muted-foreground tracking-wide select-none truncate">
              Platform Administration
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle className="p-2 rounded-lg text-muted-foreground hover:text-amber-500 hover:bg-accent transition" />
            <AdminDropdown name={name} email={email} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
