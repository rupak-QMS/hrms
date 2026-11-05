'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type PayslipRecord = {
  id:                string
  employeeId:        string
  periodStart:       string
  periodEnd:         string
  hoursWorked:       string | null
  hourlyRate:        string | null
  grossPay:          string | null
  paygWithholding:   string | null
  medicareLevy:      string | null
  superContribution: string | null
  netPay:            string | null
  payslipData:       Record<string, unknown> | null
  status:            string
  createdAt:         string
  employeeFirstName: string | null
  employeeLastName:  string | null
  employeeEmail:     string | null
  employeeEntityName: string | null
}

type TenantInfo = { name: string; logoUrl: string | null; abn: string | null }

const fmt = (n: number | string | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PayslipPrintPage() {
  const { id }   = useParams<{ id: string }>()
  const [rec,    setRec]    = useState<PayslipRecord | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [error,  setError]  = useState('')

  useEffect(() => {
    Promise.all([
      fetchWithAuth(`/api/tenant/payroll/${id}`).then(r => r.json()),
      fetchWithAuth('/api/tenant/config').then(r => r.json()).catch(() => ({})),
    ]).then(([pd, td]) => {
      if (pd.error) { setError(pd.error); return }
      setRec(pd.record)
      if (td?.name) setTenant({ name: td.name, logoUrl: td.logoUrl ?? null, abn: td.settings?.abn ?? null })
    })
  }, [id])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    )
  }

  if (!rec) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-400 text-sm">Loading payslip…</p>
      </div>
    )
  }

  const isHourly  = rec.hoursWorked && rec.hourlyRate
  const allowances = Number((rec.payslipData as any)?.allowances ?? 0)
  const deductions = Number((rec.payslipData as any)?.deductions ?? 0)
  const frequency  = (rec.payslipData as any)?.frequency ?? 'fortnightly'
  const effTax     = (rec.payslipData as any)?.effectiveTaxRate ?? null
  const annGross   = (rec.payslipData as any)?.annualisedGross ?? null

  return (
    <>
      {/* Print-specific global styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 15mm; size: A4; }
        }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #fff; }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print flex justify-end p-4 bg-gray-50 border-b border-gray-200 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium px-5 py-2 rounded-lg transition">
          🖨 Print / Save as PDF
        </button>
      </div>

      {/* Payslip document */}
      <div className="max-w-2xl mx-auto p-8 bg-white text-gray-900" id="payslip">

        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4 mb-6">
          <div>
            {tenant?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt="Logo" className="h-10 mb-2 object-contain" />
            )}
            <h1 className="text-xl font-bold text-gray-900">{tenant?.name ?? 'Yahweh Care'}</h1>
            {tenant?.abn && <p className="text-xs text-gray-500 mt-0.5">ABN: {tenant.abn}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Payslip</p>
            <p className="text-xs text-gray-500 mt-1">Status: <span className="font-semibold text-gray-700 capitalize">{rec.status}</span></p>
            <p className="text-xs text-gray-500">Issued: {fmtDate(rec.createdAt.split('T')[0])}</p>
          </div>
        </div>

        {/* Employee info */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Employee</p>
            <p className="font-semibold text-gray-900">{rec.employeeFirstName} {rec.employeeLastName}</p>
            <p className="text-sm text-gray-600">{rec.employeeEmail}</p>
            {rec.employeeEntityName && <p className="text-xs text-gray-500 mt-0.5">{rec.employeeEntityName}</p>}
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Pay Period</p>
            <p className="font-semibold text-gray-900">{fmtDate(rec.periodStart)}</p>
            <p className="text-sm text-gray-600">to {fmtDate(rec.periodEnd)}</p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{frequency}</p>
          </div>
        </div>

        {/* Earnings */}
        <table className="table-premium mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Earnings</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isHourly ? (
              <tr>
                <td className="px-3 py-2.5 text-gray-700">
                  Ordinary Hours
                  <span className="text-gray-400 text-xs ml-1">({Number(rec.hoursWorked).toFixed(1)} hrs @ {fmt(rec.hourlyRate)}/hr)</span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(Number(rec.hoursWorked) * Number(rec.hourlyRate))}</td>
              </tr>
            ) : (
              <tr>
                <td className="px-3 py-2.5 text-gray-700">Base Salary <span className="text-gray-400 text-xs ml-1 capitalize">({frequency} draw)</span></td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(rec.grossPay)}</td>
              </tr>
            )}
            {allowances > 0 && (
              <tr>
                <td className="px-3 py-2.5 text-gray-700">Allowances</td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">{fmt(allowances)}</td>
              </tr>
            )}
            <tr className="bg-gray-50">
              <td className="px-3 py-2.5 font-semibold text-gray-900">Gross Pay</td>
              <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900">{fmt(rec.grossPay)}</td>
            </tr>
          </tbody>
        </table>

        {/* Deductions */}
        <table className="table-premium mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Deductions</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wide">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr>
              <td className="px-3 py-2.5 text-gray-700">PAYG Withholding</td>
              <td className="px-3 py-2.5 text-right font-mono text-red-600">−{fmt(rec.paygWithholding)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2.5 text-gray-700">Medicare Levy (2%)</td>
              <td className="px-3 py-2.5 text-right font-mono text-red-600">−{fmt(rec.medicareLevy)}</td>
            </tr>
            {deductions > 0 && (
              <tr>
                <td className="px-3 py-2.5 text-gray-700">Pre-tax Deductions</td>
                <td className="px-3 py-2.5 text-right font-mono text-red-600">−{fmt(deductions)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Net pay */}
        <div className="border-t-2 border-gray-900 pt-4 flex justify-between items-center mb-6">
          <span className="text-lg font-bold text-gray-900">Net Pay</span>
          <span className="text-2xl font-bold text-green-700">{fmt(rec.netPay)}</span>
        </div>

        {/* Super */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-gray-700">Employer Superannuation (11.5%)</p>
              <p className="text-xs text-gray-400 mt-0.5">Paid directly to employee super fund</p>
            </div>
            <p className="text-base font-bold text-[#0E3D52]">{fmt(rec.superContribution)}</p>
          </div>
        </div>

        {/* Tax summary */}
        {(effTax !== null || annGross !== null) && (
          <div className="text-xs text-gray-400 flex gap-6 border-t border-gray-100 pt-3">
            {annGross !== null && <span>Annualised gross: <span className="text-gray-600 font-medium">{fmt(annGross)}</span></span>}
            {effTax  !== null && <span>Effective tax rate: <span className="text-gray-600 font-medium">{effTax}%</span></span>}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-gray-100 pt-4 text-xs text-gray-400 text-center">
          <p>This payslip was generated by {tenant?.name ?? 'Yahweh Care'} HRMS · Australian PAYG rates apply</p>
          <p className="mt-0.5">Payroll record ID: {rec.id}</p>
        </div>
      </div>
    </>
  )
}
