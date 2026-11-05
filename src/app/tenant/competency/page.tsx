'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useState, useEffect, useCallback } from 'react'

type Competency = { id: string; name: string; description: string | null; category: string | null; isActive: boolean }
type Assessment = {
  id: string; competencyId: string; outcome: string | null
  assessedAt: string | null; expiryDate: string | null
  evidence: string | null; notes: string | null; createdAt: string
  competencyName: string | null; competencyCategory: string | null
}
type Employee = { id: string; firstName: string; lastName: string }

const OUTCOME_COLORS: Record<string, string> = {
  competent:          'bg-green-100 text-green-700',
  not_yet_competent:  'bg-red-100 text-red-700',
}

export default function CompetencyPage() {
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [employees, setEmployees]       = useState<Employee[]>([])
  const [selectedEmp, setSelectedEmp]   = useState('')
  const [assessments, setAssessments]   = useState<Assessment[]>([])
  const [tab, setTab]                   = useState<'matrix' | 'library'>('matrix')
  const [loading, setLoading]           = useState(false)
  const [showAddComp, setShowAddComp]   = useState(false)
  const [showAssess, setShowAssess]     = useState(false)
  const [saving, setSaving]             = useState(false)
  const [compForm, setCompForm]         = useState({ name:'', description:'', category:'' })
  const [assessForm, setAssessForm]     = useState({ competencyId:'', outcome:'competent', assessedAt:'', expiryDate:'', evidence:'', notes:'' })

  const loadLibrary = useCallback(async () => {
    const res = await fetchWithAuth('/api/tenant/competency?view=library')
    if (res.ok) { const d = await res.json(); setCompetencies(d.competencies ?? []) }
  }, [])

  const loadAssessments = useCallback(async (empId: string) => {
    if (!empId) return
    setLoading(true)
    const res = await fetchWithAuth(`/api/tenant/competency?employeeId=${empId}`)
    if (res.ok) { const d = await res.json(); setAssessments(d.assessments ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLibrary()
    fetchWithAuth('/api/tenant/employees?limit=200').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [loadLibrary])

  useEffect(() => { if (selectedEmp) loadAssessments(selectedEmp) }, [selectedEmp, loadAssessments])

  async function addCompetency() {
    setSaving(true)
    await fetchWithAuth('/api/tenant/competency', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({_type:'competency',...compForm}) })
    setShowAddComp(false); setSaving(false); loadLibrary()
  }

  async function addAssessment() {
    setSaving(true)
    await fetchWithAuth('/api/tenant/competency', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({employeeId:selectedEmp,...assessForm}) })
    setShowAssess(false); setSaving(false); loadAssessments(selectedEmp)
  }

  const categories = [...new Set(competencies.map(c => c.category).filter(Boolean))]

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between dark:bg-gray-900 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Competency & Skills</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Skill matrix and competency assessments per employee</p>
        </div>
        <div className="flex gap-2">
          {tab === 'library' && (
            <button onClick={() => setShowAddComp(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">+ Add Competency</button>
          )}
          {tab === 'matrix' && selectedEmp && (
            <button onClick={() => setShowAssess(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">+ Record Assessment</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6 dark:bg-gray-900 dark:border-gray-700">
        {(['matrix','library'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition capitalize ${tab===t ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'matrix' ? 'Skill Matrix' : 'Competency Library'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'matrix' && (
          <div className="space-y-4">
            <div className="max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Select Employee</label>
              <select className="input-premium" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
                <option value="">Choose employee…</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
            </div>

            {selectedEmp && (
              loading ? <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p> :
              assessments.length === 0 ? (
                <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
                  <p className="text-sm">No assessments recorded for this employee</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assessments.map(a => (
                    <div key={a.id} className="border border-gray-200 rounded-xl p-4 space-y-2 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{a.competencyName}</p>
                          {a.competencyCategory && <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{a.competencyCategory}</p>}
                        </div>
                        {a.outcome && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${OUTCOME_COLORS[a.outcome] ?? 'bg-gray-100 text-gray-500'}`}>
                            {a.outcome.replace(/_/g,' ')}
                          </span>
                        )}
                      </div>
                      {a.assessedAt && <p className="text-xs text-gray-500 dark:text-gray-400">Assessed: {new Date(a.assessedAt).toLocaleDateString()}</p>}
                      {a.expiryDate && <p className="text-xs text-orange-600">Expires: {new Date(a.expiryDate).toLocaleDateString()}</p>}
                      {a.evidence && <p className="text-xs text-gray-500 truncate dark:text-gray-400">{a.evidence}</p>}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        {tab === 'library' && (
          <div className="space-y-6">
            {categories.length === 0 && competencies.length === 0 ? (
              <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-600 dark:text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
                <p className="text-sm">No competencies defined yet. Add some to get started.</p>
              </div>
            ) : (
              (categories.length > 0 ? categories : [null]).map(cat => (
                <div key={cat ?? 'uncategorised'}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-3">{cat ?? 'Uncategorised'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {competencies.filter(c => c.category === cat).map(c => (
                      <div key={c.id} className="border border-gray-200 rounded-lg p-4 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                        {c.description && <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{c.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add competency modal */}
      {showAddComp && (
        <div className="modal-overlay">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-white">Add Competency</h3>
            <div className="space-y-3">
              <input className="input-premium" placeholder="Name *" value={compForm.name} onChange={e => setCompForm(f => ({...f, name:e.target.value}))} />
              <input className="input-premium" placeholder="Category (e.g. Clinical, Safety)" value={compForm.category} onChange={e => setCompForm(f => ({...f, category:e.target.value}))} />
              <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none dark:border-gray-700" rows={2} placeholder="Description" value={compForm.description} onChange={e => setCompForm(f => ({...f, description:e.target.value}))} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddComp(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 dark:text-gray-400 dark:border-gray-700">Cancel</button>
              <button onClick={addCompetency} disabled={saving || !compForm.name} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Adding…' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Record assessment modal */}
      {showAssess && (
        <div className="modal-overlay">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-white">Record Assessment</h3>
            <div className="space-y-3">
              <select className="input-premium" value={assessForm.competencyId} onChange={e => setAssessForm(f => ({...f, competencyId:e.target.value}))}>
                <option value="">Select competency *</option>
                {competencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="input-premium" value={assessForm.outcome} onChange={e => setAssessForm(f => ({...f, outcome:e.target.value}))}>
                <option value="competent">Competent</option>
                <option value="not_yet_competent">Not Yet Competent</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 mb-1 block dark:text-gray-400">Assessed Date</label>
                  <input type="date" className="input-premium" value={assessForm.assessedAt} onChange={e => setAssessForm(f => ({...f, assessedAt:e.target.value}))} /></div>
                <div><label className="text-xs text-gray-500 mb-1 block dark:text-gray-400">Expiry Date</label>
                  <input type="date" className="input-premium" value={assessForm.expiryDate} onChange={e => setAssessForm(f => ({...f, expiryDate:e.target.value}))} /></div>
              </div>
              <input className="input-premium" placeholder="Evidence reference" value={assessForm.evidence} onChange={e => setAssessForm(f => ({...f, evidence:e.target.value}))} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAssess(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 dark:text-gray-400 dark:border-gray-700">Cancel</button>
              <button onClick={addAssessment} disabled={saving || !assessForm.competencyId} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving…' : 'Record'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
