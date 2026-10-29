'use client'

import { useEffect, useState } from 'react'

type Admin = {
  id: string
  name: string
  email: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

export default function AdminsPage() {
  const [admins,    setAdmins]    = useState<Admin[]>([])
  const [loading,   setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  useEffect(() => {
    fetch('/api/super-admin/admins')
      .then(r => r.json())
      .then(d => { setAdmins(d.admins ?? []); setLoading(false) })
      .catch(() => { setFetchError('Unable to load admins — please refresh.'); setLoading(false) })
  }, [])

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const res  = await fetch('/api/super-admin/admins', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create admin')
      setAdmins(a => [...a, { ...data.admin, lastLoginAt: null }])
      setForm({ name: '', email: '', password: '' })
      setShowForm(false)
      setFormSuccess(`${data.admin.name} added as super admin.`)
      setTimeout(() => setFormSuccess(''), 4000)
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(admin: Admin) {
    await fetch('/api/super-admin/admins', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: admin.id, isActive: !admin.isActive }),
    })
    setAdmins(a => a.map(x => x.id === admin.id ? { ...x, isActive: !x.isActive } : x))
  }

  async function deleteAdmin(admin: Admin) {
    if (!confirm(`Remove "${admin.name}" (${admin.email}) as super admin? This cannot be undone.`)) return
    await fetch('/api/super-admin/admins', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id: admin.id }),
    })
    setAdmins(a => a.filter(x => x.id !== admin.id))
  }

  if (loading) return <div className="text-gray-600 dark:text-gray-400">Loading…</div>

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Super Admins</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Platform-level administrator accounts</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setFormError('') }}
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {showForm ? 'Cancel' : '+ Add Admin'}
        </button>
      </div>

      {fetchError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-400 text-sm">
          {fetchError}
        </div>
      )}

      {formSuccess && (
        <div className="bg-green-50 dark:bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">{formSuccess}</div>
      )}

      {/* Add admin form */}
      {showForm && (
        <form onSubmit={createAdmin} className="bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-purple-700 dark:text-purple-300">New Super Admin</h2>
          {formError && (
            <div className="bg-red-50 dark:bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg p-2 text-xs text-red-700 dark:text-red-300">{formError}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Jane Smith"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane@example.com"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password *</label>
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="min 8 characters"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
            >
              {saving ? 'Creating…' : 'Create Super Admin'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError('') }}
              className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white text-sm px-4 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Admin</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Last Login</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Added</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 && !fetchError && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-500 text-sm dark:text-gray-400">
                  No super admins found.{' '}
                  <button onClick={() => setShowForm(true)} className="text-purple-600 dark:text-purple-400 hover:underline">Add the first one →</button>
                </td>
              </tr>
            )}
            {admins.map(a => (
              <tr key={a.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-200 text-xs font-bold shrink-0">
                      {a.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-gray-900 dark:text-white font-medium text-sm">{a.name}</p>
                      <p className="text-gray-600 dark:text-gray-400 text-xs">{a.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => toggleActive(a)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition ${
                      a.isActive
                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-red-100 dark:bg-red-900 hover:text-red-700 dark:text-red-300'
                        : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-green-100 dark:bg-green-900 hover:text-green-700 dark:text-green-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${a.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                    {a.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 text-xs">
                  {a.lastLoginAt
                    ? new Date(a.lastLoginAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Never'}
                </td>
                <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 text-xs">
                  {new Date(a.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-3.5">
                  {admins.length > 1 ? (
                    <button
                      onClick={() => deleteAdmin(a)}
                      className="text-xs text-red-400 hover:text-red-700 dark:text-red-300 font-medium"
                    >
                      Delete
                    </button>
                  ) : (
                    <span className="text-xs text-gray-600 dark:text-gray-400">Last admin</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Only show the warning when admins are loaded and there's exactly one */}
      {admins.length === 1 && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-700 dark:text-amber-300">
          ⚠️ The last remaining admin cannot be deleted.
        </div>
      )}
    </div>
  )
}
