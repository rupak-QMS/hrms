'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import Link from 'next/link'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Branch = {
  id: string; name: string; code: string | null; address: string | null
  suburb: string | null; state: string | null; postcode: string | null
  country: string; phone: string | null; email: string | null
  isActive: boolean; employeeCount: number
}

type Department = {
  id: string; name: string; description: string | null
  parentId: string | null; parentName: string | null
  isActive: boolean; headCount: number
}

type Position = {
  id: string; title: string; description: string | null
  departmentId: string | null; departmentName: string | null
  isParticipantFacing: boolean; isRiskAssessed: boolean
  isKeyPersonnel: boolean; isWhsSensitive: boolean
  isActive: boolean; headCount: number
}

type Tab = 'branches' | 'departments' | 'positions'

// ─── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[var(--txt1)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--txt3)] hover:text-[var(--txt1)] text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function InputField({ label, id, required, ...rest }: { label: string; id: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--txt2)] mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input id={id} {...rest} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--txt1)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20" />
    </div>
  )
}

function TextareaField({ label, id, ...rest }: { label: string; id: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--txt2)] mb-1">{label}</label>
      <textarea id={id} rows={3} {...rest} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--txt1)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 resize-none" />
    </div>
  )
}

function SelectField({ label, id, children, ...rest }: { label: string; id: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--txt2)] mb-1">{label}</label>
      <select id={id} {...rest} className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--txt1)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20">
        {children}
      </select>
    </div>
  )
}

// ─── Branch Form ───────────────────────────────────────────────────────────────

function BranchForm({ initial, onSave, onClose }: { initial?: Partial<Branch>; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? '', code: initial?.code ?? '', address: initial?.address ?? '', suburb: initial?.suburb ?? '', state: initial?.state ?? '', postcode: initial?.postcode ?? '', phone: initial?.phone ?? '', email: initial?.email ?? '', country: 'Australia', isActive: initial?.isActive ?? true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const method = initial?.id ? 'PATCH' : 'POST'
    const url = initial?.id ? `/api/tenant/branches/${initial.id}` : '/api/tenant/branches'
    const res = await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Save failed'); setSaving(false); return }
    onSave()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <InputField label="Branch Name" id="bname" required value={form.name} onChange={set('name')} placeholder="e.g. Head Office" />
        <InputField label="Code" id="bcode" value={form.code} onChange={set('code')} placeholder="e.g. HO" maxLength={20} />
      </div>
      <InputField label="Address" id="baddr" value={form.address} onChange={set('address')} placeholder="Street address" />
      <div className="grid grid-cols-3 gap-4">
        <InputField label="Suburb" id="bsuburb" value={form.suburb} onChange={set('suburb')} />
        <InputField label="State" id="bstate" value={form.state} onChange={set('state')} placeholder="VIC" />
        <InputField label="Postcode" id="bpost" value={form.postcode} onChange={set('postcode')} maxLength={10} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InputField label="Phone" id="bphone" value={form.phone} onChange={set('phone')} type="tel" />
        <InputField label="Email" id="bemail" value={form.email} onChange={set('email')} type="email" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded accent-[var(--brand)]" />
        <span className="text-sm text-[var(--txt2)]">Active</span>
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--txt2)] hover:bg-[var(--card)]">Cancel</button>
        <button type="submit" disabled={saving || !form.name} className="px-4 py-2 rounded-lg bg-[var(--brand)] text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save Branch'}</button>
      </div>
    </form>
  )
}

// ─── Department Form ───────────────────────────────────────────────────────────

function DepartmentForm({ initial, departments, onSave, onClose }: { initial?: Partial<Department>; departments: Department[]; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ name: initial?.name ?? '', description: initial?.description ?? '', parentId: initial?.parentId ?? '', isActive: initial?.isActive ?? true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const method = initial?.id ? 'PATCH' : 'POST'
    const url = initial?.id ? `/api/tenant/departments/${initial.id}` : '/api/tenant/departments'
    const payload = { ...form, parentId: form.parentId || null, description: form.description || null }
    const res = await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Save failed'); setSaving(false); return }
    onSave()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
      <InputField label="Department Name" id="dname" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Administration" />
      <TextareaField label="Description" id="ddesc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
      <SelectField label="Parent Department" id="dparent" value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
        <option value="">— None (top-level) —</option>
        {departments.filter(d => d.id !== initial?.id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </SelectField>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded accent-[var(--brand)]" />
        <span className="text-sm text-[var(--txt2)]">Active</span>
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--txt2)] hover:bg-[var(--card)]">Cancel</button>
        <button type="submit" disabled={saving || !form.name} className="px-4 py-2 rounded-lg bg-[var(--brand)] text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save Department'}</button>
      </div>
    </form>
  )
}

// ─── Position Form ─────────────────────────────────────────────────────────────

function PositionForm({ initial, departments, onSave, onClose }: { initial?: Partial<Position>; departments: Department[]; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ title: initial?.title ?? '', description: initial?.description ?? '', departmentId: initial?.departmentId ?? '', isParticipantFacing: initial?.isParticipantFacing ?? false, isRiskAssessed: initial?.isRiskAssessed ?? false, isKeyPersonnel: initial?.isKeyPersonnel ?? false, isWhsSensitive: initial?.isWhsSensitive ?? false, isActive: initial?.isActive ?? true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError('')
    const method = initial?.id ? 'PATCH' : 'POST'
    const url = initial?.id ? `/api/tenant/positions/${initial.id}` : '/api/tenant/positions'
    const payload = { ...form, departmentId: form.departmentId || null, description: form.description || null }
    const res = await fetchWithAuth(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || 'Save failed'); setSaving(false); return }
    onSave()
  }

  const flags: { key: keyof typeof form; label: string }[] = [
    { key: 'isParticipantFacing', label: 'Participant Facing' },
    { key: 'isRiskAssessed', label: 'Risk Assessed' },
    { key: 'isKeyPersonnel', label: 'Key Personnel' },
    { key: 'isWhsSensitive', label: 'WHS Sensitive' },
  ]

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
      <InputField label="Position Title" id="ptitle" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Support Coordinator" />
      <TextareaField label="Description" id="pdesc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      <SelectField label="Department" id="pdept" value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}>
        <option value="">— No department —</option>
        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </SelectField>
      <div>
        <p className="text-xs font-medium text-[var(--txt2)] mb-2">Flags</p>
        <div className="grid grid-cols-2 gap-2">
          {flags.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form[key] as boolean} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="rounded accent-[var(--brand)]" />
              <span className="text-sm text-[var(--txt2)]">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded accent-[var(--brand)]" />
        <span className="text-sm text-[var(--txt2)]">Active</span>
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--txt2)] hover:bg-[var(--card)]">Cancel</button>
        <button type="submit" disabled={saving || !form.title} className="px-4 py-2 rounded-lg bg-[var(--brand)] text-white text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Save Position'}</button>
      </div>
    </form>
  )
}

// ─── Badge ─────────────────────────────────────────────────────────────────────

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OrganisationPage() {
  const [tab, setTab] = useState<Tab>('branches')
  const [branches, setBranches] = useState<Branch[]>([])
  const [depts, setDepts] = useState<Department[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: Tab; item?: Branch | Department | Position } | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [bRes, dRes, pRes] = await Promise.all([
      fetchWithAuth('/api/tenant/branches?includeInactive=true').then(r => r.json()),
      fetchWithAuth('/api/tenant/departments?includeInactive=true&parentId=all').then(r => r.json()),
      fetchWithAuth('/api/tenant/positions?includeInactive=true').then(r => r.json()),
    ])
    setBranches(bRes.branches ?? [])
    setDepts(dRes.departments ?? [])
    setPositions(pRes.positions ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const q = search.toLowerCase()
  const filteredBranches = branches.filter(b => b.name.toLowerCase().includes(q) || (b.code ?? '').toLowerCase().includes(q))
  const filteredDepts = depts.filter(d => d.name.toLowerCase().includes(q))
  const filteredPositions = positions.filter(p => p.title.toLowerCase().includes(q) || (p.departmentName ?? '').toLowerCase().includes(q))

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'branches', label: 'Branches', count: branches.length },
    { key: 'departments', label: 'Departments', count: depts.length },
    { key: 'positions', label: 'Positions', count: positions.length },
  ]

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--txt1)]">Organisation Structure</h1>
          <p className="text-sm text-[var(--txt2)] mt-1">Manage branches, departments and positions across your organisation.</p>
        </div>
        <Link href="/tenant/org-chart" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--txt2)] hover:bg-[var(--card)] transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><path d="M9 6h6M6 9v6M18 9v3M12 15h3"/></svg>
          View Org Chart
        </Link>
      </div>

      {/* Tabs + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-[var(--card)] rounded-lg p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch('') }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-[var(--brand)] text-white shadow-sm' : 'text-[var(--txt2)] hover:text-[var(--txt1)]'}`}>
              {t.label}
              <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${tab === t.key ? 'bg-white/20' : 'bg-[var(--border)] text-[var(--txt3)]'}`}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab}…`}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--txt1)] px-3 py-1.5 text-sm w-52 focus:outline-none focus:border-[var(--brand)]" />
          <button onClick={() => setModal({ type: tab })}
            className="px-4 py-1.5 rounded-lg bg-[var(--brand)] text-white text-sm font-medium hover:opacity-90 transition-opacity">
            + Add {tab === 'branches' ? 'Branch' : tab === 'departments' ? 'Department' : 'Position'}
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-[var(--txt3)] text-sm">Loading…</div>
      ) : (
        <>
          {/* Branches */}
          {tab === 'branches' && (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--card)] border-b border-[var(--border)]">
                  <tr>
                    {['Branch', 'Code', 'Location', 'Contact', 'Staff', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--txt3)] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredBranches.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--txt3)]">No branches found.</td></tr>
                  ) : filteredBranches.map(b => (
                    <tr key={b.id} className="hover:bg-[var(--card)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--txt1)]">{b.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--txt3)]">{b.code ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--txt2)]">{[b.suburb, b.state].filter(Boolean).join(', ') || '—'}</td>
                      <td className="px-4 py-3 text-[var(--txt2)]">{b.phone || b.email || '—'}</td>
                      <td className="px-4 py-3 text-[var(--txt2)]">{b.employeeCount}</td>
                      <td className="px-4 py-3"><ActiveBadge active={b.isActive} /></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setModal({ type: 'branches', item: b })} className="text-xs text-[var(--brand)] hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Departments */}
          {tab === 'departments' && (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--card)] border-b border-[var(--border)]">
                  <tr>
                    {['Department', 'Parent', 'Description', 'Staff', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--txt3)] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredDepts.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--txt3)]">No departments found.</td></tr>
                  ) : filteredDepts.map(d => (
                    <tr key={d.id} className="hover:bg-[var(--card)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--txt1)]">{d.name}</td>
                      <td className="px-4 py-3 text-[var(--txt2)]">{d.parentName ?? <span className="text-[var(--txt3)] italic">Top level</span>}</td>
                      <td className="px-4 py-3 text-[var(--txt2)] max-w-xs truncate">{d.description ?? '—'}</td>
                      <td className="px-4 py-3 text-[var(--txt2)]">{d.headCount}</td>
                      <td className="px-4 py-3"><ActiveBadge active={d.isActive} /></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setModal({ type: 'departments', item: d })} className="text-xs text-[var(--brand)] hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Positions */}
          {tab === 'positions' && (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--card)] border-b border-[var(--border)]">
                  <tr>
                    {['Position', 'Department', 'Flags', 'Staff', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-[var(--txt3)] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredPositions.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-[var(--txt3)]">No positions found.</td></tr>
                  ) : filteredPositions.map(p => (
                    <tr key={p.id} className="hover:bg-[var(--card)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--txt1)]">{p.title}</td>
                      <td className="px-4 py-3 text-[var(--txt2)]">{p.departmentName ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.isParticipantFacing && <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded px-1.5 py-0.5">Participant</span>}
                          {p.isRiskAssessed && <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded px-1.5 py-0.5">Risk</span>}
                          {p.isKeyPersonnel && <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded px-1.5 py-0.5">Key</span>}
                          {p.isWhsSensitive && <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded px-1.5 py-0.5">WHS</span>}
                          {!p.isParticipantFacing && !p.isRiskAssessed && !p.isKeyPersonnel && !p.isWhsSensitive && <span className="text-[var(--txt3)]">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--txt2)]">{p.headCount}</td>
                      <td className="px-4 py-3"><ActiveBadge active={p.isActive} /></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setModal({ type: 'positions', item: p })} className="text-xs text-[var(--brand)] hover:underline">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {modal?.type === 'branches' && (
        <Modal title={modal.item ? 'Edit Branch' : 'New Branch'} onClose={() => setModal(null)}>
          <BranchForm initial={modal.item as Branch} onSave={() => { setModal(null); load() }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'departments' && (
        <Modal title={modal.item ? 'Edit Department' : 'New Department'} onClose={() => setModal(null)}>
          <DepartmentForm initial={modal.item as Department} departments={depts} onSave={() => { setModal(null); load() }} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'positions' && (
        <Modal title={modal.item ? 'Edit Position' : 'New Position'} onClose={() => setModal(null)}>
          <PositionForm initial={modal.item as Position} departments={depts} onSave={() => { setModal(null); load() }} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
