'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import EmptyState from '@/components/ui/EmptyState'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  isRead: boolean
  createdAt: string
}

type AlertResult = {
  ok: boolean
  scanned: number
  sent: number
  failed: number
  details: { sent: string[]; failed: string[] }
}

// Icon color by notification type (bg/text)
const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  leave:           { bg: 'bg-green-50 dark:bg-green-900/20',  text: 'text-green-600 dark:text-green-400' },
  payroll:         { bg: 'bg-[#E8973A]/10',                   text: 'text-[#E8973A]' },
  onboarding:      { bg: 'bg-[#0E3D52]/[0.07] dark:bg-[#4ebac4]/10', text: 'text-[#1A6080] dark:text-[#4ebac4]' },
  compliance:      { bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-600 dark:text-amber-400' },
  document:        { bg: 'bg-[#0E3D52]/[0.07] dark:bg-[#4ebac4]/10', text: 'text-[#1A6080] dark:text-[#4ebac4]' },
  document_expiry: { bg: 'bg-amber-50 dark:bg-amber-900/20',  text: 'text-amber-500' },
  recruitment:     { bg: 'bg-[#0E3D52]/[0.07] dark:bg-[#4ebac4]/10', text: 'text-[#1A6080] dark:text-[#4ebac4]' },
  training:        { bg: 'bg-blue-50 dark:bg-blue-900/20',    text: 'text-blue-600 dark:text-blue-400' },
  performance:     { bg: 'bg-[#0E3D52]/[0.07] dark:bg-[#4ebac4]/10', text: 'text-[#1A6080] dark:text-[#4ebac4]' },
  system:          { bg: 'bg-gray-50 dark:bg-gray-800',       text: 'text-gray-500 dark:text-gray-400' },
  general:         { bg: 'bg-gray-50 dark:bg-gray-800',       text: 'text-gray-500 dark:text-gray-400' },
}
function NotifIcon({ type }: { type: string }) {
  const c = TYPE_COLOR[type] ?? TYPE_COLOR.general
  const paths: Record<string, JSX.Element> = {
    leave:           <><path d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0"/></>,
    payroll:         <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    document:        <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    document_expiry: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    compliance:      <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    recruitment:     <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    training:        <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    performance:     <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    onboarding:      <><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></>,
    system:          <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    general:         <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  }
  const path = paths[type] ?? paths.general
  return (
    <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center shrink-0 ring-1 ring-black/[0.04] dark:ring-white/[0.06]`}>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={c.text}>{path}</svg>
    </div>
  )
}

const ALL_TYPES = Object.keys(TYPE_COLOR)

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,    setLoading]    = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [running,    setRunning]    = useState(false)
  const [daysAhead,  setDaysAhead]  = useState(7)
  const [result,     setResult]     = useState<AlertResult | null>(null)
  const [error,      setError]      = useState('')
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  async function load() {
    setLoading(true)
    const res = await fetchWithAuth('/api/tenant/notifications')
    if (res.ok) {
      const d = await res.json()
      setNotifications(d.notifications ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markAllRead() {
    await fetchWithAuth('/api/tenant/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setNotifications(n => n.map(x => ({ ...x, isRead: true })))
  }

  async function markRead(id: string) {
    await fetchWithAuth('/api/tenant/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setNotifications(n => n.map(x => x.id === id ? { ...x, isRead: true } : x))
  }

  async function dismiss(id: string) {
    await fetchWithAuth(`/api/tenant/notifications?id=${id}`, { method: 'DELETE' })
    setNotifications(n => n.filter(x => x.id !== id))
  }

  async function clearAll() {
    setConfirmState({
      message: 'Clear all notifications? This cannot be undone.',
      onConfirm: async () => {
        await fetchWithAuth('/api/tenant/notifications', { method: 'DELETE' })
        setNotifications([])
      }
    })
  }

  async function runExpiryCheck() {
    setRunning(true); setError(''); setResult(null)
    try {
      const res = await fetchWithAuth('/api/tenant/notifications/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysAhead }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Failed'); return }
      setResult(d)
    } catch { setError('Request failed') }
    finally { setRunning(false) }
  }

  const unread   = notifications.filter(n => !n.isRead).length
  const filtered = typeFilter ? notifications.filter(n => n.type === typeFilter) : notifications
  const presentTypes = [...new Set(notifications.map(n => n.type))].filter(t => ALL_TYPES.includes(t))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-premium-title">Notifications</h1>
          <p className="page-premium-subtitle mt-0.5">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <button onClick={markAllRead}
              className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white rounded-lg transition">
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll}
              className="text-sm px-3 py-1.5 border border-red-800 text-red-400 hover:bg-red-900/20 rounded-lg transition">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Email Alert Panel */}
      <div className="card-premium rounded-2xl p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Document Expiry Alerts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Scan for compliance documents expiring soon and email employees + compliance managers.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notify if expiring within</label>
          <select value={daysAhead} onChange={e => setDaysAhead(Number(e.target.value))}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-white">
            {[3, 7, 14, 30].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-300 mb-3">{error}</div>
        )}

        {result && (
          <div className={`rounded-xl p-4 mb-4 border ${result.sent > 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              {result.sent > 0 ? 'Alerts sent' : 'ℹ️ Scan complete'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Scanned <strong>{result.scanned}</strong> expiring document{result.scanned !== 1 ? 's' : ''} ·
              <strong className="text-green-600 dark:text-green-400"> {result.sent}</strong> email{result.sent !== 1 ? 's' : ''} sent
              {result.failed > 0 && <span className="text-red-400"> · {result.failed} failed</span>}
            </p>
            {result.details.sent.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {result.details.sent.map((s, i) => (
                  <li key={i} className="text-xs text-gray-500 dark:text-gray-400">{s}</li>
                ))}
              </ul>
            )}
            {result.details.failed.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {result.details.failed.map((s, i) => (
                  <li key={i} className="text-xs text-red-400">{s}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button onClick={runExpiryCheck} disabled={running}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90"
          style={{ background: 'var(--primary)' }}>
          {running ? 'Scanning & sending…' : `Run expiry check (${daysAhead} days)`}
        </button>

        <p className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 mt-3">
          To automate this daily, add <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">vercel.json</code> with a cron job — see setup guide below.
        </p>
      </div>

      {/* Cron Setup Hint */}
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2 text-sm">⏰ Automate with Vercel Cron</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Add this to <code>vercel.json</code> in your project root to run expiry alerts every day at 7am UTC:</p>
        <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">{`{
  "crons": [
    {
      "path": "/api/tenant/notifications/send",
      "schedule": "0 7 * * *"
    }
  ]
}`}</pre>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Also add <code>RESEND_API_KEY</code>, <code>RESEND_FROM</code>, and <code>APP_URL</code> to your Vercel environment variables.</p>
      </div>

      {/* In-app Notifications */}
      <div className="card-premium rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-semibold text-gray-900 dark:text-white">In-app Notifications</h2>

          {/* Type filter tabs */}
          {presentTypes.length > 1 && (
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setTypeFilter('')}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${typeFilter === '' ? 'bg-[#0E3D52] border-[#0E3D52] text-white' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white'}`}>
                All ({notifications.length})
              </button>
              {presentTypes.map(t => (
                <button key={t}
                  onClick={() => setTypeFilter(t === typeFilter ? '' : t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${typeFilter === t ? 'bg-[#0E3D52] border-[#0E3D52] text-white' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white'}`}>
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-gray-600 dark:text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="No notifications"
            message={typeFilter ? `No ${typeFilter} notifications.` : 'System notifications will appear here.'}
          />
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map(n => {
              const isClickable = !!n.link
              const Wrapper = isClickable ? 'a' : 'div'
              const wrapperProps = isClickable
                ? { href: n.link!, onClick: () => !n.isRead && markRead(n.id) }
                : {}
              return (
                <li key={n.id}
                  className={`flex gap-3 px-5 py-4 transition group ${!n.isRead ? 'bg-[#E0EEF4] dark:bg-[#0E3D52]/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
                  <NotifIcon type={n.type ?? 'general'} />
                  <Wrapper {...(wrapperProps as any)} className={`flex-1 min-w-0 ${isClickable ? 'cursor-pointer' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium leading-snug ${!n.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} ${isClickable ? 'hover:text-[#1A6080] dark:text-[#4ebac4] transition' : ''}`}>
                        {n.title}
                        {isClickable && <span className="ml-1 text-[#0E3D52] dark:text-[#4ebac4] text-xs">→</span>}
                      </p>
                      <span className="text-xs text-gray-500 dark:text-gray-500 shrink-0">{relativeTime(n.createdAt)}</span>
                    </div>
                    {n.body && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>}
                  </Wrapper>
                  <div className="flex items-start gap-1 shrink-0 ml-1">
                    {!n.isRead && (
                      <button onClick={() => markRead(n.id)}
                        className="text-xs text-[#1A6080] dark:text-[#4ebac4] hover:text-[#7dcfd7] transition px-1 py-0.5 opacity-0 group-hover:opacity-100"
                        title="Mark read">
                        ✓
                      </button>
                    )}
                    <button onClick={() => dismiss(n.id)}
                      className="text-xs text-gray-600 dark:text-gray-500 hover:text-red-400 transition px-1 py-0.5 opacity-0 group-hover:opacity-100"
                      title="Dismiss">
                      ✕
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-500">
            {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
            {typeFilter && ` · filtered by ${typeFilter}`}
            {unread > 0 && ` · ${unread} unread`}
          </div>
        )}
      </div>
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
