'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate, fmtCsvCurrency } from '@/lib/exportCsv'

interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  positionId?: string
}

interface SuperFund {
  id: string
  employeeId: string
  fundName: string
  fundAbn?: string
  usi?: string
  memberNumber?: string
  isSmsf: boolean
  smsfBankBsb?: string
  smsfBankAccount?: string
  smsfEsa?: string
  status: string
  isPrimary: boolean
  effectiveFrom?: string
  effectiveTo?: string
  source: string
  verifiedAt?: string
  verifiedBy?: string
  notes?: string
}

interface Contribution {
  id: string
  employeeId: string
  superFundId: string
  periodStart: string
  periodEnd: string
  dueDate: string
  paidDate?: string
  grossEarnings: string
  sgRate: string
  sgAmount: string
  voluntaryAmount: string
  totalContribution: string
  status: string
  paymentReference?: string
  notes?: string
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  stapled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  employer_default: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  exempt: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const EMPTY_FUND = {
  fundName: '', fundAbn: '', usi: '', memberNumber: '',
  isSmsf: false, smsfBankBsb: '', smsfBankAccount: '', smsfEsa: '',
  status: 'active', isPrimary: true, effectiveFrom: '', effectiveTo: '',
  source: 'employee', notes: '',
}

const EMPTY_CONTRIB = {
  superFundId: '', periodStart: '', periodEnd: '', dueDate: '',
  paidDate: '', grossEarnings: '', sgRate: '0.115', sgAmount: '',
  voluntaryAmount: '0', totalContribution: '', status: 'pending',
  paymentReference: '', notes: '',
}

export default function SuperannuationPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [funds, setFunds] = useState<SuperFund[]>([])
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [activeTab, setActiveTab] = useState<'funds' | 'contributions'>('funds')
  const [showFundModal, setShowFundModal] = useState(false)
  const [showContribModal, setShowContribModal] = useState(false)
  const [fundForm, setFundForm] = useState(EMPTY_FUND)
  const [contribForm, setContribForm] = useState(EMPTY_CONTRIB)
  const [editingFund, setEditingFund] = useState<SuperFund | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    fetchWithAuth('/api/tenant/employees?limit=200')
      .then(r => r.json())
      .then(d => setEmployees(d.employees ?? []))
      .catch(() => {})
  }, [])

  const loadFunds = useCallback(async (empId: string) => {
    const r = await fetchWithAuth(`/api/tenant/superannuation?employeeId=${empId}`)
    const d = await r.json()
    setFunds(d.funds ?? [])
  }, [])

  const loadContributions = useCallback(async (empId: string) => {
    const r = await fetchWithAuth(`/api/tenant/superannuation/contributions?employeeId=${empId}`)
    const d = await r.json()
    setContributions(d.contributions ?? [])
  }, [])

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp)
    loadFunds(emp.id)
    loadContributions(emp.id)
  }

  async function saveFund() {
    if (!selectedEmployee) return
    setSaving(true)
    try {
      const payload = { ...fundForm, employeeId: selectedEmployee.id }
      if (editingFund) {
        await fetchWithAuth(`/api/tenant/superannuation/${editingFund.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetchWithAuth('/api/tenant/superannuation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      setShowFundModal(false)
      setEditingFund(null)
      setFundForm(EMPTY_FUND)
      loadFunds(selectedEmployee.id)
    } finally {
      setSaving(false)
    }
  }

  async function saveContribution() {
    if (!selectedEmployee) return
    setSaving(true)
    try {
      // Auto-calculate SG amount if not set
      const gross = parseFloat(contribForm.grossEarnings) || 0
      const rate = parseFloat(contribForm.sgRate) || 0.115
      const sgAmt = contribForm.sgAmount || (gross * rate).toFixed(2)
      const voluntary = parseFloat(contribForm.voluntaryAmount) || 0
      const total = contribForm.totalContribution || (parseFloat(sgAmt) + voluntary).toFixed(2)

      await fetchWithAuth('/api/tenant/superannuation/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...contribForm,
          employeeId: selectedEmployee.id,
          sgAmount: sgAmt,
          totalContribution: total,
        }),
      })
      setShowContribModal(false)
      setContribForm(EMPTY_CONTRIB)
      loadContributions(selectedEmployee.id)
    } finally {
      setSaving(false)
    }
  }

  async function deleteFund(id: string) {
    try {
      const r = await fetchWithAuth(`/api/tenant/superannuation/${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setFunds(prev => prev.filter(f => f.id !== id))
      setToast({ message: 'Super fund deleted', type: 'success' })
    } catch {
      setToast({ message: 'Failed to delete fund', type: 'error' })
    }
  }

  async function deleteContribution(id: string) {
    try {
      const r = await fetchWithAuth(`/api/tenant/superannuation/contributions?id=${id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setContributions(prev => prev.filter(c => c.id !== id))
      setToast({ message: 'Contribution deleted', type: 'success' })
    } catch {
      setToast({ message: 'Failed to delete contribution', type: 'error' })
    }
  }

  async function markPaid(contrib: Contribution) {
    await fetchWithAuth(`/api/tenant/superannuation/contributions?id=${contrib.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paidDate: new Date().toISOString().split('T')[0] }),
    })
    if (selectedEmployee) loadContributions(selectedEmployee.id)
  }

  function openEditFund(fund: SuperFund) {
    setEditingFund(fund)
    setFundForm({
      fundName: fund.fundName, fundAbn: fund.fundAbn ?? '', usi: fund.usi ?? '',
      memberNumber: fund.memberNumber ?? '', isSmsf: fund.isSmsf,
      smsfBankBsb: fund.smsfBankBsb ?? '', smsfBankAccount: fund.smsfBankAccount ?? '',
      smsfEsa: fund.smsfEsa ?? '', status: fund.status, isPrimary: fund.isPrimary,
      effectiveFrom: fund.effectiveFrom ?? '', effectiveTo: fund.effectiveTo ?? '',
      source: fund.source, notes: fund.notes ?? '',
    })
    setShowFundModal(true)
  }

  const filteredEmployees = employees.filter(e =>
    `${e.firstName} ${e.lastName} ${e.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const totalContributed = contributions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + parseFloat(c.totalContribution || '0'), 0)

  const pending = contributions.filter(c => c.status === 'pending').length
  const overdue = contributions.filter(c => c.status === 'overdue').length

  function exportContributionsCsv() {
    const fundMap = new Map(funds.map(f => [f.id, f]))
    const empName = selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : ''
    exportCsv({
      filename: 'superannuation-contributions',
      columns: [
        { header: 'Employee Name',     key: 'employeeId',        format: () => empName },
        { header: 'Fund Name',         key: 'superFundId',       format: v => fundMap.get(v as string)?.fundName ?? '' },
        { header: 'Member Number',     key: 'superFundId',       format: v => fundMap.get(v as string)?.memberNumber ?? '' },
        { header: 'SG Rate',           key: 'sgRate',            format: v => `${(parseFloat(String(v ?? 0)) * 100).toFixed(1)}%` },
        { header: 'Total Contribution',key: 'totalContribution', format: fmtCsvCurrency },
        { header: 'Status',            key: 'status' },
        { header: 'Period Start',      key: 'periodStart',       format: fmtCsvDate },
        { header: 'Period End',        key: 'periodEnd',         format: fmtCsvDate },
      ],
      rows: contributions,
    })
  }

  return (
    <div className="flex h-full gap-4 p-6">
      {/* Employee list */}
      <div className="w-72 flex flex-col gap-3 shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Superannuation</h2>
        <input
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          placeholder="Search employees…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex-1 overflow-y-auto space-y-1">
          {filteredEmployees.map(emp => (
            <button
              key={emp.id}
              onClick={() => selectEmployee(emp)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
                selectedEmployee?.id === emp.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="font-medium">{emp.firstName} {emp.lastName}</div>
              <div className={`text-xs truncate ${selectedEmployee?.id === emp.id ? 'text-blue-100' : 'text-gray-400'}`}>
                {emp.email}
              </div>
            </button>
          ))}
          {filteredEmployees.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No employees found</p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {!selectedEmployee ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
            <div className="text-center">
              <div className="text-4xl mb-2">🏦</div>
              <p className="text-sm">Select an employee to view superannuation details</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </h3>
                <p className="text-sm text-gray-500">{selectedEmployee.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setActiveTab('funds'); setShowFundModal(true); setEditingFund(null); setFundForm(EMPTY_FUND) }}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                >
                  + Add Fund
                </button>
                <button
                  onClick={() => { setActiveTab('contributions'); setShowContribModal(true); setContribForm({ ...EMPTY_CONTRIB, superFundId: funds.find(f => f.isPrimary)?.id ?? '' }) }}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition"
                >
                  + Record Contribution
                </button>
                <ExportButton onClick={exportContributionsCsv} disabled={!selectedEmployee || contributions.length === 0} />
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Contributed (Paid)', value: `$${totalContributed.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`, color: 'text-green-600 dark:text-green-400' },
                { label: 'Pending Contributions', value: String(pending), color: 'text-yellow-600 dark:text-yellow-400' },
                { label: 'Overdue', value: String(overdue), color: overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
              {(['funds', 'contributions'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition border-b-2 -mb-px ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {tab === 'funds' ? 'Super Funds' : 'Contributions'}
                </button>
              ))}
            </div>

            {/* Funds tab */}
            {activeTab === 'funds' && (
              <div className="space-y-3 overflow-y-auto">
                {funds.length === 0 && (
                  <div className="text-center py-12 text-gray-400">No super funds recorded. Click + Add Fund to get started.</div>
                )}
                {funds.map(fund => (
                  <div key={fund.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{fund.fundName}</h4>
                          {fund.isPrimary && (
                            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">Primary</span>
                          )}
                          {fund.isSmsf && (
                            <span className="text-xs bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/30 dark:text-[#4ebac4] px-2 py-0.5 rounded-full font-medium">SMSF</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[fund.status] ?? ''}`}>
                            {fund.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm text-gray-500">
                          {fund.fundAbn && <span>ABN: {fund.fundAbn}</span>}
                          {fund.usi && <span>USI: {fund.usi}</span>}
                          {fund.memberNumber && <span>Member #: {fund.memberNumber}</span>}
                          {fund.effectiveFrom && <span>From: {fund.effectiveFrom}</span>}
                          {fund.source && <span className="capitalize">Source: {fund.source.replace(/_/g, ' ')}</span>}
                        </div>
                        {fund.isSmsf && (fund.smsfBankBsb || fund.smsfEsa) && (
                          <div className="mt-1 text-sm text-gray-500">
                            {fund.smsfBankBsb && <span>BSB: {fund.smsfBankBsb} · Acct: {fund.smsfBankAccount} · </span>}
                            {fund.smsfEsa && <span>ESA: {fund.smsfEsa}</span>}
                          </div>
                        )}
                        {fund.notes && <p className="mt-1 text-xs text-gray-400">{fund.notes}</p>}
                      </div>
                      <div className="flex gap-3 ml-4 shrink-0">
                        <button
                          onClick={() => openEditFund(fund)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirm({ message: `Delete "${fund.fundName}"?`, confirmLabel: 'Delete', onConfirm: () => deleteFund(fund.id) })}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete fund"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contributions tab */}
            {activeTab === 'contributions' && (
              <div className="overflow-x-auto">
                <div className="table-responsive">
            <table className="table-premium">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="pb-2 pr-4">Period</th>
                      <th className="pb-2 pr-4">Gross Earnings</th>
                      <th className="pb-2 pr-4">SG Rate</th>
                      <th className="pb-2 pr-4">SG Amount</th>
                      <th className="pb-2 pr-4">Voluntary</th>
                      <th className="pb-2 pr-4">Total</th>
                      <th className="pb-2 pr-4">Due Date</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {contributions.length === 0 && (
                      <tr><td colSpan={9} className="py-8 text-center text-gray-400">No contributions recorded</td></tr>
                    )}
                    {contributions.map(c => (
                      <tr key={c.id} className="group text-gray-700 dark:text-gray-300">
                        <td className="py-2.5 pr-4">{c.periodStart} → {c.periodEnd}</td>
                        <td className="py-2.5 pr-4">${parseFloat(c.grossEarnings).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 pr-4">{(parseFloat(c.sgRate) * 100).toFixed(1)}%</td>
                        <td className="py-2.5 pr-4">${parseFloat(c.sgAmount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 pr-4">${parseFloat(c.voluntaryAmount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 pr-4 font-medium">${parseFloat(c.totalContribution).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 pr-4">{c.dueDate}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[c.status] ?? ''}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-3">
                            {c.status === 'pending' && (
                              <button onClick={() => markPaid(c)} className="text-xs text-green-600 hover:underline">Mark Paid</button>
                            )}
                            <button
                              onClick={() => setConfirm({ message: 'Delete this contribution record?', confirmLabel: 'Delete', onConfirm: () => deleteContribution(c.id) })}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                              title="Delete contribution"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {/* Fund Modal */}
      {showFundModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingFund ? 'Edit Super Fund' : 'Add Super Fund'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fund Name *</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  value={fundForm.fundName} onChange={e => setFundForm(f => ({ ...f, fundName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fund ABN</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={fundForm.fundAbn} onChange={e => setFundForm(f => ({ ...f, fundAbn: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">USI</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={fundForm.usi} onChange={e => setFundForm(f => ({ ...f, usi: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Member Number</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  value={fundForm.memberNumber} onChange={e => setFundForm(f => ({ ...f, memberNumber: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={fundForm.status} onChange={e => setFundForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="active">Active</option>
                    <option value="stapled">Stapled</option>
                    <option value="employer_default">Employer Default</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Source</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={fundForm.source} onChange={e => setFundForm(f => ({ ...f, source: e.target.value }))}>
                    <option value="employee">Employee</option>
                    <option value="ato_stapled">ATO Stapled</option>
                    <option value="employer_default">Employer Default</option>
                    <option value="ess_onboarding">ESS Onboarding</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={fundForm.isPrimary} onChange={e => setFundForm(f => ({ ...f, isPrimary: e.target.checked }))} />
                  Primary Fund
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={fundForm.isSmsf} onChange={e => setFundForm(f => ({ ...f, isSmsf: e.target.checked }))} />
                  SMSF
                </label>
              </div>
              {fundForm.isSmsf && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">BSB</label>
                    <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      value={fundForm.smsfBankBsb} onChange={e => setFundForm(f => ({ ...f, smsfBankBsb: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Account Number</label>
                    <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      value={fundForm.smsfBankAccount} onChange={e => setFundForm(f => ({ ...f, smsfBankAccount: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Electronic Service Address (ESA)</label>
                    <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      value={fundForm.smsfEsa} onChange={e => setFundForm(f => ({ ...f, smsfEsa: e.target.value }))} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" rows={2}
                  value={fundForm.notes} onChange={e => setFundForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowFundModal(false); setEditingFund(null) }}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
              <button onClick={saveFund} disabled={saving || !fundForm.fundName}
                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? 'Saving…' : editingFund ? 'Update Fund' : 'Add Fund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      {showContribModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Record Contribution</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Super Fund *</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  value={contribForm.superFundId} onChange={e => setContribForm(f => ({ ...f, superFundId: e.target.value }))}>
                  <option value="">Select fund…</option>
                  {funds.map(f => (
                    <option key={f.id} value={f.id}>{f.fundName}{f.isPrimary ? ' (Primary)' : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Period Start *</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={contribForm.periodStart} onChange={e => setContribForm(f => ({ ...f, periodStart: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Period End *</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={contribForm.periodEnd} onChange={e => setContribForm(f => ({ ...f, periodEnd: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Due Date *</label>
                  <input type="date" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={contribForm.dueDate} onChange={e => setContribForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">SG Rate</label>
                  <input type="number" step="0.001" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={contribForm.sgRate} onChange={e => setContribForm(f => ({ ...f, sgRate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gross Earnings ($)</label>
                  <input type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={contribForm.grossEarnings} onChange={e => setContribForm(f => ({ ...f, grossEarnings: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Voluntary ($)</label>
                  <input type="number" step="0.01" className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                    value={contribForm.voluntaryAmount} onChange={e => setContribForm(f => ({ ...f, voluntaryAmount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Status</label>
                <select className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  value={contribForm.status} onChange={e => setContribForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="exempt">Exempt</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Reference</label>
                <input className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  value={contribForm.paymentReference} onChange={e => setContribForm(f => ({ ...f, paymentReference: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowContribModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
              <button onClick={saveContribution} disabled={saving || !contribForm.superFundId || !contribForm.periodStart || !contribForm.dueDate}
                className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">
                {saving ? 'Saving…' : 'Record Contribution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
