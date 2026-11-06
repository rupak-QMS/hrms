'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import EmptyState from '@/components/ui/EmptyState'
import { SkeletonTable } from '@/components/ui/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────
type Course = {
  id: string; title: string; description: string | null; category: string | null
  isMandatory: boolean; validityMonths: number | null; isActive: boolean; createdAt: string
}
type TrainingRecord = {
  id: string; employeeId: string; courseId: string; status: string
  completedAt: string | null; expiryDate: string | null; score: string | null
  attempts: number; certificateUrl: string | null; createdAt: string
  courseTitle: string | null; courseCategory: string | null
  courseMandatory: boolean | null; courseValidity: number | null
  employeeFirstName: string | null; employeeLastName: string | null; employeeEmail: string | null
}
type TrainingStats = { total: number; enrolled: number; completed: number; overdue: number; expiring: number }
type Employee = { id: string; firstName: string; lastName: string }

// ── Constants ──────────────────────────────────────────────────────────────
const CATEGORIES = ['Mandatory', 'WHS & Safety', 'NDIS Practice Standards', 'Clinical', 'Leadership', 'IT & Systems', 'HR Policy', 'Other']

const STATUS_STYLE: Record<string, string> = {
  enrolled:  'badge badge-blue',
  completed: 'badge badge-green',
  overdue:   'badge badge-red',
  expired:   'badge badge-gray',
}

const INPUT = 'input-premium'

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function TrainingPage() {
  const [tab, setTab] = useState<'library' | 'records' | 'gap'>('library')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Training & LMS</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Manage courses, enrolments and completion records</p>
      </div>

      <div className="flex gap-1 card-premium p-1 w-fit">
        {([
          { key: 'library', label: 'Course Library' },
          { key: 'records', label: 'Training Records' },
          { key: 'gap',     label: '⚠️ Gap Report' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.key ? 'bg-[#0E3D52] text-white' : 'text-gray-400 hover:text-white'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'library' && <LibraryTab />}
      {tab === 'records' && <RecordsTab />}
      {tab === 'gap'     && <GapTab />}
    </div>
  )
}

// ── Course Library ─────────────────────────────────────────────────────────
function LibraryTab() {
  const [courseList,  setCourseList]  = useState<Course[]>([])
  const [categories,  setCategories]  = useState<string[]>([])
  const [employees,   setEmployees]   = useState<Employee[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterCat,   setFilterCat]   = useState('')
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [enrollCourse, setEnrollCourse] = useState<Course | null>(null)
  const [enrollIds,   setEnrollIds]   = useState<string[]>([])
  const [enrolling,   setEnrolling]   = useState(false)
  const [form, setForm] = useState({
    title:'', description:'', category:'', isMandatory: false, validityMonths:''
  })
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  const load = useCallback(async (s = search, c = filterCat) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (s) p.set('search', s)
    if (c) p.set('category', c)
    const res  = await fetchWithAuth(`/api/tenant/training/courses?${p}`)
    const data = await res.json()
    setCourseList(data.courses ?? [])
    setCategories(data.categories ?? [])
    setLoading(false)
  }, [search, filterCat])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=200').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function createCourse(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/training/courses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, validityMonths: form.validityMonths ? Number(form.validityMonths) : null }),
    })
    setShowForm(false)
    setForm({ title:'', description:'', category:'', isMandatory:false, validityMonths:'' })
    setSaving(false)
    load()
  }

  async function enrol() {
    if (!enrollCourse || !enrollIds.length) return
    setEnrolling(true)
    await fetchWithAuth('/api/tenant/training/records', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: enrollCourse.id, employeeIds: enrollIds }),
    })
    setEnrolling(false)
    setEnrollCourse(null)
    setEnrollIds([])
  }

  async function archiveCourse(id: string) {
    setConfirmState({
      message: 'Archive this course?',
      confirmLabel: 'Archive',
      onConfirm: async () => {
        await fetchWithAuth('/api/tenant/training/courses', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, isActive: false }),
        })
        load()
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); load(e.target.value, filterCat) }}
          placeholder="Search courses…"
          className="flex-1 min-w-48 input-premium placeholder-gray-400 dark:placeholder-gray-500 " />
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); load(search, e.target.value) }}
          className="input-premium ">
          <option value="">All categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          {showForm ? 'Cancel' : '+ New Course'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={createCourse} className="card-premium border-[#0E3D52]/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#4ebac4]">New Course</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Course Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. NDIS Module 1 — Participant Rights" className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Validity (months)</label>
              <input type="number" min="1" value={form.validityMonths}
                onChange={e => setForm(f => ({ ...f, validityMonths: e.target.value }))}
                placeholder="Leave blank = no expiry" className={INPUT} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="Optional course description…" className={INPUT} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isMandatory} onChange={e => setForm(f => ({ ...f, isMandatory: e.target.checked }))}
              className="w-4 h-4 rounded accent-[#0E3D52]" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Mandatory for all employees</span>
          </label>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg transition">
            {saving ? 'Creating…' : 'Create Course'}
          </button>
        </form>
      )}

      {/* Enrol modal */}
      {enrollCourse && (
        <div className="modal-overlay">
          <div className="card-premium p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-foreground">Enrol Employees</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Course: <span className="text-foreground font-medium">{enrollCourse.title}</span></p>
            <div className="max-h-60 overflow-y-auto space-y-1 border border-gray-200 dark:border-[#1A6080]/20 rounded-lg p-2">
              {employees.map(e => (
                <label key={e.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:bg-gray-800 cursor-pointer">
                  <input type="checkbox"
                    checked={enrollIds.includes(e.id)}
                    onChange={ev => setEnrollIds(ids => ev.target.checked ? [...ids, e.id] : ids.filter(i => i !== e.id))}
                    className="accent-[#0E3D52]" />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{e.firstName} {e.lastName}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{enrollIds.length} employee{enrollIds.length !== 1 ? 's' : ''} selected</p>
            <div className="flex gap-2">
              <button onClick={enrol} disabled={enrolling || !enrollIds.length}
                className="flex-1 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm py-2 rounded-lg transition">
                {enrolling ? 'Enrolling…' : 'Enrol Selected'}
              </button>
              <button onClick={() => { setEnrollCourse(null); setEnrollIds([]) }}
                className="px-4 border border-gray-300 dark:border-[#1A6080]/30 text-gray-600 dark:text-gray-300 hover:text-white text-sm rounded-lg transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Course grid */}
      {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : courseList.length === 0 ? (
        <EmptyState
          icon="🎓"
          title="No courses yet"
          message="Create your first course to get started."
          action={{ label: 'New Course', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {courseList.map(c => (
            <div key={c.id} className="card-premium p-5 flex flex-col gap-3 hover:border-gray-300 dark:border-[#1A6080]/30 transition">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {c.isMandatory && (
                      <span className="text-xs bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 px-2 py-0.5 rounded-full font-medium">Mandatory</span>
                    )}
                    {c.category && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{c.category}</span>
                    )}
                  </div>
                  <h3 className="text-foreground font-semibold text-sm leading-snug">{c.title}</h3>
                </div>
              </div>
              {c.description && (
                <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 dark:text-gray-400">{c.description}</p>
              )}
              <div className="flex items-center justify-between pt-1 mt-auto">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {c.validityMonths ? `Expires every ${c.validityMonths}mo` : 'No expiry'}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => { setEnrollCourse(c); setEnrollIds([]) }}
                    className="text-xs bg-[#0E3D52]/20 hover:bg-[#0E3D52]/40 text-[#4ebac4] border border-[#1A6080] px-3 py-1.5 rounded-lg transition font-medium">
                    + Enrol
                  </button>
                  <button onClick={() => archiveCourse(c.id)}
                    className="text-xs text-gray-500 hover:text-red-400 border border-gray-200 dark:border-[#1A6080]/20 px-2.5 py-1.5 rounded-lg transition dark:text-gray-400">
                    Archive
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}

// ── Training Records ───────────────────────────────────────────────────────
function RecordsTab() {
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [stats,   setStats]   = useState<TrainingStats>({ total:0, enrolled:0, completed:0, overdue:0, expiring:0 })
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const load = useCallback(async (s = search, f = filterStatus) => {
    setLoading(true)
    const p = new URLSearchParams()
    if (s) p.set('search', s)
    if (f) p.set('status', f)
    const res  = await fetchWithAuth(`/api/tenant/training/records?${p}`)
    const data = await res.json()
    setRecords(data.records ?? [])
    setStats(data.stats ?? { total:0,enrolled:0,completed:0,overdue:0,expiring:0 })
    setLoading(false)
  }, [search, filterStatus])

  useEffect(() => { load() }, [])

  function handleExport() {
    exportCsv({
      filename: `training-records-${new Date().toISOString().slice(0,10)}`,
      columns: [
        { header: 'First Name',    key: 'employeeFirstName' },
        { header: 'Last Name',     key: 'employeeLastName' },
        { header: 'Email',         key: 'employeeEmail' },
        { header: 'Course',        key: 'courseTitle' },
        { header: 'Category',      key: 'courseCategory' },
        { header: 'Mandatory',     key: 'courseMandatory', format: v => v ? 'Yes' : 'No' },
        { header: 'Status',        key: 'status', format: v => String(v ?? '').charAt(0).toUpperCase() + String(v ?? '').slice(1) },
        { header: 'Score',         key: 'score', format: v => v ? `${Number(v).toFixed(0)}%` : '' },
        { header: 'Completed Date', key: 'completedAt', format: v => fmtCsvDate(v as string) },
        { header: 'Expiry Date',   key: 'expiryDate', format: v => fmtCsvDate(v as string) },
        { header: 'Attempts',      key: 'attempts' },
      ],
      rows: records,
    })
  }

  function deleteRecord(r: TrainingRecord) {
    setConfirmState({
      message: `Delete training record for ${r.employeeFirstName} ${r.employeeLastName} — ${r.courseTitle}? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await fetchWithAuth(`/api/tenant/training/records?id=${r.id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error()
          setRecords(prev => prev.filter(x => x.id !== r.id))
          setToast({ message: 'Training record deleted', type: 'success' })
        } catch {
          setToast({ message: 'Failed to delete record', type: 'error' })
        }
      },
    })
  }

  async function markComplete(id: string) {
    const score = prompt('Enter score (0-100) or leave blank:')
    setUpdating(id)
    await fetchWithAuth('/api/tenant/training/records', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'completed', score: score ? Number(score) : null }),
    })
    setUpdating(null)
    load()
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total',      value: stats.total,     color: 'text-foreground' },
          { label: 'Enrolled',   value: stats.enrolled,  color: 'text-[#4ebac4]' },
          { label: 'Completed',  value: stats.completed, color: 'text-green-400' },
          { label: 'Overdue',    value: stats.overdue,   color: 'text-red-400' },
          { label: 'Expiring',   value: stats.expiring,  color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e => { setSearch(e.target.value); load(e.target.value, filterStatus) }}
          placeholder="Search employee or course…"
          className="flex-1 min-w-48 input-premium placeholder-gray-400 dark:placeholder-gray-500 " />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); load(search, e.target.value) }}
          className="input-premium ">
          <option value="">All statuses</option>
          <option value="enrolled">Enrolled</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <ExportButton onClick={handleExport} />
      </div>

      {/* Table */}
      {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : records.length === 0 ? (
        <EmptyState
          icon="🎓"
          title="No training records"
          message="Training completions will appear here."
        />
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="table-responsive">
            <table className="table-premium">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Course</th>
                <th>Status</th>
                <th>Score</th>
                <th>Expiry</th>
                <th>Action</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const days = daysUntil(r.expiryDate)
                const expiryWarn = days !== null && days >= 0 && days <= 30
                const expired    = days !== null && days < 0
                return (
                  <tr key={r.id}>
                    <td className="px-5 py-3.5">
                      <p className="text-foreground font-medium">{r.employeeFirstName} {r.employeeLastName}</p>
                      <p className="text-gray-500 text-xs dark:text-gray-400">{r.employeeEmail}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-gray-700 dark:text-gray-200 text-sm">{r.courseTitle}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {r.courseCategory && <span className="text-xs text-gray-500 dark:text-gray-400">{r.courseCategory}</span>}
                        {r.courseMandatory && <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 rounded">Mandatory</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400 text-sm">
                      {r.score ? `${Number(r.score).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {r.expiryDate ? (
                        <span className={expired ? 'text-red-400 font-medium' : expiryWarn ? 'text-amber-400' : 'text-gray-400'}>
                          {new Date(r.expiryDate).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' })}
                          {expired    && ' '}
                          {expiryWarn && !expired && ` (${days}d)`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.status !== 'completed' && (
                        <button onClick={() => markComplete(r.id)} disabled={updating === r.id}
                          className="text-xs text-green-400 hover:text-green-300 border border-green-900 px-2.5 py-1 rounded-lg transition font-medium">
                          {updating === r.id ? '…' : 'Complete'}
                        </button>
                      )}
                      {r.status === 'completed' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-AU') : 'Done'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => deleteRecord(r)} title="Delete"
                        className="text-gray-500 hover:text-red-400 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
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

// ── Training Gap Report ────────────────────────────────────────────────────
type GapRow = {
  employeeId: string; firstName: string; lastName: string; employmentType: string; email: string
  missingCourses: { id: string; title: string; category: string | null }[]
  expiredCourses:  { id: string; title: string; category: string | null; expiredOn: string }[]
}

function GapTab() {
  const [gaps, setGaps] = useState<GapRow[]>([])
  const [mandatory, setMandatory] = useState<{ id: string; title: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWithAuth('/api/tenant/training/gap')
      .then(r => r.json())
      .then(d => { setGaps(d.gaps ?? []); setMandatory(d.mandatoryCourses ?? []) })
      .finally(() => setLoading(false))
  }, [])

  function exportCSV() {
    const rows = gaps.flatMap(g => {
      const lines: string[] = []
      g.missingCourses.forEach(c => lines.push(`${g.firstName} ${g.lastName},${g.email},${g.employmentType},${c.title},Missing,`))
      g.expiredCourses.forEach(c => lines.push(`${g.firstName} ${g.lastName},${g.email},${g.employmentType},${c.title},Expired,${c.expiredOn}`))
      return lines
    })
    const csv = 'Name,Email,Employment Type,Course,Issue,Expired On\n' + rows.join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'training_gap_report.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <SkeletonTable rows={4} cols={3} />

  if (mandatory.length === 0) return (
    <div className="card-premium p-8 text-center text-gray-400">
      <div className="w-10 h-10 rounded-xl bg-[#0E3D52]/[0.07] dark:bg-[#4ebac4]/10 flex items-center justify-center mb-3 mx-auto ring-1 ring-[#0E3D52]/10 dark:ring-[#4ebac4]/15"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#1A6080] dark:text-[#4ebac4] opacity-70"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <p className="font-medium">No mandatory courses configured</p>
      <p className="text-sm mt-1">Mark courses as mandatory in the Course Library to generate a gap report.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {gaps.length === 0
              ? '✅ All employees are compliant with mandatory training'
              : `${gaps.length} employee${gaps.length !== 1 ? 's' : ''} have training gaps across ${mandatory.length} mandatory course${mandatory.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {gaps.length > 0 && (
          <button onClick={exportCSV}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-[#1A6080]/30 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30">
            ⬇ Export CSV
          </button>
        )}
      </div>

      {gaps.length === 0 ? (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-3 mx-auto ring-1 ring-green-200 dark:ring-green-800"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-500"><polyline points="20 6 9 17 4 12"/></svg></div>
          <p className="font-medium text-green-700 dark:text-green-400">All employees compliant</p>
          <p className="text-sm text-green-600 dark:text-green-500 mt-1">Everyone has completed all {mandatory.length} mandatory course{mandatory.length !== 1 ? 's' : ''}</p>
        </div>
      ) : (
        <div className="card-premium overflow-hidden">
          <div className="table-responsive">
            <table className="table-premium">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th>Employee</th>
                <th>Missing</th>
                <th>Expired</th>
                <th>Total Gaps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#1A6080]/20">
              {gaps.map(g => (
                <tr key={g.employeeId} className="hover:bg-gray-50 dark:hover:bg-[#0E3D52]/30/50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900 dark:text-white">{g.firstName} {g.lastName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{g.email} · {g.employmentType?.replace(/_/g,' ')}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    {g.missingCourses.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <div className="space-y-1">
                        {g.missingCourses.map(c => (
                          <span key={c.id} className="inline-block text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded mr-1">
                            {c.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {g.expiredCourses.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <div className="space-y-1">
                        {g.expiredCourses.map(c => (
                          <span key={c.id} className="inline-block text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded mr-1">
                            {c.title} (expired {new Date(c.expiredOn).toLocaleDateString('en-AU')})
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold">
                      {g.missingCourses.length + g.expiredCourses.length}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
