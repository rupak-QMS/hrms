'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate, fmtCsvCurrency } from '@/lib/exportCsv'

interface PayrollRun {
  id: string
  name: string
  periodStart: string
  periodEnd: string
  payDate: string | null
  frequency: string
  status: string
  totalGross: string | null
  totalNet: string | null
  totalTax: string | null
  totalSuper: string | null
  employeeCount: number | null
  notes: string | null
  createdBy: string | null
  finalisedBy: string | null
  finalisedAt: string | null
  createdAt: string
}

interface RunEntry {
  id: string
  firstName: string | null
  lastName: string | null
  employeeNumber: string | null
  employmentType: string | null
  hoursWorked: string
  grossPay: string
  paygWithholding: string
  medicareLevy: string
  superContribution: string
  netPay: string
}

const STATUS_COLORS: Record<string, string> = {
  draft:       'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  processing:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  finalised:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  paid:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', processing: 'Processing', finalised: 'Finalised', paid: 'Paid',
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
}

function fmt(val: string | number | null | undefined) {
  if (val === null || val === undefined) return '$0.00'
  const n = parseFloat(String(val))
  if (isNaN(n)) return '$0.00'
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Lifecycle step indicator
function LifecycleSteps({ status }: { status: string }) {
  const steps = [
    { key: 'draft',      label: 'Draft' },
    { key: 'calculated', label: 'Calculated' },
    { key: 'finalised',  label: 'Finalised' },
    { key: 'paid',       label: 'Paid' },
  ]

  const idx = status === 'processing' ? 1
    : status === 'draft' ? 0
    : status === 'finalised' ? 2
    : status === 'paid' ? 3
    : 0

  // After process, draft with entries = step 1
  return (
    <div className="flex items-center gap-0 mt-4">
      {steps.map((step, i) => {
        const done    = i < idx || (status === 'draft' && i === 0)
        const current = i === idx && status !== 'draft'
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className={`flex flex-col items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 z-10
                ${done    ? 'bg-indigo-600 border-indigo-600 text-white'
                : current ? 'bg-white border-indigo-600 text-indigo-600 dark:bg-gray-800'
                :           'bg-white border-gray-200 text-gray-400 dark:bg-gray-800 dark:border-gray-600'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 ${done || current ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < idx ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function PayrollFinancePage() {
  const [runs, setRuns]               = useState<PayrollRun[]>([])
  const [selected, setSelected]       = useState<PayrollRun | null>(null)
  const [entries, setEntries]         = useState<RunEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [showModal, setShowModal]     = useState(false)
  const [actionMsg, setActionMsg]     = useState<string | null>(null)
  const [actionErr, setActionErr]     = useState<string | null>(null)
  const [processing, setProcessing]   = useState(false)
  const [form, setForm]               = useState({
    name: '', periodStart: '', periodEnd: '', payDate: '', frequency: 'fortnightly', notes: '',
  })
  const [submitting, setSubmitting]   = useState(false)

  const flash = (msg: string, isErr = false) => {
    if (isErr) { setActionErr(msg); setActionMsg(null) }
    else        { setActionMsg(msg); setActionErr(null) }
    setTimeout(() => { setActionMsg(null); setActionErr(null) }, 5000)
  }

  const loadRuns = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetchWithAuth('/api/tenant/payroll-finance/runs')
      const data = await res.json()
      setRuns(data.runs || [])
    } finally { setLoading(false) }
  }, [])

  const loadEntries = useCallback(async (runId: string) => {
    setEntriesLoading(true)
    try {
      const res  = await fetchWithAuth(`/api/tenant/payroll-finance/runs/${runId}/entries`)
      const data = await res.json()
      setEntries(data.entries || [])
    } finally { setEntriesLoading(false) }
  }, [])

  useEffect(() => { loadRuns() }, [loadRuns])

  const selectRun = (run: PayrollRun) => {
    setSelected(run)
    loadEntries(run.id)
    setActionMsg(null)
    setActionErr(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetchWithAuth('/api/tenant/payroll-finance/runs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { flash(data.error || 'Failed to create run', true); return }
      await loadRuns()
      setShowModal(false)
      setForm({ name: '', periodStart: '', periodEnd: '', payDate: '', frequency: 'fortnightly', notes: '' })
      setSelected(data.run)
      setEntries([])
    } finally { setSubmitting(false) }
  }

  // Step 1: Process (calculate pay for all active employees)
  const processRun = async (runId: string) => {
    setProcessing(true)
    flash('Calculating payroll…')
    try {
      const res  = await fetchWithAuth(`/api/tenant/payroll-finance/runs/${runId}/process`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { flash(data.error || 'Processing failed', true); return }
      flash(`✅ Calculated: ${data.entriesCount} employees · Gross ${fmt(data.totals?.gross)} · Net ${fmt(data.totals?.net)}`)
      await loadRuns()
      const refreshed = await fetchWithAuth(`/api/tenant/payroll-finance/runs/${runId}`)
      const rdata = await refreshed.json()
      if (rdata.run) setSelected(rdata.run)
      await loadEntries(runId)
    } catch { flash('Payroll processing error', true) }
    finally { setProcessing(false) }
  }

  // Step 2: Finalise (lock + create payslip records)
  const finaliseRun = async (runId: string) => {
    if (!confirm('Finalise this payroll run? It will be locked and payslip records created.')) return
    const res  = await fetchWithAuth(`/api/tenant/payroll-finance/runs/${runId}/finalise`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { flash(data.error || 'Finalise failed', true); return }
    flash(`✅ Run finalised · ${data.payslips} payslip records created`)
    await loadRuns()
    setSelected(data.run)
  }

  // Step 3: Mark paid
  const markPaid = async (runId: string) => {
    const res  = await fetchWithAuth(`/api/tenant/payroll-finance/runs/${runId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'paid' }),
    })
    const data = await res.json()
    if (!res.ok) { flash(data.error || 'Failed', true); return }
    flash('✅ Run marked as paid')
    await loadRuns()
    setSelected(data.run)
  }

  // Export ABA bank file
  const exportAba = async (runId: string, runName: string) => {
    flash('Generating ABA bank file…')
    const res = await fetchWithAuth(`/api/tenant/payroll-finance/runs/${runId}/export-aba`)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      flash((d as {error?:string}).error || 'Export failed', true)
      return
    }
    const blob     = await res.blob()
    const url      = URL.createObjectURL(blob)
    const a        = document.createElement('a')
    a.href         = url
    a.download     = `payroll-${runName.replace(/[^a-z0-9]/gi, '-')}.aba`
    a.click()
    URL.revokeObjectURL(url)
    flash('✅ ABA file downloaded')
  }

  // Generate payslip PDFs for all employees in this run
  const generatePayslips = async (runId: string) => {
    if (entries.length === 0) { flash('No entries to generate PDFs for', true); return }
    flash(`Generating ${entries.length} payslip PDFs…`)
    // The PDF endpoint takes a payroll_record id, not a run entry id.
    // We'll call the bulk payslip-by-run endpoint if it exists, otherwise
    // generate via each payrollRecord tied to this run.
    // Fall back to the per-record PDF route.
    try {
      const res  = await fetchWithAuth(`/api/tenant/payroll-finance/runs/${runId}/payslips`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ runId }),
      })
      const data = await res.json()
      if (!res.ok) { flash((data as {error?:string}).error || 'PDF generation failed', true); return }
      flash(`✅ ${(data as {generated?:number}).generated ?? entries.length} payslip PDFs generated and emailed`)
    } catch { flash('PDF generation failed', true) }
  }

  function exportRunsCsv() {
    exportCsv({
      filename: 'payroll-runs',
      columns: [
        { header: 'Run Name',     key: 'name' },
        { header: 'Period Start', key: 'periodStart', format: fmtCsvDate },
        { header: 'Period End',   key: 'periodEnd',   format: fmtCsvDate },
        { header: 'Pay Date',     key: 'payDate',     format: fmtCsvDate },
        { header: 'Frequency',    key: 'frequency',   format: (v) => FREQ_LABELS[v as string] ?? String(v) },
        { header: 'Status',       key: 'status' },
        { header: 'Employees',    key: 'employeeCount' },
        { header: 'Total Gross',  key: 'totalGross',  format: fmtCsvCurrency },
        { header: 'Total Tax',    key: 'totalTax',    format: fmtCsvCurrency },
        { header: 'Total Super',  key: 'totalSuper',  format: fmtCsvCurrency },
        { header: 'Total Net',    key: 'totalNet',    format: fmtCsvCurrency },
      ],
      rows: runs,
    })
  }

  const totalsByStatus = runs.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const hasEntries = entries.length > 0

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">

      {/* LEFT PANEL — run list */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">💰 Payroll Runs</h2>
            <div className="flex items-center gap-2">
              <ExportButton onClick={exportRunsCsv} disabled={runs.length === 0} />
              <button
                onClick={() => setShowModal(true)}
                className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
              >+ New Run</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totalsByStatus).map(([s, n]) => (
              <span key={s} className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
                {STATUS_LABELS[s] || s} ({n})
              </span>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading…</div>
          ) : runs.length === 0 ? (
            <div className="p-6 text-center text-gray-400 dark:text-gray-500 text-sm">No payroll runs yet</div>
          ) : (
            runs.map(run => (
              <div
                key={run.id}
                onClick={() => selectRun(run)}
                className={`p-4 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  selected?.id === run.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{run.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {fmtDate(run.periodStart)} – {fmtDate(run.periodEnd)}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[run.status]}`}>
                    {STATUS_LABELS[run.status] || run.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{FREQ_LABELS[run.frequency] || run.frequency}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{fmt(run.totalNet)} net</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL — run detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <div className="text-5xl mb-3">💰</div>
              <p className="text-lg font-medium">Select a payroll run</p>
              <p className="text-sm mt-1">or create a new one to get started</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="page-premium-title">{selected.name}</h1>
                  <p className="page-premium-subtitle mt-1">
                    {fmtDate(selected.periodStart)} – {fmtDate(selected.periodEnd)}
                    {selected.payDate && <> · Pay date: {fmtDate(selected.payDate)}</>}
                    {selected.employeeCount ? <> · {selected.employeeCount} employees</> : null}
                    {selected.finalisedBy && <> · Finalised by {selected.finalisedBy}</>}
                  </p>
                </div>

                {/* Action buttons by lifecycle stage */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {/* DRAFT: Process then Finalise */}
                  {selected.status === 'draft' && (
                    <>
                      <button
                        onClick={() => processRun(selected.id)}
                        disabled={processing}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {processing
                          ? <><span className="animate-spin">⟳</span> Calculating…</>
                          : <>⚡ {hasEntries ? 'Recalculate' : 'Calculate Pay'}</>}
                      </button>
                      {hasEntries && (
                        <button
                          onClick={() => finaliseRun(selected.id)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                        >🔒 Finalise</button>
                      )}
                    </>
                  )}

                  {/* FINALISED: Mark paid + ABA export + payslip PDFs */}
                  {selected.status === 'finalised' && (
                    <>
                      <button
                        onClick={() => exportAba(selected.id, selected.name)}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                      >📄 Export ABA</button>
                      <button
                        onClick={() => generatePayslips(selected.id)}
                        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
                      >📑 Payslip PDFs</button>
                      <button
                        onClick={() => markPaid(selected.id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                      >✅ Mark Paid</button>
                    </>
                  )}

                  {/* PAID: ABA and payslips still available */}
                  {selected.status === 'paid' && (
                    <>
                      <button
                        onClick={() => exportAba(selected.id, selected.name)}
                        className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      >📄 Re-export ABA</button>
                      <button
                        onClick={() => generatePayslips(selected.id)}
                        className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                      >📑 Payslip PDFs</button>
                    </>
                  )}
                </div>
              </div>

              {/* Flash messages */}
              {actionMsg && (
                <div className="mt-3 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
                  {actionMsg}
                </div>
              )}
              {actionErr && (
                <div className="mt-3 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                  ⚠️ {actionErr}
                </div>
              )}

              {/* Lifecycle progress */}
              <LifecycleSteps status={selected.status} />

              {/* Totals tiles */}
              {hasEntries && (
                <div className="mt-5 grid grid-cols-4 gap-4">
                  {[
                    { label: 'Gross Pay',   value: fmt(selected.totalGross), color: 'blue' },
                    { label: 'Tax (PAYG)',   value: fmt(selected.totalTax),   color: 'red' },
                    { label: 'Super (11.5%)',value: fmt(selected.totalSuper), color: 'purple' },
                    { label: 'Net Pay',      value: fmt(selected.totalNet),   color: 'green' },
                  ].map(tile => (
                    <div key={tile.label} className={`bg-${tile.color}-50 dark:bg-${tile.color}-900/20 rounded-xl p-4`}>
                      <p className={`text-xs font-medium text-${tile.color}-600 dark:text-${tile.color}-400`}>{tile.label}</p>
                      <p className={`text-xl font-bold text-${tile.color}-700 dark:text-${tile.color}-300 mt-1`}>{tile.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Entries table */}
            <div className="flex-1 overflow-auto p-6">
              {!hasEntries && selected.status === 'draft' ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-700 p-10 text-center">
                  <div className="text-4xl mb-3">⚡</div>
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Ready to calculate</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">
                    Click <strong>Calculate Pay</strong> to run AU-compliant payroll for all active employees.<br />
                    PAYG withholding, Medicare levy, and 11.5% super will be computed automatically.
                  </p>
                  <button
                    onClick={() => processRun(selected.id)}
                    disabled={processing}
                    className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >{processing ? 'Calculating…' : '⚡ Calculate Pay'}</button>
                </div>
              ) : entriesLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading entries…</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Employee Entries ({entries.length})
                    </h3>
                    {selected.status === 'draft' && hasEntries && (
                      <p className="text-xs text-gray-400">Review entries, then click <strong>Finalise</strong> to lock.</p>
                    )}
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="table-responsive">
                      <table className="table-premium">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            {['Employee', 'Type', 'Hours', 'Gross', 'PAYG Tax', 'Medicare', 'Super', 'Net Pay'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {entries.map(e => (
                            <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900 dark:text-white">{e.firstName} {e.lastName}</p>
                                <p className="text-xs text-gray-400">{e.employeeNumber}</p>
                              </td>
                              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize text-sm">{e.employmentType || '—'}</td>
                              <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-sm tabular-nums">{parseFloat(e.hoursWorked || '0').toFixed(1)}h</td>
                              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white text-sm tabular-nums">{fmt(e.grossPay)}</td>
                              <td className="px-4 py-3 text-red-600 dark:text-red-400 text-sm tabular-nums">{fmt(e.paygWithholding)}</td>
                              <td className="px-4 py-3 text-orange-600 dark:text-orange-400 text-sm tabular-nums">{fmt(e.medicareLevy)}</td>
                              <td className="px-4 py-3 text-purple-600 dark:text-purple-400 text-sm tabular-nums">{fmt(e.superContribution)}</td>
                              <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400 text-sm tabular-nums">{fmt(e.netPay)}</td>
                            </tr>
                          ))}
                        </tbody>
                        {/* Totals footer */}
                        <tfoot className="bg-gray-50 dark:bg-gray-700 border-t-2 border-gray-200 dark:border-gray-600">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase">Totals</td>
                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white text-sm tabular-nums">{fmt(selected.totalGross)}</td>
                            <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400 text-sm tabular-nums">
                              {fmt(entries.reduce((s, e) => s + parseFloat(e.paygWithholding || '0'), 0))}
                            </td>
                            <td className="px-4 py-3 font-bold text-orange-600 dark:text-orange-400 text-sm tabular-nums">
                              {fmt(entries.reduce((s, e) => s + parseFloat(e.medicareLevy || '0'), 0))}
                            </td>
                            <td className="px-4 py-3 font-bold text-purple-600 dark:text-purple-400 text-sm tabular-nums">{fmt(selected.totalSuper)}</td>
                            <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400 text-sm tabular-nums">{fmt(selected.totalNet)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* AU Compliance note */}
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400">
                    🇦🇺 <strong>AU Compliance:</strong> PAYG withholding calculated per ATO Schedule 1 weekly tax tables (2024–25).
                    Medicare levy at 2%. Superannuation at 11.5% SG rate. Annual leave accruing at 17.3% of ordinary hours.
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* NEW RUN MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">New Payroll Run</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl">×</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Run Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Fortnight 1 – Nov 2026"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period Start *</label>
                  <input required type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Period End *</label>
                  <input required type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pay Date</label>
                  <input type="date" value={form.payDate} onChange={e => setForm(f => ({ ...f, payDate: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {submitting ? 'Creating…' : 'Create Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
