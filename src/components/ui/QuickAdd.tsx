'use client'

/**
 * ⌘N / Ctrl+N global quick-add picker.
 * Mount once in TenantLayoutShell alongside CommandPalette.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type QuickAddOption = {
  label: string
  description: string
  href: string
  icon: string
  shortcut?: string
}

const OPTIONS: QuickAddOption[] = [
  { label: 'New Employee',     description: 'Add a new team member',           href: '/tenant/employee-management/new', icon: '👤', shortcut: 'E' },
  { label: 'New Document',     description: 'Upload or create a document',     href: '/tenant/documents',              icon: '📄', shortcut: 'D' },
  { label: 'New Participant',  description: 'Add a new participant / client',  href: '/tenant/participants',            icon: '🧑', shortcut: 'P' },
  { label: 'New Leave Request',description: 'Submit a leave request',          href: '/tenant/leave',                  icon: '🏖️', shortcut: 'L' },
  { label: 'New Incident',     description: 'Log a WHS incident',              href: '/tenant/whs',                    icon: '⚠️', shortcut: 'I' },
]

export default function QuickAdd() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        setOpen(v => !v)
        setCursor(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, OPTIONS.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter') { navigate(OPTIONS[cursor].href) }
    const opt = OPTIONS.find(o => o.shortcut?.toLowerCase() === e.key.toLowerCase())
    if (opt) { navigate(opt.href) }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[20vh] px-4 bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-[#0F1E2E] rounded-xl shadow-xl border border-gray-200 dark:border-[#1A6080]/30 overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#1A6080]/20 flex items-center gap-2">
          <span className="text-lg">➕</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Quick Add</span>
          <kbd className="ml-auto text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-[#0A1929] px-1.5 py-0.5 rounded border border-gray-200 dark:border-[#1A6080]/30">ESC</kbd>
        </div>
        <div className="py-1">
          {OPTIONS.map((opt, idx) => (
            <button
              key={opt.href}
              onClick={() => navigate(opt.href)}
              onMouseEnter={() => setCursor(idx)}
              className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${
                idx === cursor
                  ? 'bg-[#E0EEF4] dark:bg-[#0E3D52]/20'
                  : 'hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30/50'
              }`}
            >
              <span className="text-xl flex-shrink-0">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${idx === cursor ? 'text-[#0E3D52] dark:text-[#4ebac4]' : 'text-gray-900 dark:text-white'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-gray-400 truncate">{opt.description}</p>
              </div>
              {opt.shortcut && (
                <kbd className="flex-shrink-0 text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-[#0A1929] px-1.5 py-0.5 rounded border border-gray-200 dark:border-[#1A6080]/30">
                  {opt.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-gray-100 dark:border-[#1A6080]/20 flex gap-4 text-[10px] text-gray-400">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>letter shortcut</span>
        </div>
      </div>
    </div>
  )
}
