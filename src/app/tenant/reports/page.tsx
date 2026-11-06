'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useState, useCallback } from 'react'

const REPORTS = [
  { id:'headcount',     label:'Headcount',           icon:'👥', description:'All employees by type and status' },
  { id:'leave',         label:'Leave Summary',        icon:'🏖️', description:'Leave requests in a date range' },
  { id:'compliance',    label:'Compliance / Checks',  icon:'🔒', description:'Screening record status overview' },
  { id:'turnover',      label:'Turnover / Exits',     icon:'🚪', description:'Separation and exit records' },
  { id:'whs',           label:'WHS Incidents',        icon:'⚠️', description:'Workplace safety incidents summary' },
  { id:'training_gap',  label:'Training Gap',         icon:'📚', description:'Employees missing mandatory courses' },
  { id:'payroll',       label:'Payroll Summary',      icon:'💰', description:'Pay runs, totals, super by period' },
]

type ReportRow = Record<string, unknown>
type Summary  = Record<string, number>

// ── Inline SVG chart components ─────────────────────────────────────────────

const CHART_COLORS = ['#0E3D52','#1A6080','#E8973A','#2A9D8F','#6B7280','#10b981','#ef4444']

function BarChart({ data, height = 180 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const barW = Math.min(48, Math.floor(340 / data.length) - 8)
  const chartW = data.length * (barW + 8) + 16
  return (
    <svg width={chartW} height={height + 32} className="overflow-visible">
      {data.map((d, i) => {
        const bh = Math.max(3, Math.round((d.value / max) * height))
        const x  = 8 + i * (barW + 8)
        const y  = height - bh
        const color = d.color ?? CHART_COLORS[i % CHART_COLORS.length]
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={4} fill={color} opacity={0.85} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={11} fill="#9ca3af">{d.value}</text>
            <text x={x + barW / 2} y={height + 16} textAnchor="middle" fontSize={10} fill="#6b7280"
              style={{ maxWidth: barW }}>{d.label.length > 8 ? d.label.slice(0, 7) + '…' : d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ data, size = 140 }: { data: { label: string; value: number; color?: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return null
  const r = size / 2 - 10
  const cx = size / 2, cy = size / 2
  let angle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const frac = d.value / total
    const a1 = angle
    const a2 = angle + frac * 2 * Math.PI
    angle = a2
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    const large = frac > 0.5 ? 1 : 0
    const ir = r * 0.55
    const ix1 = cx + ir * Math.cos(a1), iy1 = cy + ir * Math.sin(a1)
    const ix2 = cx + ir * Math.cos(a2), iy2 = cy + ir * Math.sin(a2)
    return { ...d, path: `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${large},0 ${ix1},${iy1} Z`, color: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }
  })
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.85} />)}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={16} fontWeight="bold" fill="#e5e7eb">{total}</text>
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span className="text-gray-500 ml-auto pl-4">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Per-report chart renderers ───────────────────────────────────────────────

function HeadcountCharts({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Active vs Inactive</p>
        <BarChart data={[
          { label: 'Active',   value: summary.active   ?? 0, color: '#10b981' },
          { label: 'Inactive', value: summary.inactive ?? 0, color: '#6b7280' },
        ]} />
      </div>
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Employment Type</p>
        <DonutChart data={[
          { label: 'Full-time',  value: summary.fullTime   ?? 0, color: '#0E3D52' },
          { label: 'Part-time',  value: summary.partTime   ?? 0, color: '#06b6d4' },
          { label: 'Casual',     value: summary.casual     ?? 0, color: '#f59e0b' },
          { label: 'Contractor', value: summary.contractor ?? 0, color: '#ec4899' },
        ].filter(d => d.value > 0)} />
      </div>
    </div>
  )
}

function LeaveCharts({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">By Status</p>
        <DonutChart data={[
          { label: 'Approved', value: summary.approved ?? 0, color: '#10b981' },
          { label: 'Pending',  value: summary.pending  ?? 0, color: '#f59e0b' },
          { label: 'Rejected', value: summary.rejected ?? 0, color: '#ef4444' },
        ].filter(d => d.value > 0)} />
      </div>
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Days Taken</p>
        <BarChart data={[
          { label: 'Approved Days', value: summary.totalDays ?? 0, color: '#10b981' },
        ]} />
      </div>
    </div>
  )
}

function ComplianceCharts({ summary }: { summary: Summary }) {
  return (
    <div className="card-premium p-4">
      <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Status Breakdown</p>
      <div className="flex flex-wrap gap-8 items-start">
        <DonutChart data={[
          { label: 'Green',   value: summary.green   ?? 0, color: '#10b981' },
          { label: 'Amber',   value: summary.amber   ?? 0, color: '#f59e0b' },
          { label: 'Red',     value: summary.red     ?? 0, color: '#ef4444' },
          { label: 'Pending', value: summary.pending ?? 0, color: '#6b7280' },
        ].filter(d => d.value > 0)} />
        <BarChart data={[
          { label: 'Green',        value: summary.green        ?? 0, color: '#10b981' },
          { label: 'Amber',        value: summary.amber        ?? 0, color: '#f59e0b' },
          { label: 'Red',          value: summary.red          ?? 0, color: '#ef4444' },
          { label: 'Pending',      value: summary.pending      ?? 0, color: '#6b7280' },
          { label: 'Expiring 30d', value: summary.expiringSoon ?? 0, color: '#f97316' },
        ]} />
      </div>
    </div>
  )
}

function TurnoverCharts({ summary }: { summary: Summary }) {
  return (
    <div className="card-premium p-4">
      <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Separation Type</p>
      <BarChart data={[
        { label: 'Voluntary',   value: summary.voluntary   ?? 0, color: '#f59e0b' },
        { label: 'Involuntary', value: summary.involuntary ?? 0, color: '#ef4444' },
        { label: 'Other',       value: summary.other       ?? 0, color: '#6b7280' },
      ]} />
    </div>
  )
}

function WHSCharts({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Open vs Closed</p>
        <BarChart data={[
          { label: 'Open',   value: summary.open   ?? 0, color: '#ef4444' },
          { label: 'Closed', value: summary.closed ?? 0, color: '#10b981' },
        ]} />
      </div>
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Severity</p>
        <BarChart data={[
          { label: 'Critical', value: summary.critical ?? 0, color: '#7f1d1d' },
          { label: 'High',     value: summary.high     ?? 0, color: '#ef4444' },
        ]} />
      </div>
    </div>
  )
}

function TrainingGapCharts({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Compliance</p>
        <DonutChart data={[
          { label: 'Compliant',   value: summary.employeesCompliant ?? 0, color: '#10b981' },
          { label: 'Has Gaps',    value: summary.employeesWithGaps  ?? 0, color: '#ef4444' },
        ].filter(d => d.value > 0)} />
      </div>
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Gap Totals</p>
        <BarChart data={[
          { label: 'Mandatory Courses', value: summary.mandatoryCourses  ?? 0, color: '#0E3D52' },
          { label: 'Total Gaps',        value: summary.totalGaps         ?? 0, color: '#ef4444' },
          { label: 'Employees w/ Gaps', value: summary.employeesWithGaps ?? 0, color: '#f59e0b' },
        ]} />
      </div>
    </div>
  )
}

function PayrollCharts({ summary }: { summary: Summary }) {
  const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Pay Run Status</p>
        <DonutChart data={[
          { label: 'Pending',  value: summary.pending  ?? 0, color: '#f59e0b' },
          { label: 'Approved', value: summary.approved ?? 0, color: '#06b6d4' },
          { label: 'Paid',     value: summary.paid     ?? 0, color: '#10b981' },
        ].filter(d => d.value > 0)} />
      </div>
      <div className="card-premium p-4">
        <p className="text-xs font-semibold text-gray-500  mb-4 dark:text-gray-400">Financials</p>
        <div className="space-y-3">
          {[
            { label: 'Total Gross', value: summary.totalGross ?? 0, color: '#0E3D52' },
            { label: 'Total Net',   value: summary.totalNet   ?? 0, color: '#10b981' },
            { label: 'Total Super', value: summary.totalSuper ?? 0, color: '#ec4899' },
          ].map(item => {
            const pct = summary.totalGross ? Math.round((item.value / summary.totalGross) * 100) : 0
            return (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">{item.label}</span>
                  <span className="text-gray-200 font-mono">{fmt(item.value)}</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: item.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const CHART_MAP: Record<string, (s: Summary) => JSX.Element | null> = {
  headcount:    (s) => <HeadcountCharts summary={s} />,
  leave:        (s) => <LeaveCharts summary={s} />,
  compliance:   (s) => <ComplianceCharts summary={s} />,
  turnover:     (s) => <TurnoverCharts summary={s} />,
  whs:          (s) => <WHSCharts summary={s} />,
  training_gap: (s) => <TrainingGapCharts summary={s} />,
  payroll:      (s) => <PayrollCharts summary={s} />,
}

function downloadCsv(rows: ReportRow[], filename: string) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv  = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n')
  const blob = new Blob([csv], { type:'text/csv' })
  const a = document.createElement('a')
  a.href  = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

function downloadPdf(rows: ReportRow[], reportLabel: string, summary: Summary) {
  if (!rows.length) return
  const columns = Object.keys(rows[0]).filter(k => !k.endsWith('Id') && k !== 'id')
  const fmtKey  = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
  const fmtVal  = (v: unknown) => {
    if (v == null) return '—'
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    return String(v)
  }
  const summaryHtml = Object.entries(summary).length
    ? `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:24px">
        ${Object.entries(summary).map(([k, v]) =>
          `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:#111">${v}</div>
            <div style="font-size:11px;color:#6b7280;text-transform:capitalize;margin-top:2px">${fmtKey(k)}</div>
          </div>`
        ).join('')}
      </div>` : ''
  const thead = `<thead><tr>${columns.map(c =>
    `<th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;background:#f9fafb;border-bottom:2px solid #e5e7eb">${fmtKey(c)}</th>`
  ).join('')}</tr></thead>`
  const tbody = `<tbody>${rows.map((row, i) =>
    `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9fafb'}">${columns.map(c =>
      `<td style="padding:8px 12px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6">${fmtVal(row[c])}</td>`
    ).join('')}</tr>`
  ).join('')}</tbody>`
  const html = `<!DOCTYPE html><html><head><title>${reportLabel}</title>
    <style>body{font-family:Calibri,Arial,sans-serif;padding:24px;color:#111}
    table{width:100%;border-collapse:collapse}@media print{button{display:none}}</style></head>
    <body>
      <h2 style="margin:0 0 4px;color:#4338ca">${reportLabel} Report</h2>
      <p style="color:#6b7280;margin:0 0 20px;font-size:13px">Generated ${new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})}</p>
      ${summaryHtml}
      <table>${thead}${tbody}</table>
          </div>
      <script>window.onload=()=>window.print()<\/script>
    </body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

export default function ReportsPage() {
  const [selected, setSelected]   = useState('headcount')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [data, setData]           = useState<ReportRow[]>([])
  const [summary, setSummary]     = useState<Summary>({})
  const [loading, setLoading]     = useState(false)
  const [ran, setRan]             = useState(false)

  const run = useCallback(async () => {
    setLoading(true); setRan(true)
    const p = new URLSearchParams({ report: selected })
    if (dateFrom) p.set('from', dateFrom)
    if (dateTo)   p.set('to',   dateTo)
    const res = await fetchWithAuth(`/api/tenant/reports?${p}`)
    if (res.ok) {
      const d = await res.json()
      setData(d.data ?? [])
      setSummary(d.summary ?? {})
    }
    setLoading(false)
  }, [selected, dateFrom, dateTo])

  const report = REPORTS.find(r => r.id === selected)!
  const columns = data.length > 0 ? Object.keys(data[0]).filter(k => !k.endsWith('Id') && k !== 'id') : []

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Generate and export HR reports</p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-200 bg-white flex flex-col dark:bg-gray-900 dark:border-gray-700">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold  text-gray-600 dark:text-gray-400 mb-3">Report Type</p>
            <div className="space-y-1">
              {REPORTS.map(r => (
                <button key={r.id} onClick={() => { setSelected(r.id); setRan(false); setData([]); setSummary({}) }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${selected===r.id ? 'bg-[#E0EEF4] text-[#0E3D52] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span className="mr-2">{r.icon}</span>{r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-xs font-semibold  text-gray-600 dark:text-gray-400">Date Range</p>
            <div>
              <label className="text-xs text-gray-500 mb-1 block dark:text-gray-400">From</label>
              <input type="date" className="input-premium" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block dark:text-gray-400">To</label>
              <input type="date" className="input-premium" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button onClick={run} disabled={loading}
              className="w-full py-2 bg-[#0E3D52] text-white rounded-lg text-sm font-medium hover:bg-[#1A6080] disabled:opacity-50">
              {loading ? 'Running…' : 'Run Report'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800">
          {!ran ? (
            <div className="flex items-center justify-center h-full text-center p-8">
              <div>
                <p className="text-5xl mb-4">{report.icon}</p>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{report.label}</h2>
                <p className="text-sm text-gray-500 mt-1 mb-6 dark:text-gray-400">{report.description}</p>
                <button onClick={run} className="px-6 py-2.5 bg-[#0E3D52] text-white rounded-lg text-sm font-medium hover:bg-[#1A6080]">Run Report</button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-gray-600 dark:text-gray-400 text-sm">Generating report…</div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Summary cards */}
              {Object.keys(summary).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {Object.entries(summary).map(([k, v]) => (
                    <div key={k} className="card-premium p-4 text-center">
                      <p className="page-premium-title">{v}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5 dark:text-gray-400">{k.replace(/([A-Z])/g,' $1').toLowerCase()}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Charts */}
              {Object.keys(summary).length > 0 && CHART_MAP[selected] && (
                <div>{CHART_MAP[selected](summary)}</div>
              )}

              {/* Export + row count */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-medium">{data.length}</span> records</p>
                <div className="flex gap-2">
                  <button onClick={() => downloadPdf(data, report.label, summary)}
                    disabled={data.length === 0}
                    className="px-4 py-2 border border-[#9ccfda] bg-[#f0f7fb] rounded-lg text-sm text-[#0E3D52] hover:bg-[#E0EEF4] disabled:opacity-50 dark:bg-[#0E3D52]/20 dark:text-[#4ebac4] dark:border-[#1A6080]">
                    🖨 Export PDF
                  </button>
                  <button onClick={() => downloadCsv(data, `${selected}-report.csv`)}
                    disabled={data.length === 0}
                    className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700">
                    ⬇ Export CSV
                  </button>
                </div>
              </div>

              {/* Table */}
              {data.length === 0 ? (
                <div className="card-premium py-12 text-center text-sm text-gray-600 dark:text-gray-400">No data for this period</div>
              ) : (
                <div className="card-premium overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="table-responsive">
            <table className="table-premium">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 dark:bg-gray-800 dark:border-gray-800">
                          {columns.map(c => (
                            <th key={c} className="px-4 py-3 text-left text-xs font-semibold text-gray-500  whitespace-nowrap dark:text-gray-400">
                              {c.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.map((row, i) => (
                          <tr key={i}>
                            {columns.map(c => (
                              <td key={c} className="px-4 py-3 text-gray-700 whitespace-nowrap dark:text-gray-300">
                                {row[c] instanceof Date
                                  ? (row[c] as Date).toLocaleDateString()
                                  : typeof row[c] === 'boolean'
                                  ? row[c] ? '' : '—'
                                  : String(row[c] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
          </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
