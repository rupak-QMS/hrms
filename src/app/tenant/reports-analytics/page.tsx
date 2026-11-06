'use client'

import { useState, useCallback, useEffect } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

type ReportType =
  | 'headcount'
  | 'leave_summary'
  | 'leave_liability'
  | 'payroll_summary'
  | 'shift_summary'
  | 'compliance_expiry'
  | 'turnover'
  | 'ndis_workforce'
  | 'expense_summary'

interface FilterDef {
  key: string
  label: string
  type: 'date' | 'select' | 'number'
  options?: { value: string; label: string }[]
}

interface ReportConfig {
  type: ReportType
  label: string
  icon: string
  description: string
  group: string
  filters: FilterDef[]
  exportable?: boolean
}

const REPORT_CONFIGS: ReportConfig[] = [
  // Workforce
  {
    type: 'headcount',
    label: 'Headcount Report',
    icon: '👥',
    description: 'Active employee count by employment type',
    group: 'Workforce',
    filters: [],
    exportable: true,
  },
  {
    type: 'leave_liability',
    label: 'Leave Liability',
    icon: '💰',
    description: 'Dollar value of accrued annual leave per employee',
    group: 'Workforce',
    filters: [],
    exportable: true,
  },
  {
    type: 'turnover',
    label: 'Turnover & Retention',
    icon: '📉',
    description: 'Separations by type and reason for a period',
    group: 'Workforce',
    filters: [
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate',   label: 'To',   type: 'date' },
    ],
    exportable: true,
  },
  // Leave & Attendance
  {
    type: 'leave_summary',
    label: 'Leave Summary',
    icon: '🌴',
    description: 'Leave requests by type and status for a period',
    group: 'Leave & Attendance',
    filters: [
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate',   label: 'To',   type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [
        { value: '', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
      ]},
    ],
    exportable: true,
  },
  {
    type: 'shift_summary',
    label: 'Shift Summary',
    icon: '📅',
    description: 'Shifts by type and status for a period',
    group: 'Leave & Attendance',
    filters: [
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate',   label: 'To',   type: 'date' },
    ],
    exportable: true,
  },
  // Finance
  {
    type: 'payroll_summary',
    label: 'Payroll Summary',
    icon: '💸',
    description: 'All payroll runs with totals',
    group: 'Finance',
    filters: [],
    exportable: true,
  },
  {
    type: 'expense_summary',
    label: 'Expense Summary',
    icon: '🧾',
    description: 'Expense claims by category and status',
    group: 'Finance',
    filters: [
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate',   label: 'To',   type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [
        { value: '', label: 'All Statuses' },
        { value: 'draft', label: 'Draft' },
        { value: 'submitted', label: 'Submitted' },
        { value: 'approved', label: 'Approved' },
        { value: 'paid', label: 'Paid' },
      ]},
    ],
    exportable: true,
  },
  // Compliance & NDIS
  {
    type: 'compliance_expiry',
    label: 'Compliance Expiry',
    icon: '⚠️',
    description: 'Checks expiring within N days',
    group: 'Compliance & NDIS',
    filters: [
      { key: 'days', label: 'Days ahead', type: 'number' },
    ],
    exportable: true,
  },
  {
    type: 'ndis_workforce',
    label: 'NDIS Workforce Export',
    icon: '📋',
    description: 'Active workers for NDIS Commission reporting',
    group: 'Compliance & NDIS',
    filters: [],
    exportable: true,
  },
]

const GROUPS = [...new Set(REPORT_CONFIGS.map(r => r.group))]

type ReportRow = Record<string, any>

interface SavedReport {
  id: string
  name: string
  reportType: string
  filters: Record<string, string>
  createdBy: string
  lastRunAt: string | null
  updatedAt: string
}

function fmt(v: string | number | null | undefined) {
  if (v === null || v === undefined) return '—'
  const n = parseFloat(String(v))
  if (isNaN(n)) return String(v)
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' && (key.includes('pay') || key.includes('gross') || key.includes('net') || key.includes('tax') || key.includes('super') || key.includes('alary') || key.includes('mount') || key.includes('iability') || key.includes('Rate'))) {
    return fmt(value)
  }
  if (typeof value === 'string' && (key.includes('Date') || key.includes('date') || key.includes('Start') || key.includes('End') || key.includes('At'))) {
    try { return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return String(value) }
  }
  if (typeof value === 'string') return value.replace(/_/g, ' ')
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function prettyKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

function exportCSV(columns: string[], rows: ReportRow[], filename: string) {
  const header = columns.map(prettyKey).join(',')
  const body = rows.map(row =>
    columns.map(col => {
      const v = row[col]
      const s = String(v ?? '')
      return s.includes(',') ? `"${s}"` : s
    }).join(',')
  ).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportPDF(label: string, columns: string[], rows: ReportRow[], activeFilters: Record<string, string>) {
  const filterStr = Object.entries(activeFilters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${prettyKey(k)}: ${v}`)
    .join('  |  ')
  const tableRows = rows.map(row =>
    `<tr>${columns.map(col => `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${String(row[col] ?? '—')}</td>`).join('')}</tr>`
  ).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${label}</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}p{font-size:12px;color:#555;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f3f4f6;text-align:left;padding:7px 10px;border-bottom:2px solid #d1d5db;font-weight:600}
  tr:nth-child(even){background:#f9fafb}
  @media print{body{padding:0}}</style></head>
  <body><h1>${label}</h1><p>${filterStr || 'No filters applied'} — Generated ${new Date().toLocaleString('en-AU')}</p>
  <table><thead><tr>${columns.map(c => `<th>${prettyKey(c)}</th>`).join('')}</tr></thead>
  <tbody>${tableRows}</tbody></table>
          </div></body></html>`
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); win.close() }, 500)
}

export default function ReportsAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'run' | 'saved'>('run')
  const [selected, setSelected] = useState<ReportConfig | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [results, setResults] = useState<ReportRow[] | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Save modal
  const [saveModal, setSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveShared, setSaveShared] = useState(false)
  const [saving, setSaving] = useState(false)

  // Saved reports
  const [savedReports, setSavedReports] = useState<SavedReport[]>([])
  const [loadingSaved, setLoadingSaved] = useState(false)

  const loadSaved = useCallback(async () => {
    setLoadingSaved(true)
    try {
      const res = await fetchWithAuth('/api/tenant/reports-analytics/saved')
      const data = await res.json()
      if (res.ok) setSavedReports(data.reports || [])
    } finally { setLoadingSaved(false) }
  }, [])

  useEffect(() => { loadSaved() }, [loadSaved])

  const runReport = useCallback(async (cfg?: ReportConfig, flt?: Record<string, string>) => {
    const reportCfg = cfg || selected
    const reportFilters = flt || filters
    if (!reportCfg) return
    setRunning(true)
    setError(null)
    setResults(null)
    try {
      const res = await fetchWithAuth('/api/tenant/reports-analytics/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: reportCfg.type, filters: reportFilters }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Report failed'); return }
      setResults(data.data || [])
    } catch {
      setError('Network error — please try again')
    } finally { setRunning(false) }
  }, [selected, filters])

  const runSavedReport = async (report: SavedReport) => {
    const cfg = REPORT_CONFIGS.find(r => r.type === report.reportType)
    if (!cfg) return
    setSelected(cfg)
    setFilters(report.filters || {})
    setActiveTab('run')
    setResults(null)
    setError(null)
    // Run with saved filters
    setRunning(true)
    try {
      const res = await fetchWithAuth('/api/tenant/reports-analytics/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: report.reportType, filters: report.filters || {} }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Report failed'); return }
      setResults(data.data || [])
      // Update lastRunAt
      await fetchWithAuth(`/api/tenant/reports-analytics/saved/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastRunAt: new Date().toISOString() }),
      })
    } catch {
      setError('Network error — please try again')
    } finally { setRunning(false) }
  }

  const deleteSaved = async (id: string) => {
    await fetchWithAuth(`/api/tenant/reports-analytics/saved/${id}`, { method: 'DELETE' })
    loadSaved()
  }

  const saveReport = async () => {
    if (!selected || !saveName) return
    setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/reports-analytics/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName,
          reportType: selected.type,
          filters,
          isShared: saveShared,
        }),
      })
      setSaveModal(false)
      setSaveName('')
      setSaveShared(false)
      loadSaved()
    } finally { setSaving(false) }
  }

  const columns = results && results.length > 0 ? Object.keys(results[0]) : []

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* LEFT: Report picker */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">📊 Reports</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Choose a report to run</p>
          {/* Tabs */}
          <div className="flex gap-1 mt-3 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            <button onClick={() => setActiveTab('run')}
              className={`flex-1 text-xs py-1 rounded-md font-medium transition-all ${activeTab === 'run' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              All Reports
            </button>
            <button onClick={() => setActiveTab('saved')}
              className={`flex-1 text-xs py-1 rounded-md font-medium transition-all ${activeTab === 'saved' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              Saved ({savedReports.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {activeTab === 'run' ? (
            GROUPS.map(group => (
              <div key={group}>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500  px-1 mb-1">{group}</p>
                <div className="space-y-1">
                  {REPORT_CONFIGS.filter(r => r.group === group).map(cfg => (
                    <button
                      key={cfg.type}
                      onClick={() => { setSelected(cfg); setFilters({}); setResults(null); setError(null) }}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.type === cfg.type ? 'border-[#b8d4e0] bg-[#E0EEF4] dark:bg-[#0E3D52]/15 dark:border-[#0E3D52]' : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{cfg.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{cfg.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cfg.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {loadingSaved ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
              ) : savedReports.length === 0 ? (
                <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                  <p className="text-2xl mb-1">💾</p>
                  <p className="text-xs">No saved reports yet</p>
                </div>
              ) : (
                savedReports.map(r => {
                  const cfg = REPORT_CONFIGS.find(c => c.type === r.reportType)
                  return (
                    <div key={r.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{cfg?.label || r.reportType}</p>
                          {r.lastRunAt && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Last run {new Date(r.lastRunAt).toLocaleDateString('en-AU')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          <button onClick={() => runSavedReport(r)}
                            className="text-xs px-2 py-1 bg-[#0E3D52] text-white rounded-lg hover:bg-[#1A6080]">
                            ▶
                          </button>
                          <button onClick={() => deleteSaved(r.id)}
                            className="text-xs px-2 py-1 text-red-500 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Report output */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <div className="text-5xl mb-3">📊</div>
              <p className="text-lg font-medium">Select a report</p>
              <p className="text-sm mt-1">Choose from the list on the left to get started</p>
            </div>
          </div>
        ) : (
          <>
            {/* Report header + filters */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="page-premium-title">
                    {selected.icon} {selected.label}
                  </h1>
                  <p className="page-premium-subtitle mt-1">{selected.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {results && results.length > 0 && (
                    <>
                      <button
                        onClick={() => exportCSV(columns, results, `${selected.type}_${new Date().toISOString().split('T')[0]}.csv`)}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                        ⬇ CSV
                      </button>
                      <button
                        onClick={() => exportPDF(selected.label, columns, results, filters)}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                        🖨 PDF
                      </button>
                      <button onClick={() => setSaveModal(true)}
                        className="px-3 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                        💾 Save
                      </button>
                    </>
                  )}
                  <button onClick={() => runReport()} disabled={running}
                    className="px-4 py-2 bg-[#0E3D52] text-white text-sm font-medium rounded-lg hover:bg-[#1A6080] disabled:opacity-50">
                    {running ? 'Running…' : '▶ Run Report'}
                  </button>
                </div>
              </div>

              {/* Filters */}
              {selected.filters.length > 0 && (
                <div className="flex items-end gap-4 mt-4 flex-wrap">
                  {selected.filters.map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
                      {f.type === 'select' ? (
                        <select
                          value={filters[f.key] || ''}
                          onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                          {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.type}
                          value={filters[f.key] || (f.type === 'number' ? '30' : '')}
                          onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
                          className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-36" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto p-6">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-400 mb-4">
                  {error}
                </div>
              )}

              {running && (
                <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <div className="text-center">
                    <div className="text-3xl mb-2">⏳</div>
                    <p className="text-sm">Running report…</p>
                  </div>
                </div>
              )}

              {!running && results === null && !error && (
                <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <div className="text-center">
                    <div className="text-3xl mb-2">▶</div>
                    <p className="text-sm">Click &ldquo;Run Report&rdquo; to see results</p>
                  </div>
                </div>
              )}

              {!running && results !== null && results.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                  No data found for the selected filters
                </div>
              )}

              {!running && results !== null && results.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {results.length} row{results.length !== 1 ? 's' : ''}
                    </p>
                    {/* Leave Liability total */}
                    {selected.type === 'leave_liability' && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-2 text-sm">
                        <span className="text-amber-700 dark:text-amber-300 font-semibold">
                          Total liability: ${results.reduce((acc, r) => acc + parseFloat(r.estimatedLiability || '0'), 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="table-responsive">
            <table className="table-premium">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          {columns.map(col => (
                            <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">
                              {prettyKey(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {results.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            {columns.map(col => (
                              <td key={col} className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap capitalize">
                                {formatValue(col, row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
          </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* SAVE MODAL */}
      {saveModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Save Report</h3>
            <input
              autoFocus
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Report name…"
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-3"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-4 cursor-pointer">
              <input type="checkbox" checked={saveShared} onChange={e => setSaveShared(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600" />
              Share with all users in this organisation
            </label>
            <div className="flex gap-3">
              <button onClick={() => setSaveModal(false)}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button onClick={saveReport} disabled={saving || !saveName}
                className="flex-1 btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
