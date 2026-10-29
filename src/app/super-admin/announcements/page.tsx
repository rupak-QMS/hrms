'use client'

import { useEffect, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type Priority = 'info' | 'warning' | 'critical'

type Announcement = {
  id:            string
  title:         string
  body:          string
  priority:      Priority
  targetTenants: string
  expiresAt:     string | null
  createdAt:     string
  createdBy:     string
  isActive:      boolean
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#7c3aed'

const PRIORITY_CONFIG: Record<Priority, {
  label: string
  icon: string
  dot: string
  badgeClass: string
  borderLight: string
  borderDark: string
  glowLight: string
  glowDark: string
}> = {
  info: {
    label:       'Info',
    icon:        'ℹ',
    dot:         '#3b82f6',
    badgeClass:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50',
    borderLight: 'rgba(59,130,246,0.2)',
    borderDark:  'rgba(96,165,250,0.15)',
    glowLight:   'rgba(59,130,246,0.04)',
    glowDark:    'rgba(96,165,250,0.06)',
  },
  warning: {
    label:       'Warning',
    icon:        '⚠',
    dot:         '#f59e0b',
    badgeClass:  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/50',
    borderLight: 'rgba(245,158,11,0.2)',
    borderDark:  'rgba(251,191,36,0.15)',
    glowLight:   'rgba(245,158,11,0.04)',
    glowDark:    'rgba(251,191,36,0.06)',
  },
  critical: {
    label:       'Critical',
    icon:        '🚨',
    dot:         '#ef4444',
    badgeClass:  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50',
    borderLight: 'rgba(239,68,68,0.2)',
    borderDark:  'rgba(248,113,113,0.2)',
    glowLight:   'rgba(239,68,68,0.04)',
    glowDark:    'rgba(248,113,113,0.08)',
  },
}

const EMPTY_FORM = {
  title: '', body: '', priority: 'info', targetTenants: 'all', expiresAt: '',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const c = PRIORITY_CONFIG[priority]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${c.badgeClass}`}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.dot }} />
      {c.label}
    </span>
  )
}

function fmtDate(d: string | number | null) {
  if (!d) return null
  return new Date(d).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isExpired(expiresAt: string | null) {
  return expiresAt ? new Date(expiresAt) < new Date() : false
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  function load() {
    setLoading(true)
    fetch('/api/super-admin/announcements')
      .then(r => r.json())
      .then(d => { setAnnouncements(d.announcements ?? []); setLoading(false) })
      .catch(err => { setError('Unable to load announcements — please refresh.'); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  async function publish() {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/super-admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, expiresAt: form.expiresAt || null }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to publish'); setSaving(false); return }
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
      load()
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  async function toggleActive(id: string, current: boolean) {
    await fetch('/api/super-admin/announcements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !current }),
    })
    setAnnouncements(a => a.map(x => x.id === id ? { ...x, isActive: !current } : x))
  }

  async function deleteAnn(id: string) {
    if (!confirm('Permanently delete this announcement?')) return
    await fetch(`/api/super-admin/announcements?id=${id}`, { method: 'DELETE' })
    setAnnouncements(a => a.filter(x => x.id !== id))
  }

  const active   = announcements.filter(a => a.isActive && !isExpired(a.expiresAt))
  const inactive = announcements.filter(a => !a.isActive || isExpired(a.expiresAt))

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Platform Announcements</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Broadcast notices to all tenants — shown as a banner in every client dashboard and delivered by email.
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(null) }}
          className="shrink-0 text-[13px] font-semibold px-4 py-2 rounded-lg text-white transition-all"
          style={{
            background: showForm ? 'transparent' : `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`,
            boxShadow:  showForm ? 'none' : `0 0 20px ${ACCENT}40`,
            color:      showForm ? ACCENT : 'white',
            border:     showForm ? `1px solid ${ACCENT}40` : 'none',
          }}
        >
          {showForm ? '✕ Cancel' : '+ New Announcement'}
        </button>
      </div>

      {/* Summary row */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active',   value: active.length,        accent: '#22c55e' },
            { label: 'Inactive', value: inactive.length,      accent: 'hsl(var(--muted-foreground))' },
            { label: 'Total',    value: announcements.length, accent: 'hsl(var(--foreground))' },
          ].map(c => (
            <div key={c.label} className="card-premium p-4">
              <p className="section-label mb-1">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: c.accent }}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="card-premium p-5 space-y-4" style={{ borderColor: `${ACCENT}30` }}>
          <p className="text-[13px] font-semibold text-purple-600 dark:text-purple-400">New Announcement</p>

          <div>
            <label className="section-label mb-1.5 block">Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Scheduled maintenance on 15 Sep"
              className="input-premium"
            />
          </div>

          <div>
            <label className="section-label mb-1.5 block">Message *</label>
            <textarea
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={3}
              placeholder="Enter the message all tenants will see…"
              className="input-premium resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="section-label mb-1.5 block">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="input-premium"
              >
                <option value="info">ℹ Info</option>
                <option value="warning">⚠ Warning</option>
                <option value="critical">🚨 Critical</option>
              </select>
            </div>
            <div>
              <label className="section-label mb-1.5 block">Audience</label>
              <select
                value={form.targetTenants}
                onChange={e => setForm(f => ({ ...f, targetTenants: e.target.value }))}
                className="input-premium"
              >
                <option value="all">All Tenants</option>
              </select>
            </div>
            <div>
              <label className="section-label mb-1.5 block">Expires (optional)</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="input-premium"
              />
            </div>
          </div>

          {error && <p className="text-[12px] text-red-500 dark:text-red-400">{error}</p>}

          <button
            onClick={publish}
            disabled={saving || !form.title.trim() || !form.body.trim()}
            className="text-[13px] font-semibold px-5 py-2 rounded-lg text-white transition disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)` }}
          >
            {saving ? 'Publishing…' : 'Publish Announcement'}
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl animate-pulse bg-muted" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && announcements.length === 0 && (
        <div className="card-premium p-14 text-center">
          <p className="text-4xl mb-3">📢</p>
          <p className="text-[14px] font-medium text-foreground/60">No announcements yet</p>
          <p className="text-[12px] text-muted-foreground mt-1">Create one to broadcast a message to all client tenants</p>
        </div>
      )}

      {/* Active announcements */}
      {active.length > 0 && (
        <section className="space-y-3">
          <p className="section-label">Active ({active.length})</p>
          {active.map(ann => <AnnCard key={ann.id} ann={ann} onToggle={toggleActive} onDelete={deleteAnn} />)}
        </section>
      )}

      {/* Inactive / expired */}
      {inactive.length > 0 && (
        <section className="space-y-3">
          <p className="section-label mt-2">Inactive / Expired ({inactive.length})</p>
          {inactive.map(ann => <AnnCard key={ann.id} ann={ann} onToggle={toggleActive} onDelete={deleteAnn} dimmed />)}
        </section>
      )}
    </div>
  )
}

// ── Card ─────────────────────────────────────────────────────────────────────

function AnnCard({
  ann, onToggle, onDelete, dimmed = false,
}: {
  ann: Announcement
  onToggle: (id: string, current: boolean) => void
  onDelete: (id: string) => void
  dimmed?: boolean
}) {
  const p   = PRIORITY_CONFIG[ann.priority] ?? PRIORITY_CONFIG.info
  const exp = isExpired(ann.expiresAt)

  return (
    <div
      className={`card-premium p-4 transition-opacity ${dimmed ? 'opacity-60' : ''}`}
      style={{
        borderColor: dimmed ? undefined : `color-mix(in srgb, ${p.dot} 25%, transparent)`,
        background: dimmed
          ? undefined
          : `color-mix(in srgb, ${p.dot} 5%, hsl(var(--card)))`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-[18px] shrink-0 mt-0.5 leading-none">{p.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="text-[13px] font-semibold text-foreground">{ann.title}</span>
            <PriorityBadge priority={ann.priority} />
            {!ann.isActive && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">Inactive</span>
            )}
            {exp && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-red-200 dark:border-red-700/40 text-red-500 dark:text-red-400">Expired</span>
            )}
            <span className="text-[11px] text-muted-foreground">
              → {ann.targetTenants === 'all' ? 'All tenants' : ann.targetTenants}
            </span>
          </div>

          <p className="text-[12px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{ann.body}</p>

          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground/60">
            <span>By {ann.createdBy}</span>
            <span>{fmtDate(ann.createdAt)}</span>
            {ann.expiresAt && !exp && <span>Expires {fmtDate(ann.expiresAt)}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggle(ann.id, ann.isActive)}
            className={`text-[11px] px-3 py-1 rounded-lg border transition ${
              ann.isActive
                ? 'border-border text-muted-foreground hover:border-red-300 hover:text-red-500 dark:hover:text-red-400'
                : 'border-green-300 dark:border-green-700/50 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
            }`}
          >
            {ann.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => onDelete(ann.id)}
            className="text-[11px] text-red-400/70 hover:text-red-500 dark:hover:text-red-400 px-2 py-1 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
