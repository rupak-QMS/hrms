'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

interface Announcement {
  id: string
  title: string
  body: string
  priority: 'info' | 'warning' | 'critical'
  targetRole: string | null
  publishedAt: string | null
  expiresAt: string | null
  createdBy: string | null
  createdAt: string
}

const PRIORITY_OPTIONS = [
  { value: 'info',     label: 'Info',     badge: 'badge badge-blue' },
  { value: 'warning',  label: 'Warning',  badge: 'badge badge-amber' },
  { value: 'critical', label: 'Critical', badge: 'badge badge-red' },
]

const ROLE_OPTIONS = [
  { value: '',           label: 'All Roles' },
  { value: 'admin',      label: 'Admin' },
  { value: 'manager',    label: 'Manager' },
  { value: 'employee',   label: 'Employee' },
  { value: 'contractor', label: 'Contractor' },
]

function priorityBadge(p: string) {
  const opt = PRIORITY_OPTIONS.find(o => o.value === p)
  return opt ? opt.badge : 'badge badge-gray'
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

const EMPTY_FORM = {
  title: '',
  body: '',
  priority: 'info',
  targetRole: '',
  publishedAt: '',
  expiresAt: '',
}

export default function EssAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState<Announcement | null>(null)
  const [form, setForm]         = useState({ ...EMPTY_FORM })
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [search, setSearch]     = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchWithAuth('/api/tenant/self-service/announcements/all')
      const data = await res.json()
      setAnnouncements(data.announcements ?? [])
    } catch {
      setError('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(a: Announcement) {
    setEditing(a)
    setForm({
      title:       a.title,
      body:        a.body,
      priority:    a.priority,
      targetRole:  a.targetRole ?? '',
      publishedAt: a.publishedAt ? a.publishedAt.slice(0, 16) : '',
      expiresAt:   a.expiresAt   ? a.expiresAt.slice(0, 16)   : '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        title:       form.title.trim(),
        body:        form.body.trim(),
        priority:    form.priority,
        targetRole:  form.targetRole || null,
        publishedAt: form.publishedAt || null,
        expiresAt:   form.expiresAt   || null,
      }
      const res = await fetchWithAuth('/api/tenant/self-service/announcements', {
        method:  editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      setShowModal(false)
      await load()
    } catch {
      setSaveError('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetchWithAuth(`/api/tenant/self-service/announcements?id=${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDeleteId(null)
      await load()
    } catch {
      setDeleteError('Delete failed. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  function exportAnnouncementsCsv() {
    exportCsv({
      filename: 'ess-announcements',
      columns: [
        { header: 'Title',          key: 'title' },
        { header: 'Body',           key: 'body' },
        { header: 'Published Date', key: 'publishedAt',  format: fmtCsvDate },
        { header: 'Author',         key: 'createdBy',    format: v => (v as string) ?? '' },
        { header: 'Target Role',    key: 'targetRole',   format: v => (v as string) ?? 'All' },
        { header: 'Priority',       key: 'priority' },
      ],
      rows: announcements,
    })
  }

  const filtered = announcements.filter(a => {
    if (filterPriority && a.priority !== filterPriority) return false
    if (search) {
      const q = search.toLowerCase()
      return a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)
    }
    return true
  })

  const active  = filtered.filter(a => !isExpired(a.expiresAt))
  const expired = filtered.filter(a =>  isExpired(a.expiresAt))

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-premium-title">Announcements</h1>
          <p className="page-premium-subtitle">Manage ESS announcements visible to employees</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Announcement
        </button>
        <ExportButton onClick={exportAnnouncementsCsv} disabled={announcements.length === 0} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search announcements…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-premium w-56"
        />
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="input-premium w-36"
        >
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : error ? (
        <div className="card-premium p-6 text-red-600 dark:text-red-400">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No announcements found</p>
          <button onClick={openCreate} className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
            Create your first announcement
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active */}
          {active.length > 0 && (
            <section>
              <p className="section-label mb-3">Active ({active.length})</p>
              <AnnouncementTable rows={active} onEdit={openEdit} onDelete={setDeleteId} />
            </section>
          )}

          {/* Expired */}
          {expired.length > 0 && (
            <section>
              <p className="section-label mb-3">Expired ({expired.length})</p>
              <AnnouncementTable rows={expired} onEdit={openEdit} onDelete={setDeleteId} dimmed />
            </section>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="card-premium w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editing ? 'Edit Announcement' : 'New Announcement'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="section-label block mb-1">Title *</label>
                  <input
                    className="input-premium w-full"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Announcement title"
                  />
                </div>

                <div>
                  <label className="section-label block mb-1">Message *</label>
                  <textarea
                    className="input-premium w-full min-h-[100px] resize-y"
                    value={form.body}
                    onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    placeholder="Announcement message…"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="section-label block mb-1">Priority</label>
                    <select
                      className="input-premium w-full"
                      value={form.priority}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    >
                      {PRIORITY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="section-label block mb-1">Target Role</label>
                    <select
                      className="input-premium w-full"
                      value={form.targetRole}
                      onChange={e => setForm(f => ({ ...f, targetRole: e.target.value }))}
                    >
                      {ROLE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="section-label block mb-1">Publish Date</label>
                    <input
                      type="datetime-local"
                      className="input-premium w-full"
                      value={form.publishedAt}
                      onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="section-label block mb-1">Expires At</label>
                    <input
                      type="datetime-local"
                      className="input-premium w-full"
                      value={form.expiresAt}
                      onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {saveError && (
                <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowModal(false); setSaveError('') }}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim() || !form.body.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="card-premium w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Delete announcement?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">This cannot be undone.</p>
            {deleteError && (
              <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeleteId(null); setDeleteError('') }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AnnouncementTable({
  rows,
  onEdit,
  onDelete,
  dimmed = false,
}: {
  rows: Announcement[]
  onEdit: (a: Announcement) => void
  onDelete: (id: string) => void
  dimmed?: boolean
}) {
  return (
    <div className={`table-responsive ${dimmed ? 'opacity-60' : ''}`}>
      <table className="table-premium">
        <thead>
          <tr>
            <th>Title</th>
            <th>Priority</th>
            <th>Target</th>
            <th>Published</th>
            <th>Expires</th>
            <th>Created By</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(a => (
            <tr key={a.id}>
              <td>
                <div className="font-medium text-gray-900 dark:text-white">{a.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{a.body}</div>
              </td>
              <td>
                <span className={priorityBadge(a.priority)}>
                  {a.priority.charAt(0).toUpperCase() + a.priority.slice(1)}
                </span>
              </td>
              <td className="text-gray-600 dark:text-gray-300 capitalize">
                {a.targetRole ?? 'All'}
              </td>
              <td className="text-gray-600 dark:text-gray-300">{formatDate(a.publishedAt)}</td>
              <td className="text-gray-600 dark:text-gray-300">{formatDate(a.expiresAt)}</td>
              <td className="text-gray-500 dark:text-gray-400 text-xs">{a.createdBy ?? '—'}</td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onEdit(a)}
                    className="text-xs px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(a.id)}
                    className="text-xs px-2.5 py-1 rounded-md border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
