'use client'

/**
 * Employee Self-Service — Onboarding Wizard
 * 5 steps: Personal → Tax (TFN) → Superannuation → Bank → Emergency Contact
 * Auto-saves (POST) on every step; PATCH to submit for HR review.
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { SkeletonPage } from '@/components/ui/Skeleton'

// ── types ──────────────────────────────────────────────────────────────────
interface OnboardingData {
  // Step 1
  preferredName?: string
  dateOfBirth?: string
  gender?: string
  phone?: string
  address?: string
  // Step 2
  tfnDeclared?: boolean
  taxResidency?: string
  taxFreeThreshold?: boolean
  hasHelpDebt?: boolean
  taxFileNumber?: string
  // Step 3
  superFundName?: string
  superFundAbn?: string
  superUsi?: string
  superMemberNumber?: string
  isSmsf?: boolean
  // Step 4
  bankName?: string
  bankBsb?: string
  bankAccountNumber?: string
  bankAccountName?: string
  // Step 5
  emergencyName?: string
  emergencyRelation?: string
  emergencyPhone?: string
  emergencyPhone2?: string
  // meta
  status?: string
  submittedAt?: string
}

// ── step config ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Personal Details',   icon: '👤' },
  { id: 2, label: 'Tax Declaration',    icon: '📋' },
  { id: 3, label: 'Superannuation',     icon: '🏦' },
  { id: 4, label: 'Bank Details',       icon: '💳' },
  { id: 5, label: 'Emergency Contact',  icon: '🚨' },
]

// ── helpers ──────────────────────────────────────────────────────────────────
function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#1A6080]/30
        bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
        focus:outline-none focus:ring-2 focus:ring-[#0E3D52]/20 ${props.className ?? ''}`}
    />
  )
}

function Select({
  children, ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#1A6080]/30
        bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
        focus:outline-none focus:ring-2 focus:ring-[#0E3D52]/20"
    >
      {children}
    </select>
  )
}

function Toggle({
  label, checked, onChange, help,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[#0E3D52]' : 'bg-gray-300 dark:bg-gray-600'}`} />
        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {help && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{help}</p>}
      </div>
    </label>
  )
}

// ── main component ───────────────────────────────────────────────────────────
export default function EssOnboardingPage() {
  const [step, setStep]       = useState(1)
  const [data, setData]       = useState<OnboardingData>({})
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)

  // Load existing submission
  useEffect(() => {
    fetchWithAuth('/api/tenant/ess/onboarding')
      .then(r => r.json())
      .then(({ submission }) => {
        if (submission) {
          setData(submission)
          if (submission.status === 'submitted' || submission.status === 'completed') {
            setSubmitted(true)
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const set = useCallback((patch: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...patch }))
  }, [])

  async function save(nextStep?: number) {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetchWithAuth('/api/tenant/ess/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Save failed')
      const { submission } = await res.json()
      setData(submission)
      setSaveMsg('Saved ✓')
      setTimeout(() => setSaveMsg(''), 2000)
      if (nextStep) setStep(nextStep)
    } catch {
      setSaveMsg('Save failed — please retry')
    } finally {
      setSaving(false)
    }
  }

  async function submitForReview() {
    // First save current step
    await save()
    setSaving(true)
    try {
      const res = await fetchWithAuth('/api/tenant/ess/onboarding', { method: 'PATCH' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Submit failed')
      }
      setSubmitted(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Submit failed'
      setSaveMsg(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SkeletonPage rows={5} />

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Onboarding Submitted!</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your onboarding information has been submitted for HR review.
          You&apos;ll be notified once it has been processed.
        </p>
        {data.submittedAt && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Submitted: {new Date(data.submittedAt).toLocaleString()}
          </p>
        )}
        {data.status && (
          <span className="inline-block mt-4 px-4 py-1.5 rounded-full text-sm font-medium bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/20 dark:text-[#4ebac4] capitalize">
            Status: {data.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-premium-title">Employee Onboarding</h1>
        <p className="page-premium-subtitle mt-1">
          Complete all sections and submit for HR review. Your progress is saved automatically.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center shrink-0">
            <button
              onClick={() => step > s.id ? setStep(s.id) : undefined}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${step === s.id
                  ? 'bg-[#0E3D52] text-white'
                  : step > s.id
                    ? 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] hover:bg-[#E0EEF4] dark:hover:bg-[#0E3D52]/30 cursor-pointer'
                    : 'text-gray-400 dark:text-gray-600 cursor-default'
                }`}
            >
              <span>{s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.id}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-1 ${step > s.id ? 'bg-[#1A6080]' : 'bg-gray-200 dark:bg-gray-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white dark:bg-[#0F1E2E] rounded-xl border border-gray-200 dark:border-[#1A6080]/30 p-6 mb-6">
        {step === 1 && <Step1Personal data={data} set={set} />}
        {step === 2 && <Step2Tax data={data} set={set} />}
        {step === 3 && <Step3Super data={data} set={set} />}
        {step === 4 && <Step4Bank data={data} set={set} />}
        {step === 5 && <Step5Emergency data={data} set={set} />}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
            border border-gray-200 dark:border-[#1A6080]/30 rounded-lg hover:bg-gray-50
            dark:hover:bg-[#0E3D52]/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          ← Back
        </button>

        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={`text-sm ${saveMsg.includes('failed') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={() => save()}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
              border border-gray-200 dark:border-[#1A6080]/30 rounded-lg hover:bg-gray-50
              dark:hover:bg-[#0E3D52]/30 disabled:opacity-60 transition"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>

          {step < 5 ? (
            <button
              onClick={() => save(step + 1)}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-[#0E3D52] hover:bg-[#1A6080]
                rounded-lg disabled:opacity-60 transition"
            >
              Save & Continue →
            </button>
          ) : (
            <button
              onClick={submitForReview}
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700
                rounded-lg disabled:opacity-60 transition"
            >
              {saving ? 'Submitting…' : '✓ Submit for HR Review'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Personal Details ─────────────────────────────────────────────────
function Step1Personal({ data, set }: { data: OnboardingData; set: (p: Partial<OnboardingData>) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Personal Details</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Basic personal information. Your legal name is already on file — only provide what&apos;s different.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Preferred Name">
          <Input
            type="text"
            placeholder="e.g. Alex"
            value={data.preferredName ?? ''}
            onChange={e => set({ preferredName: e.target.value })}
          />
        </Field>
        <Field label="Date of Birth">
          <Input
            type="date"
            value={data.dateOfBirth ?? ''}
            onChange={e => set({ dateOfBirth: e.target.value })}
          />
        </Field>
        <Field label="Gender">
          <Select value={data.gender ?? ''} onChange={e => set({ gender: e.target.value })}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non_binary">Non-binary</option>
            <option value="prefer_not">Prefer not to say</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Mobile Phone">
          <Input
            type="tel"
            placeholder="04xx xxx xxx"
            value={data.phone ?? ''}
            onChange={e => set({ phone: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Residential Address">
            <textarea
              rows={3}
              placeholder="Street, Suburb, State, Postcode"
              value={data.address ?? ''}
              onChange={e => set({ address: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#1A6080]/30
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-[#0E3D52]/20 resize-none"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ── Step 2: TFN Declaration ──────────────────────────────────────────────────
function Step2Tax({ data, set }: { data: OnboardingData; set: (p: Partial<OnboardingData>) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Tax (TFN) Declaration</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        This information is required for payroll. It is treated as an ATO Tax File Number Declaration.
      </p>

      <div className="space-y-5">
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">⚠️ TFN Privacy</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
            Your Tax File Number is protected by law. It will be masked after confirmation and used only for payroll and ATO reporting.
          </p>
        </div>

        <Field label="Tax File Number (TFN)">
          <Input
            type="text"
            placeholder="123 456 789"
            maxLength={11}
            value={data.taxFileNumber ?? ''}
            onChange={e => set({ taxFileNumber: e.target.value.replace(/\D/g, '') })}
          />
          <p className="text-xs text-gray-500 mt-1">9 digits — leave blank if you are applying for one or wish to withhold.</p>
        </Field>

        <Toggle
          label="I declare that I have provided my TFN to my employer"
          checked={data.tfnDeclared ?? false}
          onChange={v => set({ tfnDeclared: v })}
          help="By ticking this, you acknowledge the ATO TFN declaration obligations."
        />

        <Field label="Tax Residency Status" required>
          <Select value={data.taxResidency ?? ''} onChange={e => set({ taxResidency: e.target.value })}>
            <option value="">Select…</option>
            <option value="resident">Australian Resident</option>
            <option value="non_resident">Foreign Resident</option>
            <option value="working_holiday">Working Holiday Maker</option>
          </Select>
        </Field>

        <div className="space-y-4 pt-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Additional Declarations</p>
          <Toggle
            label="Claim the tax-free threshold"
            checked={data.taxFreeThreshold ?? false}
            onChange={v => set({ taxFreeThreshold: v })}
            help="Tick if this is your main job and you want to claim the $18,200 tax-free threshold."
          />
          <Toggle
            label="I have a HELP/HECS or other study/training debt"
            checked={data.hasHelpDebt ?? false}
            onChange={v => set({ hasHelpDebt: v })}
            help="Tick if you have a Higher Education Loan Program or VET Student Loan debt."
          />
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Superannuation ───────────────────────────────────────────────────
function Step3Super({ data, set }: { data: OnboardingData; set: (p: Partial<OnboardingData>) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Superannuation</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Nominate your super fund. If you don&apos;t nominate, contributions will go to the employer&apos;s default fund.
      </p>

      <div className="space-y-4">
        <Toggle
          label="This is a Self-Managed Super Fund (SMSF)"
          checked={data.isSmsf ?? false}
          onChange={v => set({ isSmsf: v })}
        />

        <Field label="Fund Name">
          <Input
            type="text"
            placeholder="e.g. Australian Super"
            value={data.superFundName ?? ''}
            onChange={e => set({ superFundName: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Fund ABN">
            <Input
              type="text"
              placeholder="XX XXX XXX XXX"
              value={data.superFundAbn ?? ''}
              onChange={e => set({ superFundAbn: e.target.value })}
            />
          </Field>
          <Field label={data.isSmsf ? 'SMSF Electronic Service Address' : 'Unique Superannuation Identifier (USI)'}>
            <Input
              type="text"
              placeholder={data.isSmsf ? 'ESA address' : 'e.g. STA0100AU'}
              value={data.superUsi ?? ''}
              onChange={e => set({ superUsi: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Member Number">
          <Input
            type="text"
            placeholder="Your member number with the fund"
            value={data.superMemberNumber ?? ''}
            onChange={e => set({ superMemberNumber: e.target.value })}
          />
        </Field>

        <div className="p-4 rounded-xl border border-[#1A6080]/20 bg-[#E0EEF4] dark:bg-[#0E3D52]/20 dark:border-[#1A6080]">
          <p className="text-xs text-[#0E3D52] dark:text-[#7dcfd7]">
            <strong>Employer Contribution Rate:</strong> 11.5% (2024-25 financial year, as per Superannuation Guarantee).
            Contributions are made within 28 days of each quarter end.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Bank Details ─────────────────────────────────────────────────────
function Step4Bank({ data, set }: { data: OnboardingData; set: (p: Partial<OnboardingData>) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Bank Details</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Your salary will be deposited into this account. Ensure all details are correct.
      </p>

      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            ⚠️ Bank details are sensitive. They are encrypted at rest and only accessible to authorised payroll officers.
          </p>
        </div>

        <Field label="Bank / Financial Institution" required>
          <Input
            type="text"
            placeholder="e.g. Commonwealth Bank"
            value={data.bankName ?? ''}
            onChange={e => set({ bankName: e.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="BSB" required>
            <Input
              type="text"
              placeholder="XXX-XXX"
              maxLength={7}
              value={data.bankBsb ?? ''}
              onChange={e => {
                const raw = e.target.value.replace(/\D/g, '')
                const fmt = raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3, 6)}` : raw
                set({ bankBsb: fmt })
              }}
            />
          </Field>
          <Field label="Account Number" required>
            <Input
              type="text"
              placeholder="xxxxxxxxxx"
              maxLength={10}
              value={data.bankAccountNumber ?? ''}
              onChange={e => set({ bankAccountNumber: e.target.value.replace(/\D/g, '') })}
            />
          </Field>
        </div>

        <Field label="Account Name" required>
          <Input
            type="text"
            placeholder="Name as it appears on the account"
            value={data.bankAccountName ?? ''}
            onChange={e => set({ bankAccountName: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}

// ── Step 5: Emergency Contact ────────────────────────────────────────────────
function Step5Emergency({ data, set }: { data: OnboardingData; set: (p: Partial<OnboardingData>) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Emergency Contact</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Someone we can contact in case of a workplace emergency. Please provide at least one phone number.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Contact Name" required>
          <Input
            type="text"
            placeholder="Full name"
            value={data.emergencyName ?? ''}
            onChange={e => set({ emergencyName: e.target.value })}
          />
        </Field>
        <Field label="Relationship" required>
          <Select value={data.emergencyRelation ?? ''} onChange={e => set({ emergencyRelation: e.target.value })}>
            <option value="">Select…</option>
            <option value="spouse">Spouse / Partner</option>
            <option value="parent">Parent</option>
            <option value="sibling">Sibling</option>
            <option value="child">Child</option>
            <option value="friend">Friend</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Primary Phone" required>
          <Input
            type="tel"
            placeholder="04xx xxx xxx"
            value={data.emergencyPhone ?? ''}
            onChange={e => set({ emergencyPhone: e.target.value })}
          />
        </Field>
        <Field label="Secondary Phone (optional)">
          <Input
            type="tel"
            placeholder="04xx xxx xxx or landline"
            value={data.emergencyPhone2 ?? ''}
            onChange={e => set({ emergencyPhone2: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-6 p-4 rounded-xl border border-green-100 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
        <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">Ready to submit?</p>
        <p className="text-xs text-green-700 dark:text-green-400">
          Once you click &ldquo;Submit for HR Review&rdquo;, your onboarding information will be sent to HR for processing.
          You can still edit your submission while it is in &ldquo;draft&rdquo; status.
          After submission, changes must be requested through HR.
        </p>
      </div>
    </div>
  )
}
