'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import EmptyState from '@/components/ui/EmptyState'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { useEffect, useMemo, useState } from 'react'

type DEIRecord = {
  id: string; employeeId: string; gender: string | null; indigenousStatus: boolean | null
  disabilityStatus: boolean | null; culturalBackground: string | null
  adjustmentsRequired: string | null; selfReported: boolean; createdAt: string
  employeeFirstName: string | null; employeeLastName: string | null
}
type Summary = { total: number; byGender: Record<string, number>; indigenous: number; disability: number; adjustments: number }
type Employee = { id: string; firstName: string; lastName: string }

const BLANK_FORM = { employeeId:'', gender:'', indigenousStatus: null as boolean | null, disabilityStatus: null as boolean | null, culturalBackground:'', adjustmentsRequired:'' }
const INPUT = 'input-premium'

export default function DEIPage() {
  const [records,   setRecords]   = useState<DEIRecord[]>([])
  const [summary,   setSummary]   = useState<Summary>({ total:0, byGender:{}, indigenous:0, disability:0, adjustments:0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState(BLANK_FORM)

  // Search + filter
  const [search,      setSearch]      = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [filterFlag,   setFilterFlag]   = useState('')   // 'indigenous' | 'disability' | ''

  // Edit / delete
  const [editRecord, setEditRecord] = useState<DEIRecord | null>(null)
  const [confirm,    setConfirm]    = useState<ConfirmState>(null)
  const [toast,      setToast]      = useState<ToastState>(null)

  const load = async () => {
    setLoading(true)
    const data = await fetchWithAuth('/api/tenant/dei').then(r => r.json())
    setRecords(data.records ?? [])
    setSummary(data.summary ?? { total:0, byGender:{}, indigenous:0, disability:0, adjustments:0 })
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/dei', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      setShowForm(false); setForm(BLANK_FORM); load()
      setToast({ message: 'DEI record saved', type: 'success' })
    } catch { setToast({ message: 'Failed to save', type: 'error' }) }
    setSaving(false)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editRecord) return; setSaving(true)
    try {
      await fetchWithAuth(`/api/tenant/dei/${editRecord.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      setEditRecord(null); setForm(BLANK_FORM); load()
      setToast({ message: 'Record updated', type: 'success' })
    } catch { setToast({ message: 'Failed to update', type: 'error' }) }
    setSaving(false)
  }

  async function deleteDei(id: string) {
    try {
      await fetchWithAuth(`/api/tenant/dei/${id}`, { method:'DELETE' })
      load(); setToast({ message: 'Record deleted', type: 'success' })
    } catch { setToast({ message: 'Failed to delete', type: 'error' }) }
  }

  function openEdit(r: DEIRecord) {
    setForm({ employeeId: r.employeeId, gender: r.gender ?? '', indigenousStatus: r.indigenousStatus, disabilityStatus: r.disabilityStatus, culturalBackground: r.culturalBackground ?? '', adjustmentsRequired: r.adjustmentsRequired ?? '' })
    setEditRecord(r)
    setShowForm(false)
  }

  const genderOptions = useMemo(() => Array.from(new Set(records.map(r => r.gender).filter(Boolean))), [records])

  const filtered = useMemo(() => records.filter(r => {
    const name = `${r.employeeFirstName} ${r.employeeLastName}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase())) return false
    if (filterGender && r.gender !== filterGender) return false
    if (filterFlag === 'indigenous' && !r.indigenousStatus) return false
    if (filterFlag === 'disability' && !r.disabilityStatus) return false
    return true
  }), [records, search, filterGender, filterFlag])

  const pct = (n: number) => summary.total > 0 ? `${Math.round((n / summary.total) * 100)}%` : '—'

  function doExport() {
    exportCsv({
      filename: 'dei-records',
      columns: [
        { header: 'Employee',          key: 'employeeFirstName', format: (_v, r) => `${r.employeeFirstName} ${r.employeeLastName}` },
        { header: 'Gender',            key: 'gender',            format: v => v ?? '' },
        { header: 'Cultural Background', key: 'culturalBackground', format: v => v ?? '' },
        { header: 'Indigenous / TSI',  key: 'indigenousStatus',  format: v => v ? 'Yes' : 'No' },
        { header: 'Disability',        key: 'disabilityStatus',  format: v => v ? 'Yes' : 'No' },
        { header: 'Adjustments',       key: 'adjustmentsRequired', format: v => v ?? '' },
        { header: 'Recorded',          key: 'createdAt',         format: v => fmtCsvDate(v) },
      ],
      rows: filtered as unknown as Record<string, unknown>[],
    })
  }

  const formPanel = (isEdit: boolean) => (
    <form onSubmit={isEdit ? saveEdit : save} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#4ebac4]">{isEdit ? 'Edit DEI Record' : 'Add DEI Data'}</p>
        <button type="button" onClick={() => { setShowForm(false); setEditRecord(null); setForm(BLANK_FORM) }} className="text-xs text-gray-500 hover:text-gray-300">✕ Cancel</button>
      </div>
      <p className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 dark:text-gray-400">
        This information is self-reported and confidential. It is used only for aggregate reporting to support DEI initiatives.
      </p>
      {!isEdit && (
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
          <select required value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
            <option value="">— Select —</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Gender Identity</label>
          <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={INPUT}>
            <option value="">Prefer not to say</option>
            {['Man','Woman','Non-binary','Gender diverse','Self-describe'].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Cultural Background</label>
          <input value={form.culturalBackground} onChange={e => setForm(f => ({ ...f, culturalBackground: e.target.value }))}
            placeholder="e.g. Australian, Vietnamese…" className={INPUT} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.indigenousStatus ?? false}
            onChange={e => setForm(f => ({ ...f, indigenousStatus: e.target.checked }))} className="accent-[#0E3D52] w-4 h-4" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Aboriginal or Torres Strait Islander</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.disabilityStatus ?? false}
            onChange={e => setForm(f => ({ ...f, disabilityStatus: e.target.checked }))} className="accent-[#0E3D52] w-4 h-4" />
          <span className="text-sm text-gray-600 dark:text-gray-300">Living with a disability</span>
        </label>
      </div>
      <div>
        <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Workplace Adjustments Required</label>
        <textarea value={form.adjustmentsRequired} onChange={e => setForm(f => ({ ...f, adjustmentsRequired: e.target.value }))}
          rows={2} placeholder="e.g. Ergonomic chair, screen reader, flexible hours…" className={INPUT} />
      </div>
      <button type="submit" disabled={saving}
        className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg">
        {saving ? 'Saving…' : isEdit ? 'Update Record' : 'Save'}
      </button>
    </form>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diversity, Equity &amp; Inclusion</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Self-reported diversity data to support equity and inclusion initiatives</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={doExport} disabled={filtered.length === 0} />
          <button onClick={() => { setShowForm(v => !v); setEditRecord(null); setForm(BLANK_FORM) }}
            className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
            {showForm ? 'Cancel' : '+ Add Data'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card-premium p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">Records</p>
          <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">Indigenous / TSI</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{summary.indigenous}</p>
          <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{pct(summary.indigenous)} of workforce</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">Disability</p>
          <p className="text-2xl font-bold text-[#4ebac4] mt-1">{summary.disability}</p>
          <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">{pct(summary.disability)} of workforce</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs text-gray-600 dark:text-gray-400">Need Adjustments</p>
          <p className="text-2xl font-bold text-[#1A6080] dark:text-[#4ebac4] mt-1">{summary.adjustments}</p>
        </div>
      </div>

      {/* Gender breakdown */}
      {Object.keys(summary.byGender).length > 0 && (
        <div className="card-premium p-4">
          <p className="text-xs font-semibold text-gray-500  mb-3 dark:text-gray-400">Gender</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(summary.byGender).map(([g, n]) => (
              <div key={g} className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                <p className="text-gray-600 dark:text-gray-300 text-sm font-medium">{g}</p>
                <p className="text-white text-lg font-bold">{n} <span className="text-xs text-gray-500 dark:text-gray-400">{pct(n)}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && !editRecord && formPanel(false)}
      {editRecord && formPanel(true)}

      {/* Search + filters */}
      {records.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search employee…"
            className="input-premium flex-1 min-w-[160px] text-sm py-2"
          />
          <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="input-premium text-sm py-2 min-w-[140px]">
            <option value="">All genders</option>
            {genderOptions.map(g => <option key={g} value={g!}>{g}</option>)}
          </select>
          <select value={filterFlag} onChange={e => setFilterFlag(e.target.value)} className="input-premium text-sm py-2 min-w-[150px]">
            <option value="">All flags</option>
            <option value="indigenous">Indigenous / TSI</option>
            <option value="disability">Disability</option>
          </select>
          {(search || filterGender || filterFlag) && (
            <button onClick={() => { setSearch(''); setFilterGender(''); setFilterFlag('') }}
              className="text-xs text-gray-500 hover:text-gray-300 px-2">Clear</button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-600 dark:text-gray-400 text-sm">Loading…</p>
      ) : records.length === 0 ? (
        <div className="card-premium">
          <EmptyState icon="🌏" title="No DEI data on record"
            message="Encourage employees to self-report to support DEI reporting."
            action={{ label: '+ Add Data', onClick: () => setShowForm(true) }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card-premium">
          <EmptyState icon="🔍" title="No records match" message="Try adjusting your search or filters." />
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="table-responsive">
            <table className="table-premium">
              <thead>
                <tr>
                  {['Employee','Gender','Cultural Background','Indigenous','Disability','Adjustments',''].map(h => (
                    <th key={h} className="px-4 py-3 section-label">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-[#1A6080]/20/60">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-100 dark:hover:bg-[#0E3D52]/30/30 group">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{r.employeeFirstName} {r.employeeLastName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.gender ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{r.culturalBackground ?? '—'}</td>
                    <td className="px-4 py-3">{r.indigenousStatus ? <span className="text-amber-400">Yes</span> : <span className="text-gray-600 dark:text-gray-400">—</span>}</td>
                    <td className="px-4 py-3">{r.disabilityStatus ? <span className="text-[#4ebac4]">Yes</span> : <span className="text-gray-600 dark:text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-xs truncate">{r.adjustmentsRequired ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(r)}
                          className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] px-2 py-1 rounded hover:bg-[#0E3D52]/20">Edit</button>
                        <button onClick={() => setConfirm({ message: `Delete DEI record for ${r.employeeFirstName} ${r.employeeLastName}?`, danger: true, onConfirm: () => deleteDei(r.id) })}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-900/20">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length < records.length && (
            <p className="text-xs text-gray-500 dark:text-gray-400 px-4 py-2">{filtered.length} of {records.length} records shown</p>
          )}
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
