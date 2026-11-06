'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'
import ConfirmModal, { ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { ToastState } from '@/components/ui/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { useEffect, useMemo, useState, useCallback } from 'react'

type Asset = {
  id: string
  name: string
  category: string
  serialNumber: string | null
  status: string
  notes: string | null
  createdAt: string
}
type Assignment = {
  id: string
  assetId: string
  employeeId: string
  issuedAt: string
  returnedAt: string | null
  condition: string | null
  notes: string | null
  employeeFirstName: string | null
  employeeLastName: string | null
}
type Stats = { total: number; available: number; assigned: number; retired: number }
type Employee = { id: string; firstName: string; lastName: string }

const ASSET_CATEGORIES = ['Laptop','Phone','Uniform','PPE','Keys','Access Card','Vehicle','Tool','Other']
const STATUSES = ['available','assigned','maintenance','retired'] as const

const STATUS_BADGE: Record<string, string> = {
  available:   'bg-green-100  dark:bg-green-900/30  text-green-700  dark:text-green-300  border-green-300  dark:border-green-700',
  assigned:    'bg-[#E0EEF4]   dark:bg-[#0E3D52]/20   text-[#0E3D52]   dark:text-[#7dcfd7]   border-blue-300   dark:border-[#1A6080]',
  maintenance: 'bg-amber-100  dark:bg-amber-900/30  text-amber-700  dark:text-amber-300  border-amber-300  dark:border-amber-700',
  retired:     'bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-300    border-red-300    dark:border-red-700',
}

const INPUT = 'input-premium'

export default function AssetsPage() {
  const [assets,      setAssets]      = useState<Asset[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [stats,       setStats]       = useState<Stats>({ total:0, available:0, assigned:0, retired:0 })
  const [employees,   setEmployees]   = useState<Employee[]>([])
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState<'assets'|'assignments'>('assets')

  // filters
  const [search,         setSearch]         = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  // forms
  const [showAssetForm,  setShowAssetForm]  = useState(false)
  const [showAssignForm, setShowAssignForm] = useState<string | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [assetForm,      setAssetForm]      = useState({ name:'', category:'Laptop', serialNumber:'', notes:'', status:'available' })
  const [assignForm,     setAssignForm]     = useState({ employeeId:'', condition:'good', notes:'' })

  // edit
  const [editAsset,  setEditAsset]  = useState<Asset | null>(null)
  const [editForm,   setEditForm]   = useState({ name:'', category:'Laptop', serialNumber:'', notes:'', status:'available' })

  // ui state
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [toast,   setToast]   = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchWithAuth('/api/tenant/assets').then(r => r.json())
    setAssets(data.assets ?? [])
    setAssignments(data.assignments ?? [])
    setStats(data.stats ?? { total:0, available:0, assigned:0, retired:0 })
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500')
      .then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [load])

  // ── helpers ────────────────────────────────────────────────────────────────

  function assignedEmployee(assetId: string) {
    const a = assignments.find(x => x.assetId === assetId && !x.returnedAt)
    if (!a) return null
    return `${a.employeeFirstName ?? ''} ${a.employeeLastName ?? ''}`.trim()
  }

  // ── filtered lists ─────────────────────────────────────────────────────────

  const filteredAssets = useMemo(() => {
    const q = search.toLowerCase()
    return assets.filter(a => {
      if (filterStatus   && a.status   !== filterStatus)   return false
      if (filterCategory && a.category !== filterCategory) return false
      if (q) {
        const emp = assignedEmployee(a.id)?.toLowerCase() ?? ''
        return (
          a.name.toLowerCase().includes(q) ||
          (a.serialNumber ?? '').toLowerCase().includes(q) ||
          emp.includes(q)
        )
      }
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, assignments, search, filterStatus, filterCategory])

  const activeAssignments = useMemo(() => {
    const q = search.toLowerCase()
    return assignments.filter(a => {
      if (a.returnedAt) return false
      if (!q) return true
      const asset = assets.find(x => x.id === a.assetId)
      return (
        (asset?.name ?? '').toLowerCase().includes(q) ||
        `${a.employeeFirstName ?? ''} ${a.employeeLastName ?? ''}`.toLowerCase().includes(q)
      )
    })
  }, [assignments, assets, search])

  // ── actions ────────────────────────────────────────────────────────────────

  async function createAsset(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetchWithAuth('/api/tenant/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assetForm),
    })
    setSaving(false)
    if (res.ok) {
      setShowAssetForm(false)
      setAssetForm({ name:'', category:'Laptop', serialNumber:'', notes:'', status:'available' })
      setToast({ message: 'Asset added', type: 'success' })
      load()
    } else {
      setToast({ message: 'Failed to add asset', type: 'error' })
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editAsset) return; setSaving(true)
    const res = await fetchWithAuth(`/api/tenant/assets/${editAsset.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSaving(false)
    if (res.ok) {
      setEditAsset(null)
      setToast({ message: 'Asset updated', type: 'success' })
      load()
    } else {
      setToast({ message: 'Failed to update asset', type: 'error' })
    }
  }

  function openEdit(a: Asset) {
    setEditAsset(a)
    setEditForm({ name: a.name, category: a.category, serialNumber: a.serialNumber ?? '', notes: a.notes ?? '', status: a.status })
  }

  function promptDelete(a: Asset) {
    setConfirm({
      message: `Delete "${a.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteAsset(a.id),
    })
  }

  async function deleteAsset(id: string) {
    const res = await fetchWithAuth(`/api/tenant/assets/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setToast({ message: 'Asset deleted', type: 'success' })
      load()
    } else {
      setToast({ message: 'Failed to delete asset', type: 'error' })
    }
  }

  async function assign(assetId: string) {
    setSaving(true)
    const res = await fetchWithAuth('/api/tenant/assets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _type: 'assignment', assetId, ...assignForm }),
    })
    setSaving(false)
    if (res.ok) {
      setShowAssignForm(null)
      setAssignForm({ employeeId:'', condition:'good', notes:'' })
      setToast({ message: 'Asset assigned', type: 'success' })
      load()
    } else {
      setToast({ message: 'Failed to assign asset', type: 'error' })
    }
  }

  async function returnAsset(assignmentId: string) {
    const res = await fetchWithAuth('/api/tenant/assets', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assignmentId, _type: 'return' }),
    })
    if (res.ok) {
      setToast({ message: 'Asset returned', type: 'success' })
      load()
    } else {
      setToast({ message: 'Failed to return asset', type: 'error' })
    }
  }

  async function retire(id: string) {
    const res = await fetchWithAuth('/api/tenant/assets', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'retired' }),
    })
    if (res.ok) {
      setToast({ message: 'Asset retired', type: 'info' })
      load()
    } else {
      setToast({ message: 'Failed to retire asset', type: 'error' })
    }
  }

  // ── CSV export ─────────────────────────────────────────────────────────────

  function exportAssets() {
    type AssetRow = Asset & { assignedTo: string }
    const rows: AssetRow[] = filteredAssets.map(a => ({
      ...a,
      assignedTo: assignedEmployee(a.id) ?? '',
    }))
    exportCsv<AssetRow>({
      filename: 'assets',
      columns: [
        { header: 'Name',          key: 'name' },
        { header: 'Category',      key: 'category' },
        { header: 'Serial Number', key: 'serialNumber' },
        { header: 'Status',        key: 'status' },
        { header: 'Assigned To',   key: 'assignedTo' },
        { header: 'Notes',         key: 'notes' },
        { header: 'Created',       key: 'createdAt', format: v => fmtCsvDate(v) },
      ],
      rows,
    })
  }

  function exportAssignments() {
    type AssignRow = Assignment & { assetName: string; assetCategory: string }
    const rows: AssignRow[] = activeAssignments.map(a => {
      const asset = assets.find(x => x.id === a.assetId)
      return { ...a, assetName: asset?.name ?? '', assetCategory: asset?.category ?? '' }
    })
    exportCsv<AssignRow>({
      filename: 'asset-assignments',
      columns: [
        { header: 'Asset',     key: 'assetName' },
        { header: 'Category',  key: 'assetCategory' },
        { header: 'Employee',  key: 'employeeFirstName', format: (_v, row) => `${row.employeeFirstName ?? ''} ${row.employeeLastName ?? ''}`.trim() },
        { header: 'Condition', key: 'condition' },
        { header: 'Issued',    key: 'issuedAt',   format: v => fmtCsvDate(v) },
        { header: 'Notes',     key: 'notes' },
      ],
      rows,
    })
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Toast state={toast} onClose={() => setToast(null)} />
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />

      {/* Edit modal */}
      {editAsset && (
        <div className="modal-overlay">
          <div className="card-premium w-full max-w-lg shadow-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Edit Asset</h2>
            <form onSubmit={saveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Name *</label>
                  <input required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Category *</label>
                  <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className={INPUT}>
                    {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Serial Number</label>
                  <input value={editForm.serialNumber} onChange={e => setEditForm(f => ({ ...f, serialNumber: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className={INPUT}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notes</label>
                  <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className={INPUT} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setEditAsset(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm rounded-lg bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white transition">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Asset Management</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Track equipment, uniforms, and PPE assigned to employees</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'assets'
            ? <ExportButton onClick={exportAssets} disabled={filteredAssets.length === 0} />
            : <ExportButton onClick={exportAssignments} disabled={activeAssignments.length === 0} label="Export CSV" />
          }
          {tab === 'assets' && (
            <button onClick={() => setShowAssetForm(v => !v)}
              className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
              {showAssetForm ? 'Cancel' : '+ Add Asset'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label:'Total',       value: stats.total,     color:'text-gray-900 dark:text-white',  filter:'' },
          { label:'Available',   value: stats.available, color:'text-green-600 dark:text-green-400', filter:'available' },
          { label:'Assigned',    value: stats.assigned,  color:'text-[#0E3D52] dark:text-[#4ebac4]  dark:text-[#4ebac4]',  filter:'assigned' },
          { label:'Maintenance', value: assets.filter(a => a.status === 'maintenance').length, color:'text-amber-600 dark:text-amber-400', filter:'maintenance' },
          { label:'Retired',     value: stats.retired,   color:'text-red-600   dark:text-red-400',   filter:'retired' },
        ].slice(0,4).map(s => (
          <button key={s.label} onClick={() => { setTab('assets'); setFilterStatus(filterStatus === s.filter ? '' : s.filter) }}
            className={`card-premium p-4 text-left transition hover:ring-1 hover:ring-[#0E3D52]/50 ${filterStatus === s.filter ? 'ring-1 ring-[#0E3D52]' : ''}`}>
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {(['assets','assignments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition capitalize ${tab === t ? 'border-[#0E3D52] text-[#1A6080] dark:text-[#4ebac4]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {t === 'assets' ? `Asset Register (${assets.length})` : `Assignments (${assignments.filter(a => !a.returnedAt).length} active)`}
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'assets' ? 'Search name, serial, employee…' : 'Search asset or employee…'}
            className={`${INPUT} pl-9`}
          />
        </div>
        {tab === 'assets' && (
          <>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={`${INPUT} w-auto`}>
              <option value="">All statuses</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={`${INPUT} w-auto`}>
              <option value="">All categories</option>
              {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </>
        )}
        {(search || filterStatus || filterCategory) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterCategory('') }}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 transition">
            Clear
          </button>
        )}
      </div>

      {/* Add Asset Form */}
      {showAssetForm && tab === 'assets' && (
        <form onSubmit={createAsset} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Name *</label>
              <input required value={assetForm.name} onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Category *</label>
              <select value={assetForm.category} onChange={e => setAssetForm(f => ({ ...f, category: e.target.value }))} className={INPUT}>
                {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Serial Number</label>
              <input value={assetForm.serialNumber} onChange={e => setAssetForm(f => ({ ...f, serialNumber: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notes</label>
              <input value={assetForm.notes} onChange={e => setAssetForm(f => ({ ...f, notes: e.target.value }))} className={INPUT} />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
            {saving ? 'Saving…' : 'Add Asset'}
          </button>
        </form>
      )}

      {/* Content */}
      {loading ? (
        <p className="text-gray-600 dark:text-gray-400 text-sm">Loading…</p>
      ) : (
        <>
          {/* Assets table */}
          {tab === 'assets' && (
            <div className="card-premium overflow-hidden">
              <div className="table-responsive">
                <table className="table-premium">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      {['Asset','Category','Serial','Assigned To','Status',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left section-label">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60">
                    {filteredAssets.length === 0 ? (
                      <EmptyState
                        as="table"
                        cols={6}
                        icon="📦"
                        title={search || filterStatus || filterCategory ? 'No assets match your filters' : 'No assets registered'}
                        message={search || filterStatus || filterCategory ? 'Try adjusting your search or filters.' : 'Add your first asset to get started.'}
                        action={!search && !filterStatus && !filterCategory ? { label: '+ Add Asset', onClick: () => setShowAssetForm(true) } : undefined}
                      />
                    ) : filteredAssets.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200 font-medium">{a.name}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{a.category}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono dark:text-gray-400">{a.serialNumber ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{assignedEmployee(a.id) ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_BADGE[a.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700'}`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {a.status === 'available' && (
                              <button onClick={() => setShowAssignForm(a.id)}
                                className="text-xs bg-[#E0EEF4] dark:bg-[#0E3D52]/20 border border-blue-300 dark:border-[#1A6080] text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#7dcfd7] hover:bg-[#E0EEF4] dark:hover:bg-blue-900/50 px-2 py-1 rounded transition">
                                Assign
                              </button>
                            )}
                            <button onClick={() => openEdit(a)}
                              className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-[#4ebac4] hover:text-[#1A6080] dark:text-[#4ebac4] px-2 py-1 rounded transition">
                              Edit
                            </button>
                            {a.status !== 'retired' && (
                              <button onClick={() => retire(a.id)}
                                className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-400 hover:text-red-400 px-2 py-1 rounded transition">
                                Retire
                              </button>
                            )}
                            <button onClick={() => promptDelete(a)}
                              className="text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 px-2 py-1 rounded transition">
                              Delete
                            </button>
                          </div>
                          {showAssignForm === a.id && (
                            <div className="mt-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                              <select value={assignForm.employeeId} onChange={e => setAssignForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                                <option value="">— Select employee —</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
                              </select>
                              <select value={assignForm.condition} onChange={e => setAssignForm(f => ({ ...f, condition: e.target.value }))} className={INPUT}>
                                {['new','good','fair','poor'].map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <div className="flex gap-2">
                                <button onClick={() => assign(a.id)} disabled={!assignForm.employeeId || saving}
                                  className="text-xs bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white px-3 py-1.5 rounded transition">
                                  Confirm
                                </button>
                                <button onClick={() => setShowAssignForm(null)}
                                  className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5 transition">Cancel</button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Assignments */}
          {tab === 'assignments' && (
            <div className="space-y-2">
              {activeAssignments.length === 0 ? (
                <EmptyState icon="📋" title="No active assignments" message={search ? 'No assignments match your search.' : 'Assign an asset from the Asset Register tab.'} />
              ) : activeAssignments.map(a => {
                const asset = assets.find(x => x.id === a.assetId)
                return (
                  <div key={a.id} className="card-premium px-5 py-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-900 dark:text-white font-medium text-sm">{asset?.name ?? 'Unknown'}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full dark:text-gray-400">{asset?.category}</span>
                        {a.condition && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">· {a.condition}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
                        → {a.employeeFirstName} {a.employeeLastName} · Issued {new Date(a.issuedAt).toLocaleDateString('en-AU')}
                      </p>
                    </div>
                    <button onClick={() => returnAsset(a.id)}
                      className="text-xs bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-3 py-1.5 rounded transition">
                      Return
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
