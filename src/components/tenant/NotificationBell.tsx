'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  isRead: boolean
  link: string | null
  createdAt: string
}

const TYPE_COLOUR: Record<string, string> = {
  leave:       'bg-sky-500',
  compliance:  'bg-red-500',
  onboarding:  'bg-green-500',
  payroll:     'bg-amber-500',
  document:    'bg-[#E0EEF4]0',
  training:    'bg-[#f0f7fb]0',
  performance: 'bg-[#0E3D52]',
  system:      'bg-gray-500',
}

export default function NotificationBell({ primaryColor }: { primaryColor: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [isDark, setIsDark]   = useState(false)
  const [mounted, setMounted] = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const unread = notifications.filter(n => !n.isRead).length

  useEffect(() => { setMounted(true) }, [])

  /* Detect dark mode */
  useEffect(() => {
    const check = () => {
      const html = document.documentElement
      setIsDark(
        html.classList.contains('dark') ||
        document.body.classList.contains('dark') ||
        html.getAttribute('data-theme') === 'dark'
      )
    }
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    obs.observe(document.body,            { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const fetchNotifications = useCallback((showLoader = false) => {
    if (showLoader) setLoading(true)
    fetchWithAuth('/api/tenant/notifications')
      .then(r => r.json())
      .then(d => setNotifications(d.notifications ?? []))
      .catch(() => {})
      .finally(() => { if (showLoader) setLoading(false) })
  }, [])

  useEffect(() => { fetchNotifications(true) }, [fetchNotifications])
  useEffect(() => {
    const id = setInterval(() => fetchNotifications(false), 30_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  /* Close on outside click */
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPanelPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    setOpen(o => !o)
  }

  async function markAllRead() {
    await fetchWithAuth('/api/tenant/notifications', { method: 'PATCH' })
    setNotifications(n => n.map(x => ({ ...x, isRead: true })))
  }

  async function markRead(id: string) {
    await fetchWithAuth('/api/tenant/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifications(n => n.map(x => x.id === id ? { ...x, isRead: true } : x))
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  }

  const panelBg    = isDark ? '#0f172a' : '#ffffff'
  const panelFg    = isDark ? '#f1f5f9' : '#111827'
  const dividerClr = isDark ? '#1e293b' : '#f3f4f6'
  const mutedFg    = isDark ? '#94a3b8' : '#6b7280'
  const hoverBg    = isDark ? '#1e293b' : '#f9fafb'

  const panel = (
    <div
      style={{
        position:     'fixed',
        top:          panelPos.top,
        right:        panelPos.right,
        width:        320,
        background:   panelBg,
        color:        panelFg,
        borderRadius: 12,
        border:       `1px solid ${dividerClr}`,
        boxShadow:    '0 8px 32px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.12)',
        zIndex:       2147483647,
        overflow:     'hidden',
        isolation:    'isolate',
        willChange:   'transform',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: panelBg, borderBottom: `1px solid ${dividerClr}` }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: panelFg }}>Notifications</span>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}>
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ maxHeight: 320, overflowY: 'auto', background: panelBg }}>
        {loading ? (
          <p style={{ padding: '24px 16px', fontSize: 13, color: mutedFg, textAlign: 'center', background: panelBg }}>Loading…</p>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', background: panelBg }}>
            <svg style={{ width: 32, height: 32, margin: '0 auto 8px', color: mutedFg, display: 'block' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p style={{ fontSize: 13, color: mutedFg }}>No notifications yet</p>
          </div>
        ) : notifications.map(n => (
          <button
            key={n.id}
            onClick={() => { markRead(n.id); setOpen(false) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 16px', textAlign: 'left', border: 'none', cursor: 'pointer',
              borderBottom: `1px solid ${dividerClr}`,
              background: !n.isRead ? (isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)') : panelBg,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hoverBg }}
            onMouseLeave={e => { e.currentTarget.style.background = !n.isRead ? (isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)') : panelBg }}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${TYPE_COLOUR[n.type] ?? 'bg-gray-400'}`} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: n.isRead ? 400 : 600, color: panelFg, margin: 0, lineHeight: 1.4 }}>{n.title}</p>
              {n.body && <p style={{ fontSize: 12, color: mutedFg, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>}
              <p style={{ fontSize: 11, color: mutedFg, margin: '4px 0 0' }}>{timeAgo(n.createdAt)}</p>
            </div>
            {!n.isRead && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: primaryColor, flexShrink: 0, marginTop: 6 }} />
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px', background: panelBg, borderTop: `1px solid ${dividerClr}`, textAlign: 'center' }}>
        <button
          onClick={() => { setOpen(false); router.push('/tenant/notifications') }}
          style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          View all notifications →
        </button>
      </div>
    </div>
  )

  return (
    <div className="relative" ref={triggerRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#0E3D52]/30 transition"
        aria-label="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            style={{ background: primaryColor }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Portal — renders directly into document.body, outside the header's backdrop-filter stacking context */}
      {mounted && open && createPortal(panel, document.body)}
    </div>
  )
}
