'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/ui/Skeleton'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv } from '@/lib/exportCsv'

type ExperienceRecord = {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  companyName: string
  jobTitle: string
  employmentType: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  location: string | null
  description: string | null
  reasonForLeaving: string | null
  createdAt: string
}

type Employee = { id: string; firstName: string; lastName: string }

const EMP_TYPE_LABELS: Record<string, string> = {
  full_time:  'Full-Time',
  part_time:  'Part-Time',
  casual:     'Casual',
  contractor: 'Contractor',
  volunteer:  'Volunteer',
}

const EMP_TYPES = Object.keys(EMP_TYPE_LABELS)

const INPUT = 'input-premium'

function durationLabel(start: string, end: string | null, isCurrent: boolean) {
  const from = new Date(start)
  const to   = end ? new Date(end) : new Date()
  const ms   = to.getTime() - from.getTime()
  const mos  = Math.floor(ms / (30.44 * 86400000))
  const yrs  = Math.floor(mos / 12)
  const rem  = mos % 12
  if (isCurrent) return yrs > 0 ? `${yrs}y ${rem}m · Present` : `${mos}mo · Present`
  return yrs > 0 ? `${yrs}y ${rem}m` : `${mos} months`
}

const EMPTY_FORM = {
  employeeId:       '',
  companyName:      '',
  jobTitle:         '',
  employmentType:   'full_time',
  startDate:        '',
  endDate:          '',
  isCurrent:        false,
  location:         '',
  description:      '',
  reasonForLeaving: '',
}

export default function ExperiencePage() {
  const [records,   setRecords]   = useState<ExperienceRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [showModal,  setShowModal]  = useState(false)
  const [editRecord, setEditRecord] = useState<ExperienceRecord | null>(null)
  const [form,       setForm]       = useState({ ...EMPTY_FORM })
  const [saving,     setSaving]     = useState(false)

  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [toast,        setToast]        = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)     params.set('search', search)
    if (typeFilter) params.set('employmentType', typeFilter)

    const [expRes, empRes] = await Promise.all([
      fetchWithAuth(`/api/tenant/experience?${params}`),
      fetchWithAuth('/api/tenant/employees?limit=500&status=active'),
    ])
    const [expData, empData] = await Promise.all([expRes.json(), empRes.json()])
    setRecords(expData.experience ?? [])
    setEmployees(empData.employees ?? [])
    setLoading(false)
  }, [search, typeFilter])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditRecord(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(r: ExperienceRecord) {
    setEditRecord(r)
    setForm({
      employeeId:       r.employeeId,
      companyName:      r.companyName,
      jobTitle:         r.jobTitle,
      employmentType:   r.employmentType,
      startDate:        r.startDate,
      endDate:          r.endDate ?? '',
      isCurrent:        r.isCurrent,
      location:         r.location ?? '',
      description:      r.description ?? '',
      reasonForLeaving: r.reasonForLeaving ?? '',
    })
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editRecord) {
        const res = await fetchWithAuth(`/api/tenant/experience/${editRecord.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        setToast({ message: 'Record updated', type: 'success' })
      } else {
        const res = await fetchWithAuth('/api/tenant/experience', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error()
        setToast({ message: 'Record created', type: 'success' })
      }
      setShowModal(false)
      load()
    } catch {
      setToast({ message: 'Failed to save — please try again', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  function confirmDelete(r: ExperienceRecord) {
    setConfirmState({
      message: `Delete ${r.companyName} (${r.jobTitle}) for ${r.firstName} ${r.lastName}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        const res = await fetchWithAuth(`/api/tenant/experience/${r.id}`, { method: 'DELETE' })
        if (res.ok) {
          setToast({ message: 'Record deleted', type: 'success' })
          load()
        } else {
          setToast({ message: 'Failed to delete', type: 'error' })
        }
      },
    })
  }

  function handleExport() {
    exportCsv({
      filename: 'employee-experience.csv',
      columns: [
        { header: 'Employee',        key: 'firstName',       format: (v, r: ExperienceRecord) => `${r.firstName} ${r.lastName}` },
        { header: 'Company',         key: 'companyName' },
        { header: 'Job Title',       key: 'jobTitle' },
        { header: 'Employment Type', key: 'employmentType',  format: v => EMP_TYPE_LABELS[v as string] ?? v },
        { header: 'Start Date',      key: 'startDate' },
        { header: 'End Date',        key: 'endDate',         format: v => v ?? 'Present' },
        { header: 'Current',         key: 'isCurrent',       format: v => v ? 'Yes' : 'No' },
        { header: 'Location',        key: 'location',        format: v => v ?? '' },
        { header: 'Reason for Leaving', key: 'reasonForLeaving', format: v => v ?? '' },
      ],
      rows: records,
    })
  }

  // Stats
  const totalRecords  = records.length
  const uniqueEmps    = new Set(records.map(r => r.employeeId)).size
  const tenureMonths  = records.map(r => {
    const from = new Date(r.startDate)
    const to   = r.endDate ? new Date(r.endDate) : new Date()
    return Math.max(0, Math.floor((to.getTime() - from.getTime()) / (30.44 * 86400000)))
  })
  const avgTenure = tenureMonths.length
    ? Math.round(tenureMonths.reduce((a, b) => a + b, 0) / tenureMonths.length)
    : 0
  const avgTenureLabel = avgTenure >= 12
    ? `${Math.floor(avgTenure / 12)}y ${avgTenure % 12}m`
    : `${avgTenure} months`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Work History</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Employee experience and employment history records</p>
        </div>
        <div className="flex gap-2">
          <ExportButton onClick={handleExport} disabled={records.length === 0} />
          <button
            onClick={openCreate}
            className="btn-primary"
          >
            + Add Record
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card-premium p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Records</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{totalRecords}</p>
        </div>
        <div className="card-premium p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Employees</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{uniqueEmps}</p>
        </div>
        <div className="card-premium p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">Avg Tenure</p>
          <p className="text-2xl font-bold text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] mt-1">{totalRecords ? avgTenureLabel : '—'}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by employee or company…"
          className={`${INPUT} max-w-xs`}
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className={`${INPUT} w-auto`}
        >
          <option value="">All types</option>
          {EMP_TYPES.map(t => (
            <option key={t} value={t}>{EMP_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonPage />
      ) : records.length === 0 ? (
        <div className="card-premium">
          <EmptyState
            icon="💼"
            title="No experience records"
            message="Add employment history for your employees to get started."
            action={{ label: '+ Add Record', onClick: openCreate }}
          />
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="table-responsive">
            <table className="table-premium">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {['Employee', 'Company', 'Job Title', 'Type', 'Duration', 'Location', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left section-label">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm whitespace-nowrap">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm">{r.companyName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm">{r.jobTitle}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                        {EMP_TYPE_LABELS[r.employmentType] ?? r.employmentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {durationLabel(r.startDate, r.endDate, r.isCurrent)}
                      {r.isCurrent && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">Current</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{r.location ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(r)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => confirmDelete(r)}
                          className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-900 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
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
          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-500">
            {records.length} record{records.length !== 1 ? 's' : ''}
            {typeFilter && ` · filtered by ${EMP_TYPE_LABELS[typeFilter]}`}
            {search && ` · "${search}"`}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="card-premium w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {editRecord ? 'Edit Experience Record' : 'Add Experience Record'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Employee */}
              {!editRecord && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Employee *</label>
                  <select
                    required
                    value={form.employeeId}
                    onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                    className={INPUT}
                  >
                    <option value="">Select employee…</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Company Name *</label>
                  <input
                    required
                    value={form.companyName}
                    onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                    className={INPUT}
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Job Title *</label>
                  <input
                    required
                    value={form.jobTitle}
                    onChange={e => setForm(f => ({ ...f, jobTitle: e.target.value }))}
                    className={INPUT}
                    placeholder="Support Worker"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Employment Type</label>
                  <select
                    value={form.employmentType}
                    onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}
                    className={INPUT}
                  >
                    {EMP_TYPES.map(t => <option key={t} value={t}>{EMP_TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Location</label>
                  <input
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    className={INPUT}
                    placeholder="Sydney, NSW"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Start Date *</label>
                  <input
                    required
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    disabled={form.isCurrent}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className={`${INPUT} disabled:opacity-40`}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isCurrent}
                  onChange={e => setForm(f => ({ ...f, isCurrent: e.target.checked, endDate: e.target.checked ? '' : f.endDate }))}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                Currently working here
              </label>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Description / Key Responsibilities</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={INPUT}
                  placeholder="Briefly describe the role and responsibilities…"
                />
              </div>

              {!form.isCurrent && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Reason for Leaving</label>
                  <input
                    value={form.reasonForLeaving}
                    onChange={e => setForm(f => ({ ...f, reasonForLeaving: e.target.value }))}
                    className={INPUT}
                    placeholder="Career growth, redundancy, contract ended…"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Saving…' : editRecord ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
