'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { exportCsv, fmtCsvDate, fmtCsvCurrency } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import EmptyState from '@/components/ui/EmptyState'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { useEffect, useMemo, useState } from 'react'

type Referral = {
  id: string; referrerId: string; referredName: string | null; referredEmail: string | null
  status: string; bonusAmount: string | null; bonusPaidAt: string | null; notes: string | null; createdAt: string
  referrerFirstName: string | null; referrerLastName: string | null
}
type Stats = { total: number; pending: number; hired: number; bonusPaid: number }
type Employee = { id: string; firstName: string; lastName: string }

const STATUS_STYLE: Record<string, string> = {
  pending:   'badge badge-blue',
  screening: 'badge badge-purple',
  hired:     'badge badge-green',
  rejected:  'badge badge-red',
}

const INPUT = 'input-premium'
const BLANK_FORM = { referrerId:'', referredName:'', referredEmail:'', bonusAmount:'', notes:'' }

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [stats,     setStats]     = useState<Stats>({ total:0, pending:0, hired:0, bonusPaid:0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState(BLANK_FORM)

  // Edit
  const [editReferral, setEditReferral] = useState<Referral | null>(null)

  // Search + filter
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [toast,   setToast]   = useState<ToastState>(null)

  const load = async () => {
    setLoading(true)
    const data = await fetchWithAuth('/api/tenant/referrals').then(r => r.json())
    setReferrals(data.referrals ?? [])
    setStats(data.stats ?? { total:0, pending:0, hired:0, bonusPaid:0 })
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/referrals', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      setShowForm(false); setForm(BLANK_FORM); load()
      setToast({ message: 'Referral submitted', type: 'success' })
    } catch { setToast({ message: 'Failed to submit', type: 'error' }) }
    setSaving(false)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editReferral) return; setSaving(true)
    try {
      await fetchWithAuth(`/api/tenant/referrals/${editReferral.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      setEditReferral(null); setForm(BLANK_FORM); load()
      setToast({ message: 'Referral updated', type: 'success' })
    } catch { setToast({ message: 'Failed to update', type: 'error' }) }
    setSaving(false)
  }

  async function advance(id: string, status: string) {
    await fetchWithAuth('/api/tenant/referrals', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id, status }) })
    load()
  }

  async function payBonus(id: string) {
    await fetchWithAuth('/api/tenant/referrals', { method:'PATCH', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ id, bonusPaidAt: new Date().toISOString() }) })
    load()
  }

  async function deleteReferral(id: string) {
    try {
      await fetchWithAuth(`/api/tenant/referrals/${id}`, { method:'DELETE' })
      load(); setToast({ message: 'Referral deleted', type: 'success' })
    } catch { setToast({ message: 'Failed to delete', type: 'error' }) }
  }

  function openEdit(r: Referral) {
    setForm({ referrerId: r.referrerId, referredName: r.referredName ?? '', referredEmail: r.referredEmail ?? '', bonusAmount: r.bonusAmount ?? '', notes: r.notes ?? '' })
    setEditReferral(r)
    setShowForm(false)
  }

  const filtered = useMemo(() => referrals.filter(r => {
    const text = `${r.referredName} ${r.referrerFirstName} ${r.referrerLastName} ${r.referredEmail ?? ''}`.toLowerCase()
    if (search && !text.includes(search.toLowerCase())) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  }), [referrals, search, filterStatus])

  function doExport() {
    exportCsv({
      filename: 'referrals',
      columns: [
        { header: 'Referred Person',  key: 'referredName',     format: v => v ?? '' },
        { header: 'Referred Email',   key: 'referredEmail',    format: v => v ?? '' },
        { header: 'Referred By',      key: 'referrerFirstName', format: (_v, r: Record<string,unknown>) => `${r.referrerFirstName} ${r.referrerLastName}` },
        { header: 'Status',           key: 'status' },
        { header: 'Bonus Amount',     key: 'bonusAmount',      format: v => fmtCsvCurrency(v as string | null) },
        { header: 'Bonus Paid',       key: 'bonusPaidAt',      format: v => v ? fmtCsvDate(v as string) : '' },
        { header: 'Submitted',        key: 'createdAt',        format: v => fmtCsvDate(v as string) },
      ],
      rows: filtered as unknown as Record<string, unknown>[],
    })
  }

  const referralForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? saveEdit : submit} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#4ebac4]">{isEdit ? 'Edit Referral' : 'Submit Referral'}</p>
        <button type="button" onClick={() => { setShowForm(false); setEditReferral(null); setForm(BLANK_FORM) }} className="text-xs text-gray-500 hover:text-gray-300">✕ Cancel</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {!isEdit && (
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Referring Employee *</label>
            <select required value={form.referrerId} onChange={e => setForm(f => ({ ...f, referrerId: e.target.value }))} className={INPUT}>
              <option value="">— Select —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Referred Person Name *</label>
          <input required value={form.referredName} onChange={e => setForm(f => ({ ...f, referredName: e.target.value }))} className={INPUT} />
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Referred Email</label>
          <input type="email" value={form.referredEmail} onChange={e => setForm(f => ({ ...f, referredEmail: e.target.value }))} className={INPUT} />
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Bonus Amount ($)</label>
          <input type="number" step="0.01" value={form.bonusAmount} onChange={e => setForm(f => ({ ...f, bonusAmount: e.target.value }))} className={INPUT} />
        </div>
        <div className={isEdit ? 'col-span-2' : ''}>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={INPUT} />
        </div>
      </div>
      <button type="submit" disabled={saving}
        className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg">
        {saving ? (isEdit ? 'Saving…' : 'Submitting…') : (isEdit ? 'Update Referral' : 'Submit Referral')}
      </button>
    </form>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Referral Program</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Track employee referrals and bonus payments</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={doExport} disabled={filtered.length === 0} />
          <button onClick={() => { setShowForm(v => !v); setEditReferral(null); setForm(BLANK_FORM) }}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
            {showForm ? 'Cancel' : '+ Submit Referral'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Total',      value:stats.total,     color:'text-foreground' },
          { label:'Pending',    value:stats.pending,   color:'text-blue-400' },
          { label:'Hired',      value:stats.hired,     color:'text-green-400' },
          { label:'Bonus Paid', value:stats.bonusPaid, color:'text-[#1A6080] dark:text-[#4ebac4]' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {showForm && !editReferral && referralForm(false)}
      {editReferral && referralForm(true)}

      {/* Search + filter */}
      {referrals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search referrals…"
            className="input-premium flex-1 min-w-[160px] text-sm py-2" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-premium text-sm py-2 min-w-[140px]">
            <option value="">All status</option>
            <option value="pending">Pending</option>
            <option value="screening">Screening</option>
            <option value="hired">Hired</option>
            <option value="rejected">Rejected</option>
          </select>
          {(search || filterStatus) && (
            <button onClick={() => { setSearch(''); setFilterStatus('') }}
              className="text-xs text-gray-500 hover:text-gray-300 px-2">Clear</button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-600 dark:text-gray-400 text-sm">Loading…</p>
      ) : referrals.length === 0 ? (
        <div className="card-premium">
          <EmptyState icon="🤝" title="No referrals yet"
            message="Encourage employees to refer candidates and earn bonuses."
            action={{ label: '+ Submit Referral', onClick: () => setShowForm(true) }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-premium">
          <EmptyState icon="🔍" title="No referrals match" message="Try adjusting your search or filters." />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="card-premium px-5 py-4 flex items-center gap-4 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-foreground font-medium text-sm">{r.referredName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>{r.status}</span>
                  {r.bonusPaidAt && <span className="text-xs text-green-400">Bonus paid</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Referred by {r.referrerFirstName} {r.referrerLastName}
                  {r.bonusAmount && <span className="ml-2 text-[#1A6080] dark:text-[#4ebac4]">${Number(r.bonusAmount).toFixed(2)} bonus</span>}
                  {r.referredEmail && <span className="ml-2 text-gray-600 dark:text-gray-500">{r.referredEmail}</span>}
                </p>
                {r.notes && <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 truncate max-w-xs">{r.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0 items-center">
                {r.status === 'pending' && (
                  <button onClick={() => advance(r.id, 'screening')}
                    className="text-xs bg-[#0E3D52]/20 border border-[#1A6080] text-[#4ebac4] hover:bg-[#0E3D52]/40 px-2.5 py-1 rounded transition">
                    → Screening
                  </button>
                )}
                {r.status === 'screening' && (
                  <button onClick={() => advance(r.id, 'hired')}
                    className="text-xs bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60 px-2.5 py-1 rounded transition">
                    Hired
                  </button>
                )}
                {r.status === 'hired' && !r.bonusPaidAt && r.bonusAmount && (
                  <button onClick={() => payBonus(r.id)}
                    className="text-xs bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2.5 py-1 rounded transition">
                    Pay Bonus
                  </button>
                )}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(r)}
                    className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] px-2 py-1 rounded hover:bg-[#0E3D52]/20">Edit</button>
                  <button onClick={() => setConfirm({ message: `Delete referral for ${r.referredName}?`, danger: true, onConfirm: () => deleteReferral(r.id) })}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length < referrals.length && (
            <p className="text-xs text-gray-500 dark:text-gray-400 px-1">{filtered.length} of {referrals.length} referrals shown</p>
          )}
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
