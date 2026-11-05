'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Employee = { id: string; firstName: string; lastName: string; jobTitle: string | null; email: string }

const STAGES = [
  { value: 'pre_start',     label: 'Pre-start',         desc: 'Before first day' },
  { value: 'day1',          label: 'Day 1',              desc: 'First day induction' },
  { value: 'week1',         label: 'Week 1',             desc: 'First week orientation' },
  { value: 'weeks2_4',      label: 'Weeks 2–4',          desc: 'Team integration' },
  { value: 'end_probation', label: 'End of Probation',   desc: 'Probation review' },
]

const INPUT = 'input-premium'

export default function NewOnboardingPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [form, setForm] = useState({ employeeId: '', stage: 'pre_start', buddyId: '', notes: '' })
  const [loading,  setLoading]  = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    fetchWithAuth('/api/tenant/employees?status=active&limit=200')
      .then(r => r.json())
      .then(d => { setEmployees(d.employees ?? []); setFetching(false) })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.employeeId) { setError('Please select an employee'); return }
    setLoading(true)
    setError('')
    try {
      const res  = await fetchWithAuth('/api/tenant/onboarding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          employeeId: form.employeeId,
          stage:      form.stage,
          buddyId:    form.buddyId || null,
          notes:      form.notes   || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create record')
      router.push(`/tenant/onboarding/${data.record.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div className="text-gray-600 dark:text-gray-400">Loading employees…</div>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Start Onboarding</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Create an onboarding record for a new employee</p>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm text-red-600 dark:text-red-300">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6 card-premium p-6">

        {/* Employee */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Employee *</label>
          <select required value={form.employeeId}
            onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
            className={INPUT}>
            <option value="">— Select employee —</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.firstName} {e.lastName} {e.jobTitle ? `— ${e.jobTitle}` : ''}
              </option>
            ))}
          </select>
          {employees.length === 0 && (
            <p className="text-xs text-amber-400 mt-1">No active employees found. Add employees first.</p>
          )}
        </div>

        {/* Stage */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Starting Stage *</label>
          <div className="space-y-2">
            {STAGES.map(s => (
              <label key={s.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                form.stage === s.value ? 'border-[#0E3D52] bg-[#0E3D52]/30' : 'border-gray-700 hover:border-gray-600'
              }`}>
                <input type="radio" name="stage" value={s.value} checked={form.stage === s.value}
                  onChange={() => setForm(f => ({ ...f, stage: s.value }))} />
                <div>
                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{s.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Buddy */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Buddy (optional)</label>
          <select value={form.buddyId}
            onChange={e => setForm(f => ({ ...f, buddyId: e.target.value }))}
            className={INPUT}>
            <option value="">— No buddy assigned —</option>
            {employees
              .filter(e => e.id !== form.employeeId)
              .map(e => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
          </select>
          <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">Assign an existing employee as their onboarding buddy.</p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Notes (optional)</label>
          <textarea value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3} placeholder="Any special requirements or notes for this onboarding…"
            className={INPUT} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition">
            {loading ? 'Creating…' : 'Create Onboarding Record →'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-white text-sm px-4 py-2.5 rounded-lg transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
