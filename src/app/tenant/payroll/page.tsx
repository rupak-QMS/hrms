'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'
import { ExportButton } from '@/components/ui/ExportButton'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'

type Employee = { id: string; firstName: string; lastName: string; email: string }

type PayrollRecord = {
  id: string
  employeeId: string
  employeeFirstName: string | null
  employeeLastName: string | null
  employeeEmail: string | null
  periodStart: string
  periodEnd: string
  hoursWorked: string | null
  hourlyRate: string | null
  grossPay: string | null
  paygWithholding: string | null
  medicareLevy: string | null
  superContribution: string | null
  netPay: string | null
  status: string
  exportedToXero: boolean
  exportedAt: string | null
  createdAt: string
  payslipData?: Record<string, unknown> | null
}

type XeroStatus  = { connected: boolean; orgName?: string; tokenExpired?: boolean }
type MyobStatus  = { connected: boolean; companyFileName?: string; tokenExpired?: boolean }

type Breakdown = {
  grossPay: number
  paygWithholding: number
  medicareLevy: number
  totalTax: number
  superContribution: number
  netPay: number
  effectiveTaxRate: number
  annualisedGross: number
}

type Stats = {
  total: number; pending: number; approved: number; paid: number
  totalGross: string; totalNet: string; totalSuper: string
}

const fmt = (n: number | string | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUS_STYLE: Record<string, string> = {
  pending:  'badge badge-amber',
  approved: 'badge badge-blue',
  paid:     'badge badge-green',
}

export default function PayrollPage() {
  const [records, setRecords]     = useState<PayrollRecord[]>([])
  const [stats, setStats]         = useState<Stats | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected]   = useState<PayrollRecord | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [xeroStatus,   setXeroStatus]  = useState<XeroStatus | null>(null)
  const [myobStatus,   setMyobStatus]  = useState<MyobStatus | null>(null)
  const [exporting,    setExporting]   = useState<Set<string>>(new Set())
  const [myobExporting, setMyobExporting] = useState<Set<string>>(new Set())
  const [exportMsg,    setExportMsg]   = useState('')
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [toast,        setToast]        = useState<ToastState>(null)

  const [form, setForm] = useState({
    employeeId: '', periodStart: '', periodEnd: '',
    payType: 'hourly' as 'hourly' | 'salary',
    hoursWorked: '', hourlyRate: '', annualSalary: '',
    frequency: 'fortnightly' as 'weekly' | 'fortnightly' | 'monthly',
    allowances: '0', deductions: '0',
  })
  const [preview, setPreview]       = useState<Breakdown | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  // Bulk pay run state
  const [showBulk, setShowBulk]   = useState(false)
  const [bulkForm, setBulkForm]   = useState({
    periodStart: '', periodEnd: '',
    frequency: 'fortnightly' as 'weekly' | 'fortnightly' | 'monthly',
    allowances: '0', deductions: '0',
  })
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult,  setBulkResult]  = useState<{
    summary: { total: number; created: number; skipped: number; failed: number; totalNet: string }
    results: Array<{ employeeId: string; name: string; status: string; reason?: string; netPay?: number }>
  } | null>(null)
  const [bulkError, setBulkError] = useState('')

  async function runBulkPayRun() {
    if (!bulkForm.periodStart || !bulkForm.periodEnd) { setBulkError('Period start and end are required'); return }
    setBulkRunning(true); setBulkError(''); setBulkResult(null)
    try {
      const res = await fetchWithAuth('/api/tenant/payroll/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodStart: bulkForm.periodStart,
          periodEnd:   bulkForm.periodEnd,
          frequency:   bulkForm.frequency,
          allowances:  Number(bulkForm.allowances),
          deductions:  Number(bulkForm.deductions),
        }),
      })
      const d = await res.json()
      if (!res.ok) { setBulkError(d.error ?? 'Bulk run failed'); return }
      setBulkResult(d)
      load()
    } catch { setBulkError('Request failed — check connection') }
    finally { setBulkRunning(false) }
  }

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    const res = await fetchWithAuth(`/api/tenant/payroll?${params}`)
    if (res.ok) {
      const d = await res.json()
      setRecords(d.records ?? [])
      setStats(d.stats ?? null)
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchWithAuth('/api/tenant/employees?limit=200&status=active')
      .then(r => r.json())
      .then(d => setEmployees(d.employees ?? []))
  }, [])

  useEffect(() => {
    fetchWithAuth('/api/tenant/xero/status')
      .then(r => r.json())
      .then(d => setXeroStatus(d))
      .catch(() => {})
    fetchWithAuth('/api/tenant/myob/status')
      .then(r => r.json())
      .then(d => setMyobStatus(d))
      .catch(() => {})
  }, [])

  async function exportToXero(ids: string[]) {
    if (!xeroStatus?.connected) {
      setExportMsg('Xero is not connected. Go to Settings → Integrations to connect.')
      return
    }
    setExporting(new Set(ids))
    setExportMsg('')
    try {
      const res = await fetchWithAuth('/api/tenant/xero/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const d = await res.json()
      if (!res.ok) { setExportMsg(d.error ?? 'Export failed'); return }
      const { exported, skipped, errors } = d.summary
      setExportMsg(`Exported ${exported} record(s) to Xero${skipped > 0 ? ` · ${skipped} skipped` : ''}${errors > 0 ? ` · ${errors} error(s)` : ''}.`)
      load()
    } catch { setExportMsg('Export failed — check connection.') }
    finally { setExporting(new Set()) }
  }

  async function exportToMyob(ids: string[]) {
    if (!myobStatus?.connected) {
      setExportMsg('MYOB is not connected. Go to Settings → Integrations to connect.')
      return
    }
    setMyobExporting(new Set(ids))
    setExportMsg('')
    try {
      const res = await fetchWithAuth('/api/tenant/myob/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const d = await res.json()
      if (!res.ok) { setExportMsg(d.error ?? 'MYOB export failed'); return }
      const { exported, skipped, errors } = d.summary
      setExportMsg(`Exported ${exported} record(s) to MYOB${skipped > 0 ? ` · ${skipped} skipped` : ''}${errors > 0 ? ` · ${errors} error(s)` : ''}.`)
      load()
    } catch { setExportMsg('MYOB export failed — check connection.') }
    finally { setMyobExporting(new Set()) }
  }

  async function handlePreview() {
    setPreviewing(true); setError(''); setPreview(null)
    try {
      const body: Record<string, unknown> = {
        frequency: form.frequency,
        allowances: Number(form.allowances),
        deductions: Number(form.deductions),
      }
      if (form.payType === 'hourly') {
        body.hoursWorked = Number(form.hoursWorked)
        body.hourlyRate  = Number(form.hourlyRate)
      } else {
        body.annualSalary = Number(form.annualSalary)
      }
      const res = await fetchWithAuth('/api/tenant/payroll/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error); return }
      setPreview(d.breakdown)
    } catch { setError('Calculation failed') }
    finally { setPreviewing(false) }
  }

  async function handleCreatePayRun() {
    if (!preview) return
    setSaving(true); setError('')
    try {
      const body: Record<string, unknown> = {
        employeeId: form.employeeId, periodStart: form.periodStart, periodEnd: form.periodEnd,
        frequency: form.frequency, allowances: Number(form.allowances), deductions: Number(form.deductions),
      }
      if (form.payType === 'hourly') {
        body.hoursWorked = Number(form.hoursWorked); body.hourlyRate = Number(form.hourlyRate)
      } else {
        body.annualSalary = Number(form.annualSalary)
      }
      const res = await fetchWithAuth('/api/tenant/payroll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error); return }
      setShowModal(false); setPreview(null)
      setForm({ employeeId: '', periodStart: '', periodEnd: '', payType: 'hourly', hoursWorked: '', hourlyRate: '', annualSalary: '', frequency: 'fortnightly', allowances: '0', deductions: '0' })
      load()
    } catch { setError('Failed to save pay run') }
    finally { setSaving(false) }
  }

  async function updateStatus(id: string, status: string) {
    await fetchWithAuth('/api/tenant/payroll', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  function deletePayroll(id: string) {
    setConfirmState({
      message: 'Delete this pay run? This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        const r = await fetchWithAuth(`/api/tenant/payroll/${id}`, { method: 'DELETE' })
        if (r.ok) {
          setRecords(prev => prev.filter(rec => rec.id !== id))
          setToast({ message: 'Pay run deleted', type: 'success' })
        } else {
          const d = await r.json()
          setToast({ message: d.error ?? 'Failed to delete pay run', type: 'error' })
        }
        setConfirmState(null)
      },
    })
  }

  function handleExport() {
    exportCsv({
      filename: 'payroll-summary.csv',
      columns: [
        { header: 'Employee',         key: 'employee' },
        { header: 'Email',            key: 'email' },
        { header: 'Entity',           key: 'entity' },
        { header: 'Period Start',     key: 'periodStart',      format: fmtCsvDate },
        { header: 'Period End',       key: 'periodEnd',        format: fmtCsvDate },
        { header: 'Hours',            key: 'hoursWorked' },
        { header: 'Hourly Rate',      key: 'hourlyRate' },
        { header: 'Gross Pay',        key: 'grossPay' },
        { header: 'PAYG Withholding', key: 'paygWithholding' },
        { header: 'Medicare Levy',    key: 'medicareLevy' },
        { header: 'Super',            key: 'superContribution' },
        { header: 'Net Pay',          key: 'netPay' },
        { header: 'Status',           key: 'status' },
      ],
      rows: records.map(r => ({
        employee:          `${r.employeeFirstName ?? ''} ${r.employeeLastName ?? ''}`.trim(),
        email:             r.employeeEmail ?? '',
        entity:            '',
        periodStart:       r.periodStart,
        periodEnd:         r.periodEnd,
        hoursWorked:       r.hoursWorked ?? '',
        hourlyRate:        r.hourlyRate ?? '',
        grossPay:          r.grossPay ?? '',
        paygWithholding:   r.paygWithholding ?? '',
        medicareLevy:      r.medicareLevy ?? '',
        superContribution: r.superContribution ?? '',
        netPay:            r.netPay ?? '',
        status:            r.status,
      })),
    })
  }

  return (
    <div className="space-y-6">
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-premium-title">Payroll</h1>
          <p className="page-premium-subtitle mt-0.5">Australian PAYG · Super 11.5% · Medicare 2%</p>
        </div>
        <div className="flex items-center gap-3">
          {xeroStatus && (
            xeroStatus.connected ? (
              <button
                onClick={() => {
                  const unexported = records.filter(r => (r.status === 'approved' || r.status === 'paid') && !r.exportedToXero).map(r => r.id)
                  if (unexported.length === 0) { setExportMsg('No approved/paid records to export.'); return }
                  exportToXero(unexported)
                }}
                disabled={exporting.size > 0}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#13B5EA] text-[#13B5EA] hover:bg-[#13B5EA]/10 transition disabled:opacity-60">
                {exporting.size > 0 ? 'Exporting…' : '⬆ Export All to Xero'}
              </button>
            ) : (
              <a href="/tenant/settings?tab=integrations"
                className="px-3 py-2 rounded-xl text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white transition">
                Connect Xero
              </a>
            )
          )}
          {myobStatus && (
            myobStatus.connected ? (
              <button
                onClick={() => {
                  const unexported = records.filter(r => (r.status === 'approved' || r.status === 'paid')).map(r => r.id)
                  if (unexported.length === 0) { setExportMsg('No approved/paid records to export.'); return }
                  exportToMyob(unexported)
                }}
                disabled={myobExporting.size > 0}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#7B2D8B] text-[#c084e8] hover:bg-[#7B2D8B]/10 transition disabled:opacity-60">
                {myobExporting.size > 0 ? 'Exporting…' : '⬆ Export All to MYOB'}
              </button>
            ) : (
              <a href="/tenant/settings?tab=integrations"
                className="px-3 py-2 rounded-xl text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white transition">
                Connect MYOB
              </a>
            )
          )}
          <button onClick={() => { setShowBulk(true); setBulkResult(null); setBulkError('') }}
            className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#0E3D52] text-[#4ebac4] hover:bg-[#0E3D52]/30 transition">
            ⚡ Bulk Pay Run
          </button>
          <button onClick={() => { setShowModal(true); setPreview(null); setError('') }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
            style={{ background: 'var(--primary)' }}>
            + New Pay Run
          </button>
        </div>
      </div>

      {exportMsg && (
        <div className={`rounded-lg px-4 py-2.5 text-sm border ${exportMsg.startsWith("") ? "bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300" : "bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300"}`}>
          {exportMsg}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Runs',  value: stats.total,    color: 'text-gray-900 dark:text-white' },
            { label: 'Pending',     value: stats.pending,  color: 'text-yellow-500' },
            { label: 'Approved',    value: stats.approved, color: 'text-blue-400' },
            { label: 'Paid',        value: stats.paid,     color: 'text-green-400' },
            { label: 'Total Gross', value: `$${Number(stats.totalGross).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, color: 'text-gray-900 dark:text-white' },
            { label: 'Total Super', value: `$${Number(stats.totalSuper ?? 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, color: 'text-[#1A6080] dark:text-[#4ebac4]' },
          ].map(s => (
            <div key={s.label} className="card-premium p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 items-center flex-wrap">
        {['', 'pending', 'approved', 'paid'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${statusFilter === s ? 'border-transparent text-white' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900'}`}
            style={statusFilter === s ? { background: 'var(--primary)' } : {}}>
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <ExportButton onClick={handleExport} disabled={records.length === 0} />
      </div>

      {/* Table */}
      <div className="card-premium rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <div className="table-responsive">
            <table className="table-premium">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {['Employee', 'Period', 'Gross', 'PAYG Tax', 'Medicare', 'Super', 'Net Pay', 'Status', ''].map(h => (
                  <th key={h} className={`px-4 py-3 font-medium text-gray-500 dark:text-gray-400 ${h && h !== 'Employee' && h !== 'Period' && h !== 'Status' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-600 dark:text-gray-400 text-sm">Loading…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No pay runs yet — create your first one.</p>
                </td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{r.employeeFirstName} {r.employeeLastName}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{r.employeeEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs whitespace-nowrap">{r.periodStart} → {r.periodEnd}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">{fmt(r.grossPay)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-400">{fmt(r.paygWithholding)}</td>
                  <td className="px-4 py-3 text-right font-mono text-orange-400">{fmt(r.medicareLevy)}</td>
                  <td className="px-4 py-3 text-right font-mono text-[#1A6080] dark:text-[#4ebac4]">{fmt(r.superContribution)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-green-400">{fmt(r.netPay)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status] ?? 'badge badge-gray'}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5 justify-end items-center">
                      {r.exportedToXero ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#13B5EA]/20 border border-[#13B5EA]/40 text-[#13B5EA]" title={r.exportedAt ? `Exported ${new Date(r.exportedAt).toLocaleDateString('en-AU')}` : 'Exported'}>
                          Xero
                        </span>
                      ) : (
                        (r.status === 'approved' || r.status === 'paid') && xeroStatus?.connected && (
                          <button
                            onClick={() => exportToXero([r.id])}
                            disabled={exporting.has(r.id)}
                            className="text-xs px-2 py-1 rounded border border-[#13B5EA]/60 text-[#13B5EA] hover:bg-[#13B5EA]/10 transition disabled:opacity-50">
                            {exporting.has(r.id) ? '…' : '⬆ Xero'}
                          </button>
                        )
                      )}
                      {(r.status === 'approved' || r.status === 'paid') && myobStatus?.connected && (
                        <button
                          onClick={() => exportToMyob([r.id])}
                          disabled={myobExporting.has(r.id)}
                          className="text-xs px-2 py-1 rounded border border-[#7B2D8B]/60 text-[#c084e8] hover:bg-[#7B2D8B]/10 transition disabled:opacity-50">
                          {myobExporting.has(r.id) ? '…' : '⬆ MYOB'}
                        </button>
                      )}
                      <button onClick={() => setSelected(r)} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition">View</button>
                      {r.status === 'pending'  && <button onClick={() => updateStatus(r.id, 'approved')} className="text-xs px-2 py-1 rounded border border-blue-700 text-blue-400 hover:bg-blue-900/20 transition">Approve</button>}
                      {r.status === 'approved' && <button onClick={() => updateStatus(r.id, 'paid')}     className="text-xs px-2 py-1 rounded border border-green-700 text-green-400 hover:bg-green-900/20 transition">Mark Paid</button>}
                      {r.status === 'pending'  && (
                        <button onClick={() => deletePayroll(r.id)} title="Delete pay run"
                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-900/20 transition">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* New Pay Run Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card-premium rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">New Pay Run</h2>
              <button onClick={() => { setShowModal(false); setPreview(null) }} className="text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:hover:text-white text-xl"></button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Employee *</label>
                <select value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white">
                  <option value="">Select employee…</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.email}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period Start *</label>
                  <input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period End *</label>
                  <input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pay Frequency</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white">
                  <option value="weekly">Weekly</option>
                  <option value="fortnightly">Fortnightly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pay Basis</label>
                <div className="flex gap-2">
                  {(['hourly', 'salary'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, payType: t }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${form.payType === t ? 'text-white border-transparent' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                      style={form.payType === t ? { background: 'var(--primary)' } : {}}>
                      {t === 'hourly' ? '⏱ Hourly' : 'Annual Salary'}
                    </button>
                  ))}
                </div>
              </div>

              {form.payType === 'hourly' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hours Worked *</label>
                    <input type="number" min="0" step="0.5" placeholder="76" value={form.hoursWorked}
                      onChange={e => setForm(f => ({ ...f, hoursWorked: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hourly Rate (AUD) *</label>
                    <input type="number" min="0" step="0.01" placeholder="32.50" value={form.hourlyRate}
                      onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Annual Salary (AUD) *</label>
                  <input type="number" min="0" step="100" placeholder="75000" value={form.annualSalary}
                    onChange={e => setForm(f => ({ ...f, annualSalary: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taxable Allowances</label>
                  <input type="number" min="0" step="0.01" value={form.allowances}
                    onChange={e => setForm(f => ({ ...f, allowances: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pre-tax Deductions</label>
                  <input type="number" min="0" step="0.01" value={form.deductions}
                    onChange={e => setForm(f => ({ ...f, deductions: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white" />
                </div>
              </div>

              <button onClick={handlePreview} disabled={previewing}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90"
                style={{ background: 'var(--accent, #7c3aed)' }}>
                {previewing ? 'Calculating…' : 'Calculate Pay'}
              </button>

              {preview && (
                <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pay Breakdown</h3>
                  <div className="space-y-1.5 text-sm">
                    {[
                      { label: 'Gross Pay',          value: preview.grossPay,         color: 'text-gray-900 dark:text-white', bold: true },
                      { label: 'PAYG Withholding',   value: preview.paygWithholding,  color: 'text-red-500', neg: true },
                      { label: 'Medicare Levy (2%)', value: preview.medicareLevy,     color: 'text-orange-400', neg: true },
                      { label: 'Net Pay',            value: preview.netPay,           color: 'text-green-500', bold: true },
                    ].map(row => (
                      <div key={row.label} className={`flex justify-between ${row.bold ? 'border-t border-gray-200 dark:border-gray-700 pt-1.5 font-semibold' : ''}`}>
                        <span className="text-gray-600 dark:text-gray-400">{row.label}</span>
                        <span className={row.color}>{row.neg ? '−' : ''}{fmt(row.value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#1A6080] dark:text-[#4ebac4]">Employer Super (11.5%)</span>
                      <span className="text-[#4ebac4] font-medium">{fmt(preview.superContribution)} <span className="text-xs text-gray-500 dark:text-gray-400">(on top)</span></span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>Annualised gross / Effective tax rate</span>
                      <span>{fmt(preview.annualisedGross)} / {preview.effectiveTaxRate}%</span>
                    </div>
                  </div>
                  <button onClick={handleCreatePayRun} disabled={saving || !form.employeeId || !form.periodStart || !form.periodEnd}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 hover:opacity-90 mt-1"
                    style={{ background: 'var(--primary)' }}>
                    {saving ? 'Saving…' : 'Confirm & Save Pay Run'}
                  </button>
                  {(!form.employeeId || !form.periodStart || !form.periodEnd) && (
                    <p className="text-xs text-center text-yellow-500">Fill employee and pay period to save.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Pay Run Modal */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card-premium rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">⚡ Bulk Pay Run</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Creates pay runs for all active employees with salary or hourly rate set</p>
              </div>
              <button onClick={() => { setShowBulk(false); setBulkResult(null) }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {bulkError && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">{bulkError}</div>
              )}

              {!bulkResult ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Period Start *</label>
                      <input type="date" value={bulkForm.periodStart}
                        onChange={e => setBulkForm(f => ({ ...f, periodStart: e.target.value }))}
                        className="input-premium" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Period End *</label>
                      <input type="date" value={bulkForm.periodEnd}
                        onChange={e => setBulkForm(f => ({ ...f, periodEnd: e.target.value }))}
                        className="input-premium" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Pay Frequency</label>
                    <select value={bulkForm.frequency}
                      onChange={e => setBulkForm(f => ({ ...f, frequency: e.target.value as any }))}
                      className="input-premium">
                      <option value="weekly">Weekly</option>
                      <option value="fortnightly">Fortnightly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Taxable Allowances</label>
                      <input type="number" min="0" step="0.01" value={bulkForm.allowances}
                        onChange={e => setBulkForm(f => ({ ...f, allowances: e.target.value }))}
                        className="input-premium" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Pre-tax Deductions</label>
                      <input type="number" min="0" step="0.01" value={bulkForm.deductions}
                        onChange={e => setBulkForm(f => ({ ...f, deductions: e.target.value }))}
                        className="input-premium" />
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                    Hourly employees without hours logged will be calculated using standard period hours (weekly: 38h, fortnightly: 76h, monthly: 164h).
                  </div>

                  <button onClick={runBulkPayRun} disabled={bulkRunning || !bulkForm.periodStart || !bulkForm.periodEnd}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90"
                    style={{ background: 'var(--primary)' }}>
                    {bulkRunning ? 'Running pay run…' : 'Run Bulk Pay Run'}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Total',   value: bulkResult.summary.total,   color: 'text-foreground' },
                      { label: 'Created', value: bulkResult.summary.created, color: 'text-green-400' },
                      { label: 'Skipped', value: bulkResult.summary.skipped, color: 'text-amber-400' },
                      { label: 'Failed',  value: bulkResult.summary.failed,  color: 'text-red-400' },
                    ].map(s => (
                      <div key={s.label} className="bg-muted rounded-xl p-3 text-center">
                        <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-muted rounded-xl px-4 py-3 flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Net Pay Created</span>
                    <span className="text-lg font-bold text-green-400">${Number(bulkResult.summary.totalNet).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Per-employee results */}
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {bulkResult.results.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/60">
                        <span className="text-foreground/80">{r.name}</span>
                        <div className="flex items-center gap-2">
                          {r.netPay != null && <span className="text-green-400 font-mono">${r.netPay.toFixed(2)}</span>}
                          <span className={`px-2 py-0.5 rounded-full border text-xs ${
                            r.status === 'created' ? 'bg-green-50 dark:bg-green-900/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' :
                            r.status === 'skipped' ? 'bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300' :
                            'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                          }`}>
                            {r.status}{r.reason ? ` — ${r.reason}` : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => { setShowBulk(false); setBulkResult(null) }}
                      className="flex-1 py-2 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium rounded-lg transition">
                      Done
                    </button>
                    <button onClick={() => { setBulkResult(null); setBulkError('') }}
                      className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white text-sm rounded-lg transition">
                      Run Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payslip Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card-premium rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">Payslip</h2>
              <div className="flex items-center gap-2">
                {(selected.payslipData as any)?.payslipUrl ? (
                  <a
                    href={(selected.payslipData as any).payslipUrl}
                    target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg border border-green-700 text-green-400 hover:bg-green-900/30 transition">
                    📄 View Payslip
                  </a>
                ) : null}
                <GeneratePdfButton recordId={selected.id} onGenerated={(url) => {
                  setSelected(s => s ? { ...s, payslipData: { ...(s.payslipData ?? {}), payslipUrl: url } } : s)
                  load()
                }} />
                <a
                  href={`/tenant/payroll/${selected.id}/payslip`}
                  target="_blank" rel="noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg border border-[#1A6080] text-[#4ebac4] hover:bg-[#0E3D52]/30 transition">
                  🖨 Print
                </a>
                <button onClick={() => setSelected(null)} className="text-gray-600 dark:text-gray-400 hover:text-white text-xl ml-1">×</button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Employee</span><span className="font-medium text-gray-900 dark:text-white">{selected.employeeFirstName} {selected.employeeLastName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Period</span><span className="text-gray-900 dark:text-white">{selected.periodStart} → {selected.periodEnd}</span></div>
              {selected.hoursWorked && (
                <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Hours @ Rate</span><span className="text-gray-900 dark:text-white">{selected.hoursWorked}h @ {fmt(selected.hourlyRate)}/hr</span></div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                {[
                  { label: 'Gross Pay',        value: selected.grossPay,        color: 'text-gray-900 dark:text-white font-semibold' },
                  { label: 'PAYG Withholding', value: selected.paygWithholding, color: 'text-red-400' },
                  { label: 'Medicare Levy',    value: selected.medicareLevy,    color: 'text-orange-400' },
                  { label: 'Net Pay',          value: selected.netPay,          color: 'text-green-400 font-bold text-base' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
                    <span className={row.color}>{fmt(row.value)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex justify-between">
                <span className="text-[#1A6080] dark:text-[#4ebac4]">Employer Super (11.5%)</span>
                <span className="text-[#4ebac4] font-medium">{fmt(selected.superContribution)}</span>
              </div>
              <div className="pt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[selected.status] ?? ''}`}>{selected.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Generate PDF Button ─────────────────────────────────────────────────────

function GeneratePdfButton({ recordId, onGenerated }: {
  recordId: string
  onGenerated: (url: string) => void
}) {
  const [loading,  setLoading]  = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [genError, setGenError] = useState('')

  async function generate(emailEmployee: boolean) {
    if (emailEmployee) setEmailing(true); else setLoading(true)
    try {
      const res  = await fetchWithAuth(`/api/tenant/payroll/${recordId}/pdf`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ emailEmployee }),
      })
      const data = await res.json()
      if (res.ok && data.payslipUrl) {
        setGenError('')
        onGenerated(data.payslipUrl)
        if (!emailEmployee) window.open(data.payslipUrl, '_blank')
      } else {
        setGenError(data.error ?? 'Failed to generate payslip')
      }
    } catch {
      setGenError('Network error — please try again')
    } finally {
      setLoading(false); setEmailing(false)
    }
  }

  return (
    <div className="space-y-1">
      {genError && <p className="text-xs text-red-500 dark:text-red-400">{genError}</p>}
      <div className="flex gap-1">
      <button
        onClick={() => generate(false)}
        disabled={loading || emailing}
        className="text-xs px-3 py-1.5 rounded-lg border border-blue-700 text-blue-400 hover:bg-blue-900/30 transition disabled:opacity-50">
        {loading ? '⏳' : '⚡'} Generate
      </button>
      <button
        onClick={() => generate(true)}
        disabled={loading || emailing}
        title="Generate and email to employee"
        className="text-xs px-3 py-1.5 rounded-lg border border-blue-700 text-blue-400 hover:bg-blue-900/30 transition disabled:opacity-50">
        {emailing ? '⏳' : '📧'}
      </button>
      </div>
    </div>
  )
}
