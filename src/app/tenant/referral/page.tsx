'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useState, useEffect, useCallback } from 'react'
import { ExportButton } from '@/components/ui/ExportButton'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

type Referral = {
  id:string; referrerId:string; referredName:string; referredEmail:string|null
  status:string; bonusAmount:string|null; bonusPaidAt:string|null; notes:string|null; createdAt:string
  referrerFirstName:string|null; referrerLastName:string|null
}
type Stats = { total:number; pending:number; hired:number; paid:number }
type Employee = { id:string; firstName:string; lastName:string }

const STATUS_COLORS: Record<string,string> = {
  pending:'bg-blue-100 text-blue-700', interviewed:'bg-yellow-100 text-yellow-700',
  hired:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-700',
}

export default function ReferralPage() {
  const [referrals, setReferrals]     = useState<Referral[]>([])
  const [stats, setStats]             = useState<Stats>({ total:0,pending:0,hired:0,paid:0 })
  const [employees, setEmployees]     = useState<Employee[]>([])
  const [loading, setLoading]         = useState(true)
  const [showCreate, setShowCreate]   = useState(false)
  const [saving, setSaving]           = useState(false)
  const [form, setForm]               = useState({ referrerId:'', referredName:'', referredEmail:'', notes:'' })
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchWithAuth('/api/tenant/referral')
    if (res.ok) { const d = await res.json(); setReferrals(d.referrals??[]); setStats(d.stats??{}) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetchWithAuth('/api/tenant/employees?limit=200').then(r=>r.json()).then(d=>setEmployees(d.employees??[]))
  }, [])

  async function create() {
    setSaving(true)
    await fetchWithAuth('/api/tenant/referral', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    setShowCreate(false); setSaving(false); load()
  }

  async function patch(id:string, updates:Record<string,unknown>) {
    await fetchWithAuth('/api/tenant/referral', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id,...updates}) })
    load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetchWithAuth('/api/tenant/referral', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteTarget }),
    })
    setDeleting(false)
    setDeleteTarget(null)
    load()
  }

  function exportData() {
    exportCsv({
      filename: 'referrals',
      columns: [
        { header: 'Referred By', key: 'referrerFirstName', format: (_v, r) => `${r.referrerFirstName ?? ''} ${r.referrerLastName ?? ''}`.trim() },
        { header: 'Candidate Name', key: 'referredName' },
        { header: 'Candidate Email', key: 'referredEmail', format: v => v ?? '' },
        { header: 'Status', key: 'status', format: v => (v as string).charAt(0).toUpperCase() + (v as string).slice(1) },
        { header: 'Bonus Amount', key: 'bonusAmount', format: v => v ?? '' },
        { header: 'Bonus Paid Date', key: 'bonusPaidAt', format: v => fmtCsvDate(v as string | null) },
        { header: 'Notes', key: 'notes', format: v => v ?? '' },
        { header: 'Submitted', key: 'createdAt', format: v => fmtCsvDate(v as string) },
      ],
      rows: referrals,
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between dark:bg-gray-900 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Referral Program</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Track employee referrals and bonus payments</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportData} disabled={referrals.length === 0} />
          <button onClick={()=>setShowCreate(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">+ Add Referral</button>
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex gap-6 dark:bg-gray-800 dark:border-gray-800">
        {[{label:'Total',value:stats.total,cls:'text-gray-900 dark:text-white'},{label:'Pending',value:stats.pending,cls:'text-blue-600'},{label:'Hired',value:stats.hired,cls:'text-green-600'},{label:'Bonus Paid',value:stats.paid,cls:'text-[#0E3D52]'}].map(s=>(
          <div key={s.label} className="text-center"><p className={`text-xl font-bold ${s.cls}`}>{s.value}</p><p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p></div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p> : referrals.length===0 ? (
          <div className="text-center py-16 text-gray-600 dark:text-gray-400">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
              </svg>
            </div>
            <p className="font-medium text-gray-600 dark:text-gray-400">No referrals yet</p>
            <p className="text-sm mt-1">Add a referral when an employee refers a candidate.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden dark:bg-gray-900 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:bg-gray-800 dark:border-gray-800">
                    {['Referred By','Candidate','Status','Bonus','Submitted','Notes',''].map(h=>(
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referrals.map(r=>(
                    <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.referrerFirstName} {r.referrerLastName}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900 dark:text-white">{r.referredName}</p>
                        {r.referredEmail && <p className="text-xs text-gray-600 dark:text-gray-400">{r.referredEmail}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <select className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${STATUS_COLORS[r.status]??''}`}
                          value={r.status} onChange={e=>patch(r.id,{status:e.target.value})}>
                          <option value="pending">Pending</option>
                          <option value="interviewed">Interviewed</option>
                          <option value="hired">Hired</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {r.bonusPaidAt ? (
                          <span className="text-xs text-green-600 font-medium">Paid {r.bonusAmount ? `$${r.bonusAmount}` : ''}</span>
                        ) : r.status==='hired' ? (
                          <button onClick={()=>patch(r.id,{bonusPaidAt:new Date().toISOString()})}
                            className="text-xs px-2 py-1 bg-[#E0EEF4] text-[#0E3D52] rounded font-medium hover:bg-[#9ccfda]">Mark Paid</button>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs max-w-[200px] truncate">{r.notes ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setDeleteTarget(r.id)}
                          className="text-xs text-red-400 hover:text-red-500 transition">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-white">Add Referral</h3>
            <div className="space-y-3">
              <select className="input-premium" value={form.referrerId} onChange={e=>setForm(f=>({...f,referrerId:e.target.value}))}>
                <option value="">Referred by (employee) *</option>
                {employees.map(e=><option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
              <input className="input-premium" placeholder="Candidate name *" value={form.referredName} onChange={e=>setForm(f=>({...f,referredName:e.target.value}))}/>
              <input type="email" className="input-premium" placeholder="Candidate email" value={form.referredEmail} onChange={e=>setForm(f=>({...f,referredEmail:e.target.value}))}/>
              <textarea className="input-premium resize-none" rows={2} placeholder="Notes" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 dark:text-gray-400 dark:border-gray-700">Cancel</button>
              <button onClick={create} disabled={saving||!form.referrerId||!form.referredName} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving?'Adding…':'Add'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        state={deleteTarget ? {
          message: 'This referral record will be permanently removed.',
          confirmLabel: 'Delete',
          onConfirm: handleDelete,
        } : null}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
