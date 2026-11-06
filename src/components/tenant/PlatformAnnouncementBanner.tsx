'use client'

/**
 * PlatformAnnouncementBanner
 *
 * Fetches active platform-wide announcements from the super admin and
 * renders a dismissible strip above the page content for each one.
 * Dismissed IDs are stored in sessionStorage so they don't reappear
 * within the same browser session.
 */

import { useEffect, useState } from 'react'

type Announcement = {
  id:        string
  title:     string
  body:      string
  priority:  'info' | 'warning' | 'critical'
  expiresAt: string | null
  createdAt: string
}

const PRIORITY_STYLES: Record<'info' | 'warning' | 'critical', {
  bg: string; border: string; icon: string; titleColor: string; textColor: string; closeColor: string
}> = {
  info: {
    bg:         'bg-[#E0EEF4] dark:bg-blue-950/50',
    border:     'border-blue-200 dark:border-[#1A6080]',
    icon:       'ℹ',
    titleColor: 'text-blue-800 dark:text-blue-200',
    textColor:  'text-[#0E3D52] dark:text-[#7dcfd7]',
    closeColor: 'text-[#4ebac4] hover:text-[#0E3D52] dark:text-[#1A6080] dark:text-[#4ebac4] dark:hover:text-blue-200',
  },
  warning: {
    bg:         'bg-amber-50 dark:bg-amber-950/50',
    border:     'border-amber-200 dark:border-amber-700',
    icon:       '⚠',
    titleColor: 'text-amber-800 dark:text-amber-200',
    textColor:  'text-amber-700 dark:text-amber-300',
    closeColor: 'text-amber-400 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-200',
  },
  critical: {
    bg:         'bg-red-50 dark:bg-red-950/50',
    border:     'border-red-200 dark:border-red-700',
    icon:       '🚨',
    titleColor: 'text-red-800 dark:text-red-200',
    textColor:  'text-red-700 dark:text-red-300',
    closeColor: 'text-red-400 hover:text-red-700 dark:text-red-500 dark:hover:text-red-200',
  },
}

const SESSION_KEY = 'hrms_dismissed_platform_announcements'

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveDismissed(ids: Set<string>) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids])) } catch {}
}

export default function PlatformAnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissed,     setDismissed]     = useState<Set<string>>(new Set())

  useEffect(() => {
    setDismissed(getDismissed())
    fetch('/api/tenant/platform-announcements')
      .then(r => r.ok ? r.json() : { announcements: [] })
      .then(d => setAnnouncements(d.announcements ?? []))
      .catch(() => {})
  }, [])

  function dismiss(id: string) {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }

  const visible = announcements.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-0">
      {visible.map(ann => {
        const s = PRIORITY_STYLES[ann.priority] ?? PRIORITY_STYLES.info
        return (
          <div
            key={ann.id}
            className={`flex items-start gap-3 px-4 py-3 border-b text-sm ${s.bg} ${s.border}`}
          >
            <span className="shrink-0 text-base leading-none mt-0.5">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <span className={`font-semibold mr-2 ${s.titleColor}`}>{ann.title}</span>
              <span className={s.textColor}>{ann.body}</span>
            </div>
            <button
              onClick={() => dismiss(ann.id)}
              aria-label="Dismiss"
              className={`shrink-0 text-lg leading-none transition ${s.closeColor}`}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
