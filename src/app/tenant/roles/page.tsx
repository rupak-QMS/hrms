'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import PermissionGate from '@/components/auth/PermissionGate'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

type User = {
  id: string; email: string; role: string; isActive: boolean
  totpEnabled: boolean; lastLoginAt: string | null; createdAt: string
}

const ROLES = [
  'director', 'hr_officer', 'compliance_manager', 'operations_manager',
  'team_leader', 'payroll_officer', 'employee', 'contractor', 'auditor', 'it_admin',
]

const ROLE_STYLE: Record<string, string> = {
  director:            'badge badge-teal',
  hr_officer:          'badge badge-blue',
  compliance_manager:  'badge badge-amber',
  operations_manager:  'badge badge-teal',
  team_leader:         'badge badge-teal',
  payroll_officer:     'badge badge-green',
  employee:            'badge badge-gray',
  contractor:          'badge badge-amber',
  auditor:             'badge badge-teal',
  it_admin:            'badge badge-red',
}

const ROLE_LABEL: Record<string, string> = {
  director: 'Director', hr_officer: 'HR Officer', compliance_manager: 'Compliance Mgr',
  operations_manager: 'Ops Manager', team_leader: 'Team Leader', payroll_officer: 'Payroll Officer',
  employee: 'Employee', contractor: 'Contractor', auditor: 'Auditor', it_admin: 'IT Admin',
}

const INPUT = 'input-premium'

function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function RolesPage() {
  const [users,    setUsers]    = useState<User[]>([])
  const [loading,  setLoading]  = useState(true)
  const [denied,   setDenied]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [copied,   setCopied]   = useState('')
  const [form, setForm] = useState({ email: '', role: 'employee', password: generatePassword() })
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [toast,        setToast]        = useState<ToastState>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/tenant/roles')
      if (res.status === 403) { setDenied(true); setLoading(false); return }
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch (err) {
      console.error('Failed to load roles:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function invite(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetchWithAuth('/api/tenant/roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false); setSaving(false); load()
  }

  async function changeRole(id: string, role: string) {
    await fetchWithAuth('/api/tenant/roles', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    })
    setEditId(null); load()
  }

  function confirmDelete(u: User) {
    setConfirmState({
      message: `Delete "${u.email}"? This will permanently remove their portal access and cannot be undone. Any data assigned to this user (leave requests, documents, etc.) will remain but their login will be removed.`,
      confirmLabel: 'Delete User',
      danger: true,
      onConfirm: async () => {
        const res = await fetchWithAuth(`/api/tenant/roles/${u.id}`, { method: 'DELETE' })
        if (res.ok) {
          setToast({ message: `${u.email} deleted`, type: 'success' })
          load()
        } else {
          const d = await res.json().catch(() => ({}))
          setToast({ message: d.error ?? 'Failed to delete user', type: 'error' })
        }
      },
    })
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetchWithAuth('/api/tenant/roles', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive }),
    })
    load()
  }

  function copyPw() {
    navigator.clipboard.writeText(form.password)
    setCopied('Copied!')
    setTimeout(() => setCopied(''), 2000)
  }

  const activeCount   = users.filter(u => u.isActive).length
  const inactiveCount = users.length - activeCount

  // Count by role
  const roleCounts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1
    return acc
  }, {})

  function exportUsersCsv() {
    exportCsv({
      filename: 'roles-users',
      columns: [
        { header: 'Email',      key: 'email' },
        { header: 'Role',       key: 'role', format: v => ROLE_LABEL[v as string] ?? (v as string) },
        { header: '2FA Enabled',key: 'totpEnabled', format: v => v ? 'Yes' : 'No' },
        { header: 'Last Login', key: 'lastLoginAt', format: fmtCsvDate },
        { header: 'Status',     key: 'isActive',    format: v => v ? 'Active' : 'Suspended' },
        { header: 'Created',    key: 'createdAt',   format: fmtCsvDate },
      ],
      rows: users,
    })
  }

  if (denied) return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Roles & Access</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Manage portal users and their access roles</p>
      </div>
      <div className="flex flex-col items-center justify-center h-64 card-premium gap-3">
        <span className="text-4xl">🔒</span>
        <p className="text-gray-900 dark:text-white font-semibold">Access Restricted</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
          User role management is restricted to HR Officers and Directors. Contact your HR administrator for assistance.
        </p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles & Access</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Manage portal users and their access roles</p>
        </div>
        <PermissionGate permission="roles:write">
          <button onClick={() => { setShowForm(v => !v); setForm({ email: '', role: 'employee', password: generatePassword() }) }}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
            {showForm ? 'Cancel' : '+ Invite User'}
          </button>
        </PermissionGate>
        <ExportButton onClick={exportUsersCsv} disabled={users.length === 0} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-premium p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">Total Users</p>
          <p className="text-2xl font-bold text-foreground mt-1">{users.length}</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">Active</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{activeCount}</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">Suspended</p>
          <p className="text-2xl font-bold text-red-500 dark:text-red-400 mt-1">{inactiveCount}</p>
        </div>
      </div>

      {/* Role breakdown */}
      {Object.keys(roleCounts).length > 0 && (
        <div className="card-premium p-4">
          <p className="text-xs font-semibold text-gray-500  mb-3 dark:text-gray-400">Breakdown by Role</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(roleCounts).map(([role, count]) => (
              <span key={role} className={`text-xs px-3 py-1 rounded-full border ${ROLE_STYLE[role] ?? 'badge badge-gray'}`}>
                {ROLE_LABEL[role] ?? role} · {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Invite form */}
      {showForm && (
        <form onSubmit={invite} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#0E3D52] dark:text-[#4ebac4]">Invite new portal user</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Email *</label>
              <input required type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Role *</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={INPUT}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Temporary Password</label>
              <div className="flex gap-2">
                <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className={`${INPUT} font-mono`} />
                <button type="button" onClick={copyPw}
                  className="shrink-0 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg transition">
                  {copied || 'Copy'}
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}
                  className="shrink-0 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-600 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg transition">
                  ↺
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">Share this password with the user — they should change it after first login.</p>
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg">
            {saving ? 'Inviting…' : 'Create User'}
          </button>
        </form>
      )}

      {/* User table */}
      {loading ? <p className="text-gray-600 dark:text-gray-400 text-sm">Loading…</p> : users.length === 0 ? (
        <div className="card-premium py-14 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
          <p className="text-gray-600 dark:text-gray-300 font-medium">No portal users yet</p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="table-responsive">
            <table className="table-premium">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                {['Email', 'Role', '2FA', 'Last Login', 'Status', '', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left section-label">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-100 dark:hover:bg-gray-800/30 ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <PermissionGate permission="roles:write"
                      fallback={
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_STYLE[u.role] ?? 'badge badge-gray'}`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </span>
                      }>
                      {editId === u.id ? (
                        <div className="flex gap-1.5">
                          <select value={editRole} onChange={e => setEditRole(e.target.value)}
                            className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white">
                            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                          </select>
                          <button onClick={() => changeRole(u.id, editRole)}
                            className="text-xs bg-[#0E3D52] hover:bg-[#1A6080] text-white px-2 py-1 rounded transition"></button>
                          <button onClick={() => setEditId(null)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-foreground px-1"></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditId(u.id); setEditRole(u.role) }}
                          className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition ${ROLE_STYLE[u.role] ?? 'badge badge-gray'}`}>
                          {ROLE_LABEL[u.role] ?? u.role}
                        </button>
                      )}
                    </PermissionGate>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${u.totpEnabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-600'}`}>
                      {u.totpEnabled ? 'On' : 'Off'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs dark:text-gray-400">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-AU') : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${u.isActive ? 'badge badge-green' : 'badge badge-gray'}`}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <PermissionGate permission="roles:write">
                      <button onClick={() => toggleActive(u.id, !u.isActive)}
                        className={`text-xs px-2.5 py-1 rounded border transition ${u.isActive
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
                          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40'}`}>
                        {u.isActive ? 'Suspend' : 'Activate'}
                      </button>
                    </PermissionGate>
                  </td>
                  <td className="px-4 py-3">
                    <PermissionGate permission="roles:write">
                      <button
                        onClick={() => confirmDelete(u)}
                        className="text-xs px-2.5 py-1 rounded border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title="Delete user"
                      >
                        Delete
                      </button>
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
