'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const ACCENT = '#7c3aed'

type Props = { name: string; email: string }

export default function AdminDropdown({ name, email }: Props) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const ref                   = useRef<HTMLDivElement>(null)
  const router                = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function logout() {
    setLoading(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-150 hover:bg-accent ${open ? 'bg-accent' : ''}`}
      >
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}bb)`, boxShadow: `0 0 8px ${ACCENT}50` }}>
          {initials}
        </div>
        <span className="text-[13px] text-muted-foreground font-medium hidden sm:block">{name}</span>
        <svg className="w-3 h-3 shrink-0 text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden z-50 bg-card border border-border shadow-xl">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[13px] font-semibold text-foreground">{name}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{email}</p>
            <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide badge-teal">
              Super Admin
            </span>
          </div>
          <div className="py-1">
            <Link href="/super-admin/settings" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </Link>
          </div>
          <div className="border-t border-border py-1">
            <button onClick={logout} disabled={loading}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-left text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              {loading ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
