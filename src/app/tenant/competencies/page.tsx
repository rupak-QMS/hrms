'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

type Competency = { id: string; name: string; description: string | null; category: string | null; isActive: boolean }
type Assessment = {
  id: string; employeeId: string; competencyId: string; assessorId: string | null
  outcome: string | null; assessedAt: string | null; expiryDate: string | null
  evidence: string | null; notes: string | null; createdAt: string
  assessorFirstName: string | null; assessorLastName: string | null
}
type Stats = { total: number; competent: number; notYet: number; expiringSoon: number; expired: number }
type Employee = { id: string; firstName: string; lastName: string }

const INPUT = 'input-premium'

const OUTCOME_STYLE: Record<string, string> = {
  competent:          'badge badge-green',
  not_yet_competent:  'badge badge-red',
}

export default function CompetencyPage() {
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [assessments,  setAssessments]  = useState<Assessment[]>([])
  const [stats,        setStats]        = useState<Stats>({ total:0, competent:0, notYet:0, expiringSoon:0, expired:0 })
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [loading,      setLoading]      = useState(true)
  const [tab, setTab]                   = useState<'library' | 'assessments'>('library')
  const [showCompForm, setShowCompForm] = useState(false)
  const [showAssForm,  setShowAssForm]  = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [filterEmp,    setFilterEmp]    = useState('')
  const [confirm, setConfirm] = useState<ConfirmState>(null)
  const [toast,   setToast]   = useState<ToastState>(null)
  const [searchComp, setSearchComp] = useState('')
  const [compForm, setCompForm] = useState({ name: '', description: '', category: '' })
  const [assForm, setAssForm]   = useState({
    employeeId: '', competencyId: '', assessorId: '',
    outcome: 'competent', assessedAt: '', expiryDate: '', evidence: '', notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ assessments: '1' })
    if (filterEmp) p.set('employeeId', filterEmp)
    const res  = await fetchWithAuth(`/api/tenant/competencies?${p}`)
    const data = await res.json()
    setCompetencies(data.competencies ?? [])
    setAssessments(data.assessments  ?? [])
    setStats(data.stats ?? { total:0, competent:0, notYet:0, expiringSoon:0, expired:0 })
    setLoading(false)
  }, [filterEmp])

  useEffect(() => {
    load()
    fetchWithAuth('/api/tenant/employees?status=active&limit=500').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function createComp(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/competencies', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(compForm) })
    setShowCompForm(false); setCompForm({ name:'', description:'', category:'' }); setSaving(false); load()
  }

  async function deleteCompetency(id: string) {
    try {
      const r = await fetchWithAuth(`/api/tenant/competencies/${id}?type=competency`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setCompetencies(prev => prev.filter(c => c.id !== id))
      setToast({ message: 'Competency deleted', type: 'success' })
    } catch {
      setToast({ message: 'Failed to delete competency', type: 'error' })
    }
  }

  async function deleteAssessment(id: string) {
    try {
      const r = await fetchWithAuth(`/api/tenant/competencies/${id}?type=assessment`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
      setAssessments(prev => prev.filter(a => a.id !== id))
      setToast({ message: 'Assessment deleted', type: 'success' })
    } catch {
      setToast({ message: 'Failed to delete assessment', type: 'error' })
    }
  }

  async function createAss(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetchWithAuth('/api/tenant/competencies', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(assForm) })
    setShowAssForm(false)
    setAssForm({ employeeId:'', competencyId:'', assessorId:'', outcome:'competent', assessedAt:'', expiryDate:'', evidence:'', notes:'' })
    setSaving(false); load()
  }

  const filteredComps = searchComp
    ? competencies.filter(c => c.name.toLowerCase().includes(searchComp.toLowerCase()) || (c.category ?? '').toLowerCase().includes(searchComp.toLowerCase()))
    : competencies

  const grouped = filteredComps.reduce<Record<string, Competency[]>>((acc, c) => {
    const cat = c.category ?? 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(c)
    return acc
  }, {})

  const today = new Date().toISOString().split('T')[0]
  const in30  = new Date(Date.now() + 30*864e5).toISOString().split('T')[0]

  const expColor = (exp: string | null) => {
    if (!exp) return ''
    if (exp < today)   return 'text-red-400'
    if (exp <= in30)   return 'text-amber-400'
    return 'text-gray-400'
  }

  function exportCompetencies() {
    exportCsv({
      filename: 'competencies',
      columns: [
        { header: 'Name', key: 'name' },
        { header: 'Category', key: 'category', format: v => v ?? '' },
        { header: 'Description', key: 'description', format: v => v ?? '' },
        { header: 'Active', key: 'isActive', format: v => v ? 'Yes' : 'No' },
      ],
      rows: competencies,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Competency Management</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Define competency frameworks and track employee assessments</p>
        </div>
        <div className="flex gap-2">
          <ExportButton onClick={exportCompetencies} disabled={competencies.length === 0} />
          {tab === 'library' && (
            <button onClick={() => setShowCompForm(v => !v)}
              className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
              {showCompForm ? 'Cancel' : '+ Add Competency'}
            </button>
          )}
          {tab === 'assessments' && (
            <button onClick={() => setShowAssForm(v => !v)}
              className="bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm px-4 py-2.5 rounded-lg transition">
              {showAssForm ? 'Cancel' : '+ Record Assessment'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Assessments', value: stats.total,       color: 'text-foreground' },
          { label: 'Competent',         value: stats.competent,   color: 'text-green-400' },
          { label: 'Not Yet Competent', value: stats.notYet,      color: 'text-red-400' },
          { label: 'Expiring Soon',     value: stats.expiringSoon,color: 'text-amber-400' },
          { label: 'Expired',           value: stats.expired,     color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="card-premium p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {(['library', 'assessments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === t ? 'border-[#0E3D52] text-[#1A6080] dark:text-[#4ebac4]' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
            {t === 'library' ? `Framework (${competencies.length})` : `Assessments (${assessments.length})`}
          </button>
        ))}
      </div>

      {/* Add competency form */}
      {tab === 'library' && showCompForm && (
        <form onSubmit={createComp} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#4ebac4]">Add Competency to Framework</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Name *</label>
              <input required value={compForm.name} onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Manual Handling, Medication Administration" className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Category</label>
              <input value={compForm.category} onChange={e => setCompForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Clinical, Safety, Leadership" className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Description</label>
            <textarea value={compForm.description} onChange={e => setCompForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="What this competency covers…" className={INPUT} />
          </div>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg">
            {saving ? 'Saving…' : 'Add Competency'}
          </button>
        </form>
      )}

      {/* Record assessment form */}
      {tab === 'assessments' && showAssForm && (
        <form onSubmit={createAss} className="card-premium border-[#0E3D52]/30 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#4ebac4]">Record Competency Assessment</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Employee *</label>
              <select required value={assForm.employeeId} onChange={e => setAssForm(f => ({ ...f, employeeId: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Competency *</label>
              <select required value={assForm.competencyId} onChange={e => setAssForm(f => ({ ...f, competencyId: e.target.value }))} className={INPUT}>
                <option value="">— Select —</option>
                {competencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Assessor</label>
              <select value={assForm.assessorId} onChange={e => setAssForm(f => ({ ...f, assessorId: e.target.value }))} className={INPUT}>
                <option value="">— Self / Not specified —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Outcome *</label>
              <select required value={assForm.outcome} onChange={e => setAssForm(f => ({ ...f, outcome: e.target.value }))} className={INPUT}>
                <option value="competent">Competent</option>
                <option value="not_yet_competent">Not Yet Competent</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Assessed Date</label>
              <input type="date" value={assForm.assessedAt} onChange={e => setAssForm(f => ({ ...f, assessedAt: e.target.value }))} className={INPUT} />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Expiry Date</label>
              <input type="date" value={assForm.expiryDate} onChange={e => setAssForm(f => ({ ...f, expiryDate: e.target.value }))} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Evidence</label>
            <input value={assForm.evidence} onChange={e => setAssForm(f => ({ ...f, evidence: e.target.value }))}
              placeholder="e.g. Certificate number, observation reference…" className={INPUT} />
          </div>
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">Notes</label>
            <textarea value={assForm.notes} onChange={e => setAssForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Additional notes…" className={INPUT} />
          </div>
          <button type="submit" disabled={saving}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm px-5 py-2 rounded-lg">
            {saving ? 'Saving…' : 'Record Assessment'}
          </button>
        </form>
      )}

      {tab === 'library' && !loading && (
        <input
          className="input-premium max-w-xs"
          placeholder="Search competencies…"
          value={searchComp}
          onChange={e => setSearchComp(e.target.value)}
        />
      )}

      {loading ? <div className="text-gray-600 dark:text-gray-400 text-sm">Loading…</div> : (
        <>
          {tab === 'library' && (
            Object.keys(grouped).length === 0 ? (
              <div className="card-premium py-14 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">No competencies defined</p>
                <p className="text-gray-500 text-sm mt-1 dark:text-gray-400">Add your competency framework to begin assessments.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([cat, comps]) => (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1 dark:text-gray-400">{cat}</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {comps.map(c => {
                        const compAss = assessments.filter(a => a.competencyId === c.id)
                        const pass    = compAss.filter(a => a.outcome === 'competent').length
                        return (
                          <div key={c.id} className="group card-premium p-4">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">{c.name}</p>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{pass}/{compAss.length} competent</span>
                                <button
                                  onClick={() => setConfirm({ message: `Delete competency "${c.name}"?`, confirmLabel: 'Delete', onConfirm: () => deleteCompetency(c.id) })}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                            {c.description && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{c.description}</p>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'assessments' && (
            <>
              {/* Filter */}
              <select value={filterEmp} onChange={e => { setFilterEmp(e.target.value); }}
                onBlur={() => load()}
                className="input-premium focus:outline-none focus:border-[#0E3D52]">
                <option value="">All employees</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>

              {assessments.length === 0 ? (
                <div className="card-premium py-14 text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
                  <p className="text-gray-600 dark:text-gray-300 font-medium">No assessments recorded</p>
                </div>
              ) : (
                <div className="card-premium overflow-hidden">
                  <div className="table-responsive">
            <table className="table-premium">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 section-label">Employee</th>
                        <th className="px-4 py-3 section-label">Competency</th>
                        <th className="px-4 py-3 section-label">Outcome</th>
                        <th className="px-4 py-3 section-label">Assessed</th>
                        <th className="px-4 py-3 section-label">Expiry</th>
                        <th className="px-4 py-3 section-label">Assessor</th>
                        <th className="px-4 py-3 section-label"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {assessments.map(a => {
                        const comp = competencies.find(c => c.id === a.competencyId)
                        const emp  = employees.find(e => e.id === a.employeeId)
                        return (
                          <tr key={a.id} className="group hover:bg-gray-100 dark:hover:bg-gray-800/40">
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{comp?.name ?? '—'}</td>
                            <td className="px-4 py-3">
                              {a.outcome ? (
                                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${OUTCOME_STYLE[a.outcome] ?? 'badge badge-gray'}`}>
                                  {a.outcome === 'competent' ? 'Competent' : 'Not Yet'}
                                </span>
                              ) : <span className="text-gray-600 dark:text-gray-400">Pending</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                              {a.assessedAt ? new Date(a.assessedAt).toLocaleDateString('en-AU') : '—'}
                            </td>
                            <td className={`px-4 py-3 text-xs font-medium ${expColor(a.expiryDate)}`}>
                              {a.expiryDate ? new Date(a.expiryDate + 'T00:00:00').toLocaleDateString('en-AU') : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs dark:text-gray-400">
                              {a.assessorFirstName ? `${a.assessorFirstName} ${a.assessorLastName}` : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setConfirm({ message: 'Delete this assessment?', confirmLabel: 'Delete', onConfirm: () => deleteAssessment(a.id) })}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
            </>
          )}
        </>
      )}
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
