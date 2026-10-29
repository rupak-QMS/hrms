'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PermissionGate from '@/components/auth/PermissionGate'

// ── CSV Import Modal ─────────────────────────────────────────────────────────

type ImportResult = {
  imported: number; skipped: number; total: number
  errors: string[]
}

function CsvImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file,   setFile]   = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [errMsg, setErrMsg] = useState('')

  async function upload() {
    if (!file) return
    setStatus('uploading')
    setErrMsg('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res  = await fetchWithAuth('/api/tenant/employees/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setErrMsg(data.error ?? 'Upload failed'); setStatus('error'); return }
      setResult(data)
      setStatus('done')
      if (data.imported > 0) onDone() // refresh table
    } catch {
      setErrMsg('Network error — please try again')
      setStatus('error')
    }
  }

  const TEMPLATE = `employee_number,first_name,last_name,email,employment_type,start_date,preferred_name,phone,entity_name,award_classification,hourly_rate,ndis_worker
EMP001,Jane,Smith,jane.smith@example.com,full_time,2026-01-15,,+61400000001,Yahweh Care,,35.50,true`

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'employee_import_template.csv' })
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Import Employees</h2>
            <p className="text-xs text-gray-500 mt-0.5 dark:text-gray-400">Upload a CSV to bulk-add employees</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition dark:text-gray-400"></button>
        </div>

        <div className="p-6 space-y-5">
          {status === 'done' && result ? (
            <>
              <div className="text-center py-4">
                <div className="text-5xl mb-3">{result.imported > 0 ? '' : '️'}</div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">Import complete</p>
                <div className="flex justify-center gap-6 mt-3 text-sm">
                  <span className="text-green-600 font-semibold">{result.imported} imported</span>
                  {result.skipped > 0 && <span className="text-amber-600 font-semibold">{result.skipped} skipped</span>}
                  <span className="text-gray-600 dark:text-gray-400">{result.total} total rows</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">Skipped rows:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{e}</p>
                  ))}
                </div>
              )}
              <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--primary)' }}>
                Close
              </button>
            </>
          ) : (
            <>
              {/* Template download */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Need a template?</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                  Required columns: <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded">employee_number, first_name, last_name, email, employment_type, start_date</code>
                </p>
                <button onClick={downloadTemplate} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium underline">
                  Download sample CSV →
                </button>
              </div>

              {/* File picker */}
              <div
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition"
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <>
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{file.name}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                  </>
                ) : (
                  <>
                    <p className="text-3xl mb-2"></p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Click to select a CSV file</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Max 5 MB</p>
                  </>
                )}
              </div>

              {(errMsg || status === 'error') && (
                <p className="text-sm text-red-600 dark:text-red-400">{errMsg || 'Upload failed.'}</p>
              )}

              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Cancel
                </button>
                <button
                  onClick={upload}
                  disabled={!file || status === 'uploading'}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition hover:opacity-90"
                  style={{ background: 'var(--primary)' }}
                >
                  {status === 'uploading' ? 'Uploading…' : 'Import'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

type Employee = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  preferredName: string | null
  email: string
  phone: string | null
  employmentType: string
  entityName: string | null
  departmentName: string | null
  positionTitle: string | null
  startDate: string
  isActive: boolean
  complianceStatus: 'green' | 'amber' | 'red' | 'pending'
  ndisWorker: boolean
  photoUrl: string | null
}

const COMPLIANCE_BADGE: Record<string, { label: string; cls: string }> = {
  green:   { label: 'Compliant',    cls: 'badge badge-green' },
  amber:   { label: 'Review',       cls: 'badge badge-amber' },
  red:     { label: 'Non-Compliant',cls: 'badge badge-red' },
  pending: { label: 'Pending',      cls: 'badge badge-gray' },
}

const EMP_TYPE_LABEL: Record<string, string> = {
  full_time:  'Full-time',
  part_time:  'Part-time',
  casual:     'Casual',
  contractor: 'Contractor',
  volunteer:  'Volunteer',
}

type ScreeningExpiry = Record<string, { expiryDate: string; daysUntil: number }>

export default function EmployeeManagementPage() {
  const router = useRouter()
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [loading,   setLoading]     = useState(true)
  const [denied,    setDenied]      = useState(false)
  const [search,    setSearch]      = useState('')
  const [status,    setStatus]      = useState('')
  const [empType,   setEmpType]     = useState('')
  const [showImport, setShowImport] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [screeningExpiry, setScreeningExpiry] = useState<ScreeningExpiry>({})
  const [page,      setPage]        = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 50
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  // Workforce-wide stat totals (from API, not derived from the current page slice)
  const [statTotals, setStatTotals] = useState<{ active: number; inactive: number; ndis: number } | null>(null)
  // Tenant-specific flags
  const [isYPC, setIsYPC] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Fetch screening expiry data + tenant config (for isYPC flag)
  useEffect(() => {
    fetchWithAuth('/api/tenant/employees/screening-expiry')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.screeningExpiry) setScreeningExpiry(d.screeningExpiry) })
      .catch(() => {})
    fetchWithAuth('/api/tenant/config')
      .then(r => r.json())
      .then(d => { setIsYPC((d.tenant?.slug ?? '') === 'yahwehpc') })
      .catch(() => {})
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [debouncedSearch, status, empType])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchEmployees = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (status)          params.set('status', status)
      if (empType)         params.set('type', empType)
      params.set('limit', String(PAGE_SIZE))
      params.set('page',  String(p))
      const res  = await fetchWithAuth(`/api/tenant/employees?${params}`)
      if (res.status === 403) { setDenied(true); setLoading(false); return }
      const data = await res.json()
      setFetchError(null)
      setSelected(new Set())
      setEmployees(data.employees ?? [])
      setTotalPages(data.pages ?? 1)
      setTotalCount(data.total ?? 0)
      if (data.activeCount !== undefined) {
        setStatTotals({ active: data.activeCount, inactive: data.inactiveCount, ndis: data.ndisCount })
      }
    } catch {
      setFetchError('Failed to load employees. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, status, empType, page])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  async function toggleStatus(id: string, currentIsActive: boolean) {
    setTogglingId(id)
    try {
      const res = await fetchWithAuth(`/api/tenant/employees/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentIsActive }),
      })
      if (res.ok) {
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e))
      }
    } finally {
      setTogglingId(null)
    }
  }

  async function bulkDeactivate() {
    setBulkLoading(true)
    try {
      await Promise.all([...selected].map(id =>
        fetchWithAuth(`/api/tenant/employees/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        })
      ))
      setSelected(new Set())
      fetchEmployees()
    } finally { setBulkLoading(false) }
  }

  function bulkExport() {
    const rows = employees.filter(e => selected.has(e.id))
    exportCsv({ filename: 'selected-employees', columns: [
      { header: 'First Name', key: 'firstName' },
      { header: 'Last Name',  key: 'lastName' },
      { header: 'Email',      key: 'email' },
      { header: 'Number',     key: 'employeeNumber' },
      { header: 'Status',     key: 'isActive', format: (v: unknown) => v ? 'Active' : 'Inactive' },
    ], rows })
  }

  function handleExport() {
    exportCsv({
      filename: `employees-${new Date().toISOString().slice(0,10)}`,
      columns: [
        { header: 'Employee #',       key: 'employeeNumber' },
        { header: 'First Name',       key: 'firstName' },
        { header: 'Last Name',        key: 'lastName' },
        { header: 'Email',            key: 'email' },
        { header: 'Phone',            key: 'phone' },
        { header: 'Employment Type',  key: 'employmentType', format: v => String(v ?? '').replace('_', ' ') },
        { header: 'Department',       key: 'departmentName' },
        { header: 'Position',         key: 'positionTitle' },
        { header: 'Entity',           key: 'entityName' },
        { header: 'Start Date',       key: 'startDate', format: v => fmtCsvDate(v as string) },
        { header: 'Status',           key: 'isActive', format: v => v ? 'Active' : 'Inactive' },
        { header: 'Compliance',       key: 'complianceStatus' },
        ...(!isYPC ? [{ header: 'NDIS Worker', key: 'ndisWorker' as const, format: (v: unknown) => v ? 'Yes' : 'No' }] : []),
      ],
      rows: employees,
    })
  }

  // Use API-returned totals (whole workforce) rather than current page slice
  const activeCount   = statTotals?.active   ?? employees.filter(e => e.isActive).length
  const inactiveCount = statTotals?.inactive ?? (employees.length - (statTotals?.active ?? employees.filter(e => e.isActive).length))
  const ndisCount     = statTotals?.ndis     ?? employees.filter(e => e.ndisWorker).length

  if (denied) return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employees</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your workforce</p>
      </div>
      <div className="flex flex-col items-center justify-center h-64 card-premium gap-3">
        <span className="text-4xl">👥</span>
        <p className="text-gray-900 dark:text-white font-semibold">Access Restricted</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
          The employee directory is available to managers and above. View your own profile under <strong>My Profile</strong>.
        </p>
      </div>
    </div>
  )

  if (fetchError) return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employees</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your workforce</p>
      </div>
      <div className="flex flex-col items-center justify-center h-64 card-premium gap-3">
        <span className="text-4xl">⚠️</span>
        <p className="text-gray-900 dark:text-white font-semibold">Unable to load employees</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">{fetchError}</p>
        <button
          onClick={() => { setFetchError(null); fetchEmployees() }}
          className="mt-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onDone={() => { setShowImport(false); fetchEmployees() }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-premium-title">Employees</h1>
          <p className="page-premium-subtitle mt-0.5">
            Manage your workforce
          </p>
        </div>
        <PermissionGate permission="employees:write">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Import CSV
            </button>
            <Link
              href="/tenant/employee-management/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: 'var(--primary)' }}
            >
              + Add Employee
            </Link>
          </div>
        </PermissionGate>
      </div>

      {/* Stat cards */}
      <div className={`grid gap-4 ${isYPC ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {[
          { label: 'Total',    value: employees.length, icon: '', cls: 'text-blue-600 dark:text-blue-400' },
          { label: 'Active',   value: activeCount,       icon: '', cls: 'text-green-600 dark:text-green-400' },
          { label: 'Inactive', value: inactiveCount,     icon: '', cls: 'text-gray-500' },
          ...(!isYPC ? [{ label: 'NDIS', value: ndisCount, icon: '', cls: 'text-purple-600 dark:text-purple-400' }] : []),
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card-premium p-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name, email, emp #…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-blue-400 dark:placeholder-gray-500"
        />
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={empType}
          onChange={e => setEmpType(e.target.value)}
          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none"
        >
          <option value="">All Types</option>
          {Object.entries(EMP_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {(search || status || empType) && (
          <button
            onClick={() => { setSearch(''); setStatus(''); setEmpType('') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition"
          >
            Clear
          </button>
        )}
        <ExportButton onClick={handleExport} />
      </div>

      {/* Table */}
      <div className="card-premium overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-600 dark:text-gray-400 text-sm">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl"></span>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
              {search || status || empType ? 'No employees match your filters' : 'No employees yet'}
            </p>
            {!search && !status && !empType && (
              <PermissionGate permission="employees:write">
                <Link
                  href="/tenant/employee-management/new"
                  className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'var(--primary)' }}
                >
                  Add your first employee
                </Link>
              </PermissionGate>
            )}
          </div>
        ) : (
          <>{selected.size > 0 && (
            <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">{selected.size} selected</span>
              <PermissionGate permission="employees:write">
                <button onClick={bulkDeactivate} disabled={bulkLoading} className="px-3 py-1 text-xs rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 disabled:opacity-50">
                  {bulkLoading ? 'Working…' : 'Deactivate'}
                </button>
              </PermissionGate>
              <button onClick={bulkExport} className="px-3 py-1 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50">
                Export selected
              </button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-indigo-500 hover:text-indigo-700">Clear</button>
            </div>
          )}
          <div className="table-responsive">
            <table className="table-premium">
              <thead>
                <tr>
                  <th className="w-8 px-3">
                    <input type="checkbox"
                      checked={employees.length > 0 && selected.size === employees.length}
                      onChange={e => setSelected(e.target.checked ? new Set(employees.map(e => e.id)) : new Set())}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </th>
                  {['Emp #', 'Name', 'Role / Dept', 'Type', 'Entity', 'Start Date', 'Compliance', 'Status', ''].map(h => (
                    <th key={h} className="whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const badge = COMPLIANCE_BADGE[emp.complianceStatus] ?? COMPLIANCE_BADGE.pending
                  const fullName = [emp.firstName, emp.lastName].join(' ')
                  const scrExp = screeningExpiry[emp.id]
                  const scrBadge = scrExp
                    ? scrExp.daysUntil <= 14
                      ? { label: `🛡 Expires in ${scrExp.daysUntil}d`, cls: 'badge badge-red' }
                      : scrExp.daysUntil <= 30
                        ? { label: `🛡 Expires in ${scrExp.daysUntil}d`, cls: 'badge badge-amber' }
                        : null
                    : null
                  return (
                    <tr
                      key={emp.id}
                      onClick={() => router.push(`/tenant/employee-management/${emp.id}`)}
                      className="cursor-pointer"
                    >
                      <td className="px-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={selected.has(emp.id)}
                          onChange={e => setSelected(prev => {
                            const s = new Set(prev)
                            e.target.checked ? s.add(emp.id) : s.delete(emp.id)
                            return s
                          })}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{emp.employeeNumber}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {emp.photoUrl ? (
                            <img src={emp.photoUrl} alt={fullName}
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200 dark:border-gray-700" />
                          ) : (
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                              style={{ background: 'var(--primary)' }}
                            >
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {fullName}
                              {emp.ndisWorker && !isYPC && <span className="ml-1.5 text-xs text-purple-500">NDIS</span>}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700 dark:text-gray-300">{emp.positionTitle ?? '—'}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{emp.departmentName ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {EMP_TYPE_LABEL[emp.employmentType] ?? emp.employmentType}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{emp.entityName ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {emp.startDate ? new Date(emp.startDate).toLocaleDateString('en-AU') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {scrBadge && (
                          <span className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${scrBadge.cls}`}>
                            {scrBadge.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <PermissionGate permission="employees:write" fallback={
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {emp.isActive ? 'Active' : 'Inactive'}
                          </span>
                        }>
                          <button
                            onClick={() => toggleStatus(emp.id, emp.isActive)}
                            disabled={togglingId === emp.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                              emp.isActive
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                            } ${togglingId === emp.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${emp.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {togglingId === emp.id ? '…' : emp.isActive ? 'Active' : 'Inactive'}
                          </button>
                        </PermissionGate>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/tenant/employee-management/${emp.id}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{totalCount} employee{totalCount !== 1 ? 's' : ''} total</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchEmployees(p) }}
                    disabled={page === 1}
                    className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    ← Prev
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchEmployees(p) }}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
