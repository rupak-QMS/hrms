'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { SkeletonPage } from '@/components/ui/Skeleton'

type Dept = { id: string; name: string }
type Pos  = { id: string; title: string; departmentId: string | null }

const EMPLOYMENT_TYPES = [
  { value: 'full_time',  label: 'Full-time' },
  { value: 'part_time',  label: 'Part-time' },
  { value: 'casual',     label: 'Casual' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'volunteer',  label: 'Volunteer' },
]

const SECTION = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white dark:bg-[#0F1E2E] border border-gray-100 dark:border-[#1A6080]/30 rounded-xl p-6 space-y-4">
    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 ">{title}</h2>
    {children}
  </div>
)

const FIELD = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
)

const INPUT_CLS  = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#0E3D52] transition'
const SELECT_CLS = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-[#0E3D52] transition'

type FormState = {
  firstName: string; lastName: string; preferredName: string
  dateOfBirth: string; gender: string; phone: string; email: string; address: string
  entityName: string; departmentId: string; positionId: string
  employmentType: string; awardClassification: string; payLevel: string
  startDate: string; probationEndDate: string; endDate: string
  ndisWorker: boolean; annualSalary: string; ordinaryHoursPerWeek: string
}

const BLANK: FormState = {
  firstName: '', lastName: '', preferredName: '',
  dateOfBirth: '', gender: '', phone: '', email: '', address: '',
  entityName: '', departmentId: '', positionId: '',
  employmentType: 'full_time', awardClassification: '', payLevel: '',
  startDate: '', probationEndDate: '', endDate: '',
  ndisWorker: false, annualSalary: '', ordinaryHoursPerWeek: '38',
}

export default function EditEmployeePage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [form,        setForm]        = useState<FormState>(BLANK)
  const [departments, setDepartments] = useState<Dept[]>([])
  const [positions,   setPositions]   = useState<Pos[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [tenantName,  setTenantName]  = useState<string>('')

  useEffect(() => {
    Promise.all([
      fetchWithAuth(`/api/tenant/employees/${id}`).then(r => r.json()),
      fetchWithAuth('/api/tenant/departments').then(r => r.json()),
      fetchWithAuth('/api/tenant/positions').then(r => r.json()),
      fetchWithAuth('/api/tenant/config').then(r => r.json()),
    ]).then(([empData, deptData, posData, cfg]) => {
      const e = empData.employee
      if (e) {
        setForm({
          firstName:           e.firstName           ?? '',
          lastName:            e.lastName            ?? '',
          preferredName:       e.preferredName       ?? '',
          dateOfBirth:         e.dateOfBirth         ?? '',
          gender:              e.gender              ?? '',
          phone:               e.phone               ?? '',
          email:               e.email               ?? '',
          address:             e.address             ?? '',
          entityName:          e.entityName          ?? '',
          departmentId:        e.departmentId        ?? '',
          positionId:          e.positionId          ?? '',
          employmentType:      e.employmentType      ?? 'full_time',
          awardClassification: e.awardClassification ?? '',
          payLevel:            e.payLevel            ?? '',
          startDate:           e.startDate           ?? '',
          probationEndDate:    e.probationEndDate    ?? '',
          endDate:             e.endDate             ?? '',
          ndisWorker:          e.ndisWorker          ?? false,
          annualSalary:        e.annualSalary        ?? '',
          ordinaryHoursPerWeek: e.ordinaryHoursPerWeek ?? '38',
        })
      }
      setDepartments(deptData.departments ?? [])
      setPositions(posData.positions ?? [])
      setTenantName(cfg?.tenant?.name ?? '')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const set = (key: keyof FormState, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }))

  const filteredPositions = form.departmentId
    ? positions.filter(p => !p.departmentId || p.departmentId === form.departmentId)
    : positions

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        departmentId:        form.departmentId        || null,
        positionId:          form.positionId          || null,
        dateOfBirth:         form.dateOfBirth         || null,
        probationEndDate:    form.probationEndDate    || null,
        endDate:             form.endDate             || null,
        preferredName:       form.preferredName       || null,
        gender:              form.gender              || null,
        phone:               form.phone               || null,
        address:             form.address             || null,
        entityName:          form.entityName          || null,
        awardClassification: form.awardClassification || null,
        payLevel:            form.payLevel            || null,
        annualSalary:        form.annualSalary        || null,
        ordinaryHoursPerWeek: form.ordinaryHoursPerWeek || null,
      }
      const res  = await fetchWithAuth(`/api/tenant/employees/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to save changes'); return }
      router.push(`/tenant/employee-management/${id}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SkeletonPage rows={4} />

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/tenant/employee-management/${id}`}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-700 dark:text-gray-200 transition"
        >
          ← Back to Profile
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Employee</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Update employee details below</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Personal Details */}
      <SECTION title="Personal Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FIELD label="First Name" required>
            <input required value={form.firstName} onChange={e => set('firstName', e.target.value)}
              className={INPUT_CLS} placeholder="Jane" />
          </FIELD>
          <FIELD label="Last Name" required>
            <input required value={form.lastName} onChange={e => set('lastName', e.target.value)}
              className={INPUT_CLS} placeholder="Smith" />
          </FIELD>
          <FIELD label="Preferred Name">
            <input value={form.preferredName} onChange={e => set('preferredName', e.target.value)}
              className={INPUT_CLS} placeholder="e.g. Jay" />
          </FIELD>
          <FIELD label="Date of Birth">
            <input type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)}
              className={INPUT_CLS} />
          </FIELD>
          <FIELD label="Gender">
            <select value={form.gender} onChange={e => set('gender', e.target.value)} className={SELECT_CLS}>
              <option value="">Prefer not to say</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Other">Other</option>
            </select>
          </FIELD>
          <FIELD label="Phone">
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              className={INPUT_CLS} placeholder="+61 4xx xxx xxx" />
          </FIELD>
        </div>
        <FIELD label="Email" required>
          <input required type="email" value={form.email} onChange={e => set('email', e.target.value)}
            className={INPUT_CLS} placeholder="jane.smith@example.com" />
        </FIELD>
        <FIELD label="Address">
          <input value={form.address} onChange={e => set('address', e.target.value)}
            className={INPUT_CLS} placeholder="123 Main St, Melbourne VIC 3000" />
        </FIELD>
      </SECTION>

      {/* Employment Details */}
      <SECTION title="Employment Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FIELD label="Entity">
            <input readOnly value={tenantName || form.entityName} className={`${INPUT_CLS} cursor-not-allowed opacity-70`} />
          </FIELD>
          <FIELD label="Employment Type" required>
            <select required value={form.employmentType} onChange={e => set('employmentType', e.target.value)} className={SELECT_CLS}>
              {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FIELD>
          <FIELD label="Department">
            <select value={form.departmentId} onChange={e => { set('departmentId', e.target.value); set('positionId', '') }} className={SELECT_CLS}>
              <option value="">No department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </FIELD>
          <FIELD label="Position">
            <select value={form.positionId} onChange={e => set('positionId', e.target.value)} className={SELECT_CLS}>
              <option value="">No position</option>
              {filteredPositions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </FIELD>
          <FIELD label="Award / Classification">
            <input value={form.awardClassification} onChange={e => set('awardClassification', e.target.value)}
              className={INPUT_CLS} placeholder="e.g. SCHADS Award Level 3.1" />
          </FIELD>
          <FIELD label="Pay Level">
            <input value={form.payLevel} onChange={e => set('payLevel', e.target.value)}
              className={INPUT_CLS} placeholder="e.g. Level 3" />
          </FIELD>
          <FIELD label="Annual Salary ($)">
            <input type="number" step="0.01" min="0" value={form.annualSalary}
              onChange={e => set('annualSalary', e.target.value)}
              className={INPUT_CLS} placeholder="e.g. 65000.00" />
          </FIELD>
          <FIELD label="Ordinary Hours / Week">
            <input type="number" step="0.5" min="0" max="168" value={form.ordinaryHoursPerWeek}
              onChange={e => set('ordinaryHoursPerWeek', e.target.value)}
              className={INPUT_CLS} placeholder="38" />
          </FIELD>
          <FIELD label="Start Date" required>
            <input required type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
              className={INPUT_CLS} />
          </FIELD>
          <FIELD label="Probation End Date">
            <input type="date" value={form.probationEndDate} onChange={e => set('probationEndDate', e.target.value)}
              className={INPUT_CLS} />
          </FIELD>
          <FIELD label="End Date (if applicable)">
            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
              className={INPUT_CLS} />
          </FIELD>
        </div>

        {/* NDIS toggle */}
        <label className="flex items-center gap-3 cursor-pointer mt-2">
          <div
            onClick={() => set('ndisWorker', !form.ndisWorker)}
            className="relative rounded-full transition-colors"
            style={{ width: 40, height: 22, background: form.ndisWorker ? '#9333ea' : '#d1d5db' }}
          >
            <span
              className="absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform dark:bg-gray-900"
              style={{ width: 18, height: 18, transform: form.ndisWorker ? 'translateX(18px)' : 'translateX(0)' }}
            />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            NDIS Worker <span className="text-xs text-gray-600 dark:text-gray-400 font-normal">(requires additional compliance screening)</span>
          </span>
        </label>
      </SECTION>

      {/* Actions */}
      <div className="flex items-center gap-3 pb-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: 'var(--primary)' }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <Link
          href={`/tenant/employee-management/${id}`}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
