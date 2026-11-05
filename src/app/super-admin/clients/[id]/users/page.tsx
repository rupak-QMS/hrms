'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type User = {
  id: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

const ROLES = [
  { value: 'hr_officer',          label: 'HR Officer' },
  { value: 'director',            label: 'Director' },
  { value: 'compliance_manager',  label: 'Compliance Manager' },
  { value: 'operations_manager',  label: 'Operations Manager' },
  { value: 'team_leader',         label: 'Team Leader' },
  { value: 'payroll_officer',     label: 'Payroll Officer' },
  { value: 'employee',            label: 'Employee' },
  { value: 'auditor',             label: 'Auditor' },
  { value: 'it_admin',            label: 'IT Admin' },
]

const ROLE_COLORS: Record<string, string> = {
  director:            'bg-[#E0EEF4] dark:bg-[#0E3D52] text-[#0E3D52] dark:text-[#9ccfda]',
  hr_officer:          'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
  compliance_manager:  'bg-amber-100 dark:bg-amber-900 text-amber-200',
  operations_manager:  'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200',
  team_leader:         'bg-teal-100 dark:bg-teal-900 text-teal-200',
  payroll_officer:     'bg-pink-100 dark:bg-pink-900 text-pink-200',
  employee:            'bg-gray-200 dark:bg-gray-700 text-gray-200',
  auditor:             'bg-orange-100 dark:bg-orange-900 text-orange-200',
  it_admin:            'bg-[#E0EEF4] dark:bg-[#0E3D52]/30 text-[#9ccfda]',
}

export default function UsersPage() {
  const { id } = useParams<{ id: string }>()
  const [users, setUsers]         = useState<User[]>([])
  const [tenantName, setTenantName] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ email: '', password: '', role: 'hr_officer' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/super-admin/clients/${id}`).then(r => r.json()),
      fetch(`/api/super-admin/clients/${id}/users`).then(r => r.json()),
    ]).then(([clientData, userData]) => {
      setTenantName(clientData.tenant?.name ?? '')
      setTenantSlug(clientData.tenant?.slug ?? '')
      setUsers(userData.users ?? [])
      setLoading(false)
    })
  }, [id])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/super-admin/clients/${id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers(u => [...u, { ...data.user, lastLoginAt: null, createdAt: new Date().toISOString() }])
      setForm({ email: '', password: '', role: 'hr_officer' })
      setShowForm(false)
      setSuccess(`User ${data.user.email} created. They can now log in at ${tenantSlug}.yourdomain.com/login`)
      setTimeout(() => setSuccess(''), 6000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(user: User) {
    await fetch(`/api/super-admin/clients/${id}/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, isActive: !user.isActive }),
    })
    setUsers(u => u.map(x => x.id === user.id ? { ...x, isActive: !x.isActive } : x))
  }

  async function resetPassword(user: User) {
    if (!newPassword) return
    setSaving(true)
    await fetch(`/api/super-admin/clients/${id}/users`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, newPassword }),
    })
    setSaving(false)
    setResetTarget(null)
    setNewPassword('')
    setSuccess(`Password reset for ${user.email}`)
    setTimeout(() => setSuccess(''), 4000)
  }

  async function deleteUser(user: User) {
    if (!confirm(`Delete user ${user.email}?`)) return
    await fetch(`/api/super-admin/clients/${id}/users`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
    setUsers(u => u.filter(x => x.id !== user.id))
  }

  if (loading) return <div className="text-gray-600 dark:text-gray-400">Loading users…</div>

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Manage login accounts for <span className="text-[#0E3D52] dark:text-[#7dcfd7] font-medium">{tenantName}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/super-admin/clients/${id}`} className="text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white px-3 py-1.5 rounded-lg transition">← Edit Client</Link>
          <button
            onClick={() => { setShowForm(true); setError('') }}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-1.5 rounded-lg transition"
          >
            + Add User
          </button>
        </div>
      </div>

      {/* Login info banner */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
        <strong className="text-blue-200">Client login URL:</strong>{' '}
        <code className="text-[#0E3D52] dark:text-[#7dcfd7]">
          {typeof window !== 'undefined' ? window.location.origin : ''}/login?tenant={tenantSlug}
        </code>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Users visit this URL and sign in with their email + password.</p>
      </div>

      {success && (
        <div className="bg-green-50 dark:bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">{success}</div>
      )}

      {/* Create user form */}
      {showForm && (
        <form onSubmit={createUser} className="bg-white dark:bg-gray-900 border border-[#b8d4e0] dark:border-[#1A6080] dark:border-[#1A6080] rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">New User</h2>
          {error && <div className="bg-red-50 dark:bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg p-2 text-xs text-red-700 dark:text-red-300">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email *</label>
              <input
                required type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="user@organisation.com"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Temporary Password *</label>
              <input
                required type="text"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="min 8 characters"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]"
              >
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-lg transition">
              {saving ? 'Creating…' : 'Create User'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError('') }} className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white text-sm px-4 py-2 rounded-lg transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Password reset modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-gray-900 dark:text-white font-semibold">Reset Password</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{resetTarget.email}</p>
            <input
              type="text"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => resetPassword(resetTarget)}
                disabled={!newPassword || saving}
                className="flex-1 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition"
              >
                {saving ? 'Saving…' : 'Reset'}
              </button>
              <button onClick={() => { setResetTarget(null); setNewPassword('') }} className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-sm py-2 rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">User</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Role</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Last Login</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-500 dark:text-gray-400">
                  No users yet. <button onClick={() => setShowForm(true)} className="text-[#0E3D52] dark:text-[#4ebac4] hover:underline">Add the first user →</button>
                </td>
              </tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                      {u.email[0].toUpperCase()}
                    </div>
                    <span className="text-gray-900 dark:text-white">{u.email}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? ROLE_COLORS.employee}`}>
                    {u.role.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => toggleActive(u)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition ${
                      u.isActive ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-red-100 dark:bg-red-900 hover:text-red-700 dark:text-red-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-green-100 dark:bg-green-900 hover:text-green-700 dark:text-green-300'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                    {u.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 text-xs">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setResetTarget(u); setNewPassword('') }} className="text-xs text-amber-400 hover:text-amber-700 dark:text-amber-300 font-medium">Reset PW</button>
                    <button onClick={() => deleteUser(u)} className="text-xs text-red-400 hover:text-red-700 dark:text-red-300 font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
