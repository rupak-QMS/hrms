'use client'

import { useState, useEffect, useCallback } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  firstName: string
  lastName: string
  preferredName: string | null
  ndisNumber: string | null
  dateOfBirth: string | null
  address: string | null
  phone: string | null
  email: string | null
  supportLevel: string | null
  fundingBody: string
  planStartDate: string | null
  planEndDate: string | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface Goal {
  id: string
  goalCategory: string
  title: string
  description: string | null
  status: string
  targetDate: string | null
  achievedDate: string | null
  progressNotes: string | null
  createdBy: string | null
  createdAt: string
}

interface SupportPlan {
  id: string
  planType: string
  title: string
  status: string
  planStartDate: string | null
  planEndDate: string | null
  reviewDate: string | null
  totalBudget: string | null
  fundedSupports: string | null
  coordinatorName: string | null
  coordinatorOrg: string | null
  coordinatorEmail: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}

interface ParticipantNote {
  id: string
  noteType: string
  title: string | null
  content: string
  visibility: string
  createdBy: string | null
  createdAt: string
}

interface Contact {
  id: string
  contactType: string
  firstName: string
  lastName: string | null
  relationship: string | null
  phone: string | null
  email: string | null
  address: string | null
  isPrimary: boolean
  notes: string | null
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL_CATEGORIES = ['daily_living', 'social_participation', 'employment', 'education', 'health', 'other']
const GOAL_CATEGORY_LABELS: Record<string, string> = {
  daily_living: 'Daily Living', social_participation: 'Social Participation',
  employment: 'Employment', education: 'Education', health: 'Health & Wellbeing', other: 'Other',
}
const GOAL_STATUSES = ['not_started', 'in_progress', 'achieved', 'on_hold', 'discontinued']
const GOAL_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started', in_progress: 'In Progress', achieved: 'Achieved',
  on_hold: 'On Hold', discontinued: 'Discontinued',
}

const PLAN_TYPES = ['initial', 'review', 'amendment']
const PLAN_TYPE_LABELS: Record<string, string> = { initial: 'Initial', review: 'Review', amendment: 'Amendment' }
const PLAN_STATUSES = ['draft', 'active', 'expired', 'archived']
const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', active: 'Active', expired: 'Expired', archived: 'Archived',
}

const NOTE_TYPES = ['case_note', 'progress', 'incident', 'review', 'other']
const NOTE_TYPE_LABELS: Record<string, string> = {
  case_note: 'Case Note', progress: 'Progress Note', incident: 'Incident', review: 'Review', other: 'Other',
}
const NOTE_VISIBILITIES = ['internal', 'shared', 'participant']
const NOTE_VISIBILITY_LABELS: Record<string, string> = {
  internal: 'Internal', shared: 'Shared (Team)', participant: 'Participant Visible',
}

const CONTACT_TYPES = ['emergency', 'family', 'guardian', 'carer', 'professional', 'other']
const CONTACT_TYPE_LABELS: Record<string, string> = {
  emergency: 'Emergency', family: 'Family', guardian: 'Guardian/Nominee',
  carer: 'Carer', professional: 'Professional', other: 'Other',
}

const SUPPORT_LEVELS = ['Low', 'Medium', 'High', 'Very High', 'Intensive']
const FUNDING_BODIES = ['NDIS', 'DVA', 'State', 'Private', 'Other']

const DETAIL_TABS = ['overview', 'goals', 'support-plans', 'notes', 'contacts'] as const
type DetailTab = typeof DETAIL_TABS[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-AU') : '—'
const fmtMoney = (v: string | null) => v ? `$${parseFloat(v).toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '—'
const displayName = (p: Participant) => `${p.firstName} ${p.lastName}`

const goalStatusColor: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  in_progress:  'bg-[#E0EEF4] text-[#0E3D52] dark:bg-blue-900 dark:text-[#7dcfd7]',
  achieved:     'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  on_hold:      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  discontinued: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}
const planStatusColor: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  active:   'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  expired:  'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ParticipantsPage() {
  // List state
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active')
  const [filterFunding, setFilterFunding] = useState('')

  // Detail state
  const [selected, setSelected]         = useState<Participant | null>(null)
  const [activeTab, setActiveTab]       = useState<DetailTab>('overview')

  // Sub-resource state
  const [goals, setGoals]               = useState<Goal[]>([])
  const [plans, setPlans]               = useState<SupportPlan[]>([])
  const [notes, setNotes]               = useState<ParticipantNote[]>([])
  const [contacts, setContacts]         = useState<Contact[]>([])
  const [subLoading, setSubLoading]     = useState(false)

  // Modal state
  const [showCreate, setShowCreate]     = useState(false)
  const [showEdit, setShowEdit]         = useState(false)
  const [showGoal, setShowGoal]         = useState(false)
  const [showPlan, setShowPlan]         = useState(false)
  const [showNote, setShowNote]         = useState(false)
  const [showContact, setShowContact]   = useState(false)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)

  // Forms
  const blankParticipant = {
    firstName: '', lastName: '', preferredName: '', ndisNumber: '',
    dateOfBirth: '', address: '', phone: '', email: '',
    supportLevel: '', fundingBody: 'NDIS', planStartDate: '', planEndDate: '', notes: '',
  }
  const [pForm, setPForm] = useState({ ...blankParticipant })

  const blankGoal = { goalCategory: 'daily_living', title: '', description: '', status: 'not_started', targetDate: '', progressNotes: '' }
  const [goalForm, setGoalForm] = useState({ ...blankGoal })

  const blankPlan = {
    planType: 'initial', title: '', status: 'draft', planStartDate: '', planEndDate: '',
    reviewDate: '', totalBudget: '', fundedSupports: '', coordinatorName: '', coordinatorOrg: '', coordinatorEmail: '', notes: '',
  }
  const [planForm, setPlanForm] = useState({ ...blankPlan })

  const blankNote = { noteType: 'case_note', title: '', content: '', visibility: 'internal' }
  const [noteForm, setNoteForm] = useState({ ...blankNote })

  const blankContact = { contactType: 'emergency', firstName: '', lastName: '', relationship: '', phone: '', email: '', address: '', isPrimary: false, notes: '' }
  const [contactForm, setContactForm] = useState({ ...blankContact })

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportParticipantsCsv = () => {
    exportCsv({
      filename: 'participants',
      columns: [
        { header: 'First Name',    key: 'firstName' },
        { header: 'Last Name',     key: 'lastName' },
        { header: 'Preferred Name', key: 'preferredName' },
        { header: 'NDIS Number',   key: 'ndisNumber' },
        { header: 'Date of Birth', key: 'dateOfBirth', format: fmtCsvDate },
        { header: 'Funding Body',  key: 'fundingBody' },
        { header: 'Support Level', key: 'supportLevel' },
        { header: 'Status',        key: 'isActive', format: (v: unknown) => v ? 'Active' : 'Inactive' },
        { header: 'Phone',         key: 'phone' },
        { header: 'Email',         key: 'email' },
        { header: 'Plan Start',    key: 'planStartDate', format: fmtCsvDate },
        { header: 'Plan End',      key: 'planEndDate',   format: fmtCsvDate },
        { header: 'Created',       key: 'createdAt',     format: fmtCsvDate },
      ],
      rows: participants,
    })
  }

  // ── Fetch participants ──────────────────────────────────────────────────────
  const fetchParticipants = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterActive !== 'all') params.set('active', filterActive === 'active' ? 'true' : 'false')
      if (filterFunding) params.set('fundingBody', filterFunding)
      const res = await fetchWithAuth(`/api/tenant/participants?${params}`)
      const data = await res.json()
      setParticipants(data.participants || [])
    } finally {
      setLoading(false)
    }
  }, [search, filterActive, filterFunding])

  useEffect(() => { fetchParticipants() }, [fetchParticipants])

  // ── Fetch sub-resources ────────────────────────────────────────────────────
  const fetchSubResource = useCallback(async (tab: DetailTab, pid: string) => {
    if (tab === 'overview') return
    setSubLoading(true)
    try {
      if (tab === 'goals') {
        const r = await fetchWithAuth(`/api/tenant/participants/${pid}/goals`)
        setGoals((await r.json()).goals || [])
      } else if (tab === 'support-plans') {
        const r = await fetchWithAuth(`/api/tenant/participants/${pid}/support-plans`)
        setPlans((await r.json()).plans || [])
      } else if (tab === 'notes') {
        const r = await fetchWithAuth(`/api/tenant/participants/${pid}/notes`)
        setNotes((await r.json()).notes || [])
      } else if (tab === 'contacts') {
        const r = await fetchWithAuth(`/api/tenant/participants/${pid}/contacts`)
        setContacts((await r.json()).contacts || [])
      }
    } finally {
      setSubLoading(false)
    }
  }, [])

  const selectParticipant = (p: Participant) => {
    setSelected(p)
    setActiveTab('overview')
  }

  const changeTab = (tab: DetailTab) => {
    setActiveTab(tab)
    if (selected) fetchSubResource(tab, selected.id)
  }

  // ── Create / Edit participant ───────────────────────────────────────────────
  const openCreate = () => { setPForm({ ...blankParticipant }); setError(''); setShowCreate(true) }
  const openEdit = () => {
    if (!selected) return
    setPForm({
      firstName: selected.firstName, lastName: selected.lastName,
      preferredName: selected.preferredName || '', ndisNumber: selected.ndisNumber || '',
      dateOfBirth: selected.dateOfBirth || '', address: selected.address || '',
      phone: selected.phone || '', email: selected.email || '',
      supportLevel: selected.supportLevel || '', fundingBody: selected.fundingBody,
      planStartDate: selected.planStartDate || '', planEndDate: selected.planEndDate || '',
      notes: selected.notes || '',
    })
    setError('')
    setShowEdit(true)
  }

  const saveParticipant = async (isEdit: boolean) => {
    setSaving(true); setError('')
    try {
      const payload = {
        ...pForm,
        dateOfBirth:   pForm.dateOfBirth   || null,
        planStartDate: pForm.planStartDate || null,
        planEndDate:   pForm.planEndDate   || null,
      }
      let res: Response
      if (isEdit && selected) {
        res = await fetchWithAuth(`/api/tenant/participants/${selected.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        res = await fetchWithAuth('/api/tenant/participants', { method: 'POST', body: JSON.stringify(payload) })
      }
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
      const d = await res.json()
      if (isEdit) {
        setSelected(d.participant)
        setParticipants(ps => ps.map(p => p.id === d.participant.id ? d.participant : p))
        setShowEdit(false)
      } else {
        await fetchParticipants()
        setSelected(d.participant)
        setShowCreate(false)
      }
    } finally { setSaving(false) }
  }

  const softDelete = async () => {
    if (!selected) return
    setConfirmState({
      message: `Deactivate ${displayName(selected)}?`,
      confirmLabel: 'Deactivate',
      onConfirm: async () => {
        await fetchWithAuth(`/api/tenant/participants/${selected.id}`, { method: 'DELETE' })
        await fetchParticipants()
        setSelected(null)
      }
    })
  }

  // ── Create sub-resources ───────────────────────────────────────────────────
  const saveGoal = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      const res = await fetchWithAuth(`/api/tenant/participants/${selected.id}/goals`, {
        method: 'POST', body: JSON.stringify({ ...goalForm, targetDate: goalForm.targetDate || null }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
      setShowGoal(false); setGoalForm({ ...blankGoal }); fetchSubResource('goals', selected.id)
    } finally { setSaving(false) }
  }

  const savePlan = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      const res = await fetchWithAuth(`/api/tenant/participants/${selected.id}/support-plans`, {
        method: 'POST', body: JSON.stringify({
          ...planForm,
          planStartDate: planForm.planStartDate || null, planEndDate: planForm.planEndDate || null,
          reviewDate: planForm.reviewDate || null, totalBudget: planForm.totalBudget ? parseFloat(planForm.totalBudget) : null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
      setShowPlan(false); setPlanForm({ ...blankPlan }); fetchSubResource('support-plans', selected.id)
    } finally { setSaving(false) }
  }

  const saveNote = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      const res = await fetchWithAuth(`/api/tenant/participants/${selected.id}/notes`, {
        method: 'POST', body: JSON.stringify({ ...noteForm, title: noteForm.title || null }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
      setShowNote(false); setNoteForm({ ...blankNote }); fetchSubResource('notes', selected.id)
    } finally { setSaving(false) }
  }

  const saveContact = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      const res = await fetchWithAuth(`/api/tenant/participants/${selected.id}/contacts`, {
        method: 'POST', body: JSON.stringify(contactForm),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
      setShowContact(false); setContactForm({ ...blankContact }); fetchSubResource('contacts', selected.id)
    } finally { setSaving(false) }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-gray-900">

      {/* ── Left: Participant List ─────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Participants</h1>
            <div className="flex gap-2">
              <ExportButton onClick={exportParticipantsCsv} disabled={participants.length === 0} />
              <button onClick={openCreate}
                className="px-3 py-1.5 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition-colors">
                + New
              </button>
            </div>
          </div>
          <input
            type="text" placeholder="Search name, NDIS number…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#0E3D52]/20 focus:outline-none mb-2"
          />
          <div className="flex gap-2">
            <select value={filterActive} onChange={e => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <select value={filterFunding} onChange={e => setFilterFunding(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <option value="">All Funding</option>
              {FUNDING_BODIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Loading…</div>
          ) : participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
              <span className="text-2xl mb-1">👤</span>No participants found
            </div>
          ) : participants.map(p => (
            <button key={p.id} onClick={() => selectParticipant(p)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selected?.id === p.id ? 'bg-[#E0EEF4] dark:bg-[#0E3D52]/20 border-l-2 border-l-[#0E3D52]' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-gray-900 dark:text-white">
                  {displayName(p)}{p.preferredName ? ` (${p.preferredName})` : ''}
                </span>
                {!p.isActive && <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300 px-1.5 py-0.5 rounded">Inactive</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">{p.fundingBody}</span>
                {p.ndisNumber && <span className="text-xs text-gray-400 dark:text-gray-500">· {p.ndisNumber}</span>}
              </div>
              {p.supportLevel && <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{p.supportLevel} Support</div>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Detail Panel ────────────────────────────────────────────── */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
          <div className="text-center">
            <div className="text-5xl mb-3">👤</div>
            <p className="text-lg font-medium">Select a participant</p>
            <p className="text-sm mt-1">or create a new one</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Detail header */}
          <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="page-premium-title">
                  {displayName(selected)}
                  {selected.preferredName && <span className="text-gray-500 dark:text-gray-400 font-normal ml-2">({selected.preferredName})</span>}
                </h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {selected.ndisNumber && <span>NDIS: <strong className="text-gray-700 dark:text-gray-300">{selected.ndisNumber}</strong></span>}
                  <span className="px-2 py-0.5 bg-[#E0EEF4] dark:bg-blue-900 text-[#0E3D52] dark:text-[#7dcfd7] rounded text-xs font-medium">{selected.fundingBody}</span>
                  {selected.supportLevel && <span className="px-2 py-0.5 bg-[#E0EEF4] dark:bg-[#0E3D52] text-[#0E3D52] dark:text-[#4ebac4] rounded text-xs">{selected.supportLevel} Support</span>}
                  {!selected.isActive && <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs">Inactive</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openEdit}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Edit
                </button>
                {selected.isActive && (
                  <button onClick={softDelete}
                    className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    Deactivate
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-4 -mb-px">
              {DETAIL_TABS.map(tab => (
                <button key={tab} onClick={() => changeTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${activeTab === tab
                    ? 'bg-gray-50 dark:bg-gray-900 border border-b-0 border-gray-200 dark:border-gray-700 text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  {tab === 'support-plans' ? 'Support Plans' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">

            {/* ── Overview ── */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 gap-6">
                <Section title="Personal Details">
                  <Field label="Date of Birth" value={fmtDate(selected.dateOfBirth)} />
                  <Field label="Phone" value={selected.phone} />
                  <Field label="Email" value={selected.email} />
                  <Field label="Address" value={selected.address} />
                </Section>
                <Section title="NDIS Plan">
                  <Field label="Plan Start" value={fmtDate(selected.planStartDate)} />
                  <Field label="Plan End"   value={fmtDate(selected.planEndDate)} />
                  <Field label="Support Level" value={selected.supportLevel} />
                  <Field label="Funding Body" value={selected.fundingBody} />
                </Section>
                {selected.notes && (
                  <div className="col-span-2">
                    <Section title="Notes">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selected.notes}</p>
                    </Section>
                  </div>
                )}
                <div className="col-span-2">
                  <Section title="Record Info">
                    <Field label="Created" value={fmtDate(selected.createdAt)} />
                    <Field label="Last Updated" value={fmtDate(selected.updatedAt)} />
                    <Field label="Status" value={selected.isActive ? 'Active' : 'Inactive'} />
                  </Section>
                </div>
              </div>
            )}

            {/* ── Goals ── */}
            {activeTab === 'goals' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Goals ({goals.length})</h3>
                  <button onClick={() => { setGoalForm({ ...blankGoal }); setError(''); setShowGoal(true) }}
                    className="px-3 py-1.5 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition-colors">
                    + Add Goal
                  </button>
                </div>
                {subLoading ? <Spinner /> : goals.length === 0 ? <Empty label="No goals recorded" /> : (
                  <div className="space-y-3">
                    {goals.map(g => (
                      <div key={g.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{g.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{GOAL_CATEGORY_LABELS[g.goalCategory] || g.goalCategory}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${goalStatusColor[g.status] || ''}`}>
                            {GOAL_STATUS_LABELS[g.status] || g.status}
                          </span>
                        </div>
                        {g.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{g.description}</p>}
                        <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                          {g.targetDate && <span>Target: {fmtDate(g.targetDate)}</span>}
                          {g.achievedDate && <span>Achieved: {fmtDate(g.achievedDate)}</span>}
                          {g.createdBy && <span>By: {g.createdBy}</span>}
                        </div>
                        {g.progressNotes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 italic">{g.progressNotes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Support Plans ── */}
            {activeTab === 'support-plans' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Support Plans ({plans.length})</h3>
                  <button onClick={() => { setPlanForm({ ...blankPlan }); setError(''); setShowPlan(true) }}
                    className="px-3 py-1.5 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition-colors">
                    + Add Plan
                  </button>
                </div>
                {subLoading ? <Spinner /> : plans.length === 0 ? <Empty label="No support plans recorded" /> : (
                  <div className="space-y-3">
                    {plans.map(p => (
                      <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{p.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{PLAN_TYPE_LABELS[p.planType] || p.planType} Plan</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${planStatusColor[p.status] || ''}`}>
                            {PLAN_STATUS_LABELS[p.status] || p.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                          <div><span className="text-gray-400">Start:</span> <span className="text-gray-700 dark:text-gray-300">{fmtDate(p.planStartDate)}</span></div>
                          <div><span className="text-gray-400">End:</span> <span className="text-gray-700 dark:text-gray-300">{fmtDate(p.planEndDate)}</span></div>
                          <div><span className="text-gray-400">Review:</span> <span className="text-gray-700 dark:text-gray-300">{fmtDate(p.reviewDate)}</span></div>
                        </div>
                        {p.totalBudget && (
                          <div className="mt-2 text-xs"><span className="text-gray-400">Total Budget:</span> <span className="font-semibold text-gray-700 dark:text-gray-300">{fmtMoney(p.totalBudget)}</span></div>
                        )}
                        {(p.coordinatorName || p.coordinatorOrg) && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Coordinator: {p.coordinatorName}{p.coordinatorOrg ? ` — ${p.coordinatorOrg}` : ''}
                            {p.coordinatorEmail && <span className="ml-1">({p.coordinatorEmail})</span>}
                          </div>
                        )}
                        {p.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{p.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Notes ── */}
            {activeTab === 'notes' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Notes ({notes.length})</h3>
                  <button onClick={() => { setNoteForm({ ...blankNote }); setError(''); setShowNote(true) }}
                    className="px-3 py-1.5 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition-colors">
                    + Add Note
                  </button>
                </div>
                {subLoading ? <Spinner /> : notes.length === 0 ? <Empty label="No notes recorded" /> : (
                  <div className="space-y-3">
                    {notes.map(n => (
                      <div key={n.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                              {NOTE_TYPE_LABELS[n.noteType] || n.noteType}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-[#E0EEF4] dark:bg-[#0E3D52]/20 text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#7dcfd7] rounded-full">
                              {NOTE_VISIBILITY_LABELS[n.visibility] || n.visibility}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">{fmtDate(n.createdAt)}</span>
                        </div>
                        {n.title && <p className="font-medium text-gray-900 dark:text-white mb-1">{n.title}</p>}
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{n.content}</p>
                        {n.createdBy && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">— {n.createdBy}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Contacts ── */}
            {activeTab === 'contacts' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Contacts ({contacts.length})</h3>
                  <button onClick={() => { setContactForm({ ...blankContact }); setError(''); setShowContact(true) }}
                    className="px-3 py-1.5 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition-colors">
                    + Add Contact
                  </button>
                </div>
                {subLoading ? <Spinner /> : contacts.length === 0 ? <Empty label="No contacts recorded" /> : (
                  <div className="grid grid-cols-2 gap-3">
                    {contacts.map(c => (
                      <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {c.firstName} {c.lastName || ''}
                              {c.isPrimary && <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full">Primary</span>}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {CONTACT_TYPE_LABELS[c.contactType] || c.contactType}
                              {c.relationship && ` · ${c.relationship}`}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 space-y-0.5 text-sm">
                          {c.phone && <p className="text-gray-600 dark:text-gray-400">📞 {c.phone}</p>}
                          {c.email && <p className="text-gray-600 dark:text-gray-400">✉ {c.email}</p>}
                          {c.address && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{c.address}</p>}
                        </div>
                        {c.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">{c.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modals ─────────────────────────────────────────────────────────── */}

      {/* Create / Edit Participant */}
      {(showCreate || showEdit) && (
        <Modal title={showCreate ? 'New Participant' : 'Edit Participant'}
          onClose={() => { setShowCreate(false); setShowEdit(false) }}
          onSave={() => saveParticipant(showEdit)}
          saving={saving} error={error} wide>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name *</Label>
              <Input value={pForm.firstName} onChange={v => setPForm(f => ({ ...f, firstName: v }))} />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input value={pForm.lastName} onChange={v => setPForm(f => ({ ...f, lastName: v }))} />
            </div>
            <div>
              <Label>Preferred Name</Label>
              <Input value={pForm.preferredName} onChange={v => setPForm(f => ({ ...f, preferredName: v }))} />
            </div>
            <div>
              <Label>NDIS Number</Label>
              <Input value={pForm.ndisNumber} onChange={v => setPForm(f => ({ ...f, ndisNumber: v }))} />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" value={pForm.dateOfBirth} onChange={v => setPForm(f => ({ ...f, dateOfBirth: v }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={pForm.phone} onChange={v => setPForm(f => ({ ...f, phone: v }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={pForm.email} onChange={v => setPForm(f => ({ ...f, email: v }))} />
            </div>
            <div>
              <Label>Funding Body</Label>
              <Select value={pForm.fundingBody} onChange={v => setPForm(f => ({ ...f, fundingBody: v }))}>
                {FUNDING_BODIES.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>
            </div>
            <div>
              <Label>Support Level</Label>
              <Select value={pForm.supportLevel} onChange={v => setPForm(f => ({ ...f, supportLevel: v }))}>
                <option value="">Select…</option>
                {SUPPORT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </Select>
            </div>
            <div>
              <Label>Plan Start Date</Label>
              <Input type="date" value={pForm.planStartDate} onChange={v => setPForm(f => ({ ...f, planStartDate: v }))} />
            </div>
            <div>
              <Label>Plan End Date</Label>
              <Input type="date" value={pForm.planEndDate} onChange={v => setPForm(f => ({ ...f, planEndDate: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={pForm.address} onChange={v => setPForm(f => ({ ...f, address: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={pForm.notes} onChange={v => setPForm(f => ({ ...f, notes: v }))} rows={3} />
            </div>
          </div>
        </Modal>
      )}

      {/* Add Goal */}
      {showGoal && (
        <Modal title="Add Goal" onClose={() => setShowGoal(false)} onSave={saveGoal} saving={saving} error={error}>
          <div className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={goalForm.goalCategory} onChange={v => setGoalForm(f => ({ ...f, goalCategory: v }))}>
                {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{GOAL_CATEGORY_LABELS[c]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Title *</Label>
              <Input value={goalForm.title} onChange={v => setGoalForm(f => ({ ...f, title: v }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={goalForm.description} onChange={v => setGoalForm(f => ({ ...f, description: v }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={goalForm.status} onChange={v => setGoalForm(f => ({ ...f, status: v }))}>
                  {GOAL_STATUSES.map(s => <option key={s} value={s}>{GOAL_STATUS_LABELS[s]}</option>)}
                </Select>
              </div>
              <div>
                <Label>Target Date</Label>
                <Input type="date" value={goalForm.targetDate} onChange={v => setGoalForm(f => ({ ...f, targetDate: v }))} />
              </div>
            </div>
            <div>
              <Label>Progress Notes</Label>
              <Textarea value={goalForm.progressNotes} onChange={v => setGoalForm(f => ({ ...f, progressNotes: v }))} rows={2} />
            </div>
          </div>
        </Modal>
      )}

      {/* Add Support Plan */}
      {showPlan && (
        <Modal title="Add Support Plan" onClose={() => setShowPlan(false)} onSave={savePlan} saving={saving} error={error} wide>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Plan Type</Label>
              <Select value={planForm.planType} onChange={v => setPlanForm(f => ({ ...f, planType: v }))}>
                {PLAN_TYPES.map(t => <option key={t} value={t}>{PLAN_TYPE_LABELS[t]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={planForm.status} onChange={v => setPlanForm(f => ({ ...f, status: v }))}>
                {PLAN_STATUSES.map(s => <option key={s} value={s}>{PLAN_STATUS_LABELS[s]}</option>)}
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Title *</Label>
              <Input value={planForm.title} onChange={v => setPlanForm(f => ({ ...f, title: v }))} />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={planForm.planStartDate} onChange={v => setPlanForm(f => ({ ...f, planStartDate: v }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={planForm.planEndDate} onChange={v => setPlanForm(f => ({ ...f, planEndDate: v }))} />
            </div>
            <div>
              <Label>Review Date</Label>
              <Input type="date" value={planForm.reviewDate} onChange={v => setPlanForm(f => ({ ...f, reviewDate: v }))} />
            </div>
            <div>
              <Label>Total Budget ($)</Label>
              <Input type="number" value={planForm.totalBudget} onChange={v => setPlanForm(f => ({ ...f, totalBudget: v }))} />
            </div>
            <div>
              <Label>Coordinator Name</Label>
              <Input value={planForm.coordinatorName} onChange={v => setPlanForm(f => ({ ...f, coordinatorName: v }))} />
            </div>
            <div>
              <Label>Coordinator Organisation</Label>
              <Input value={planForm.coordinatorOrg} onChange={v => setPlanForm(f => ({ ...f, coordinatorOrg: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Coordinator Email</Label>
              <Input type="email" value={planForm.coordinatorEmail} onChange={v => setPlanForm(f => ({ ...f, coordinatorEmail: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Funded Supports</Label>
              <Textarea value={planForm.fundedSupports} onChange={v => setPlanForm(f => ({ ...f, fundedSupports: v }))} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={planForm.notes} onChange={v => setPlanForm(f => ({ ...f, notes: v }))} rows={2} />
            </div>
          </div>
        </Modal>
      )}

      {/* Add Note */}
      {showNote && (
        <Modal title="Add Note" onClose={() => setShowNote(false)} onSave={saveNote} saving={saving} error={error}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Note Type</Label>
                <Select value={noteForm.noteType} onChange={v => setNoteForm(f => ({ ...f, noteType: v }))}>
                  {NOTE_TYPES.map(t => <option key={t} value={t}>{NOTE_TYPE_LABELS[t]}</option>)}
                </Select>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={noteForm.visibility} onChange={v => setNoteForm(f => ({ ...f, visibility: v }))}>
                  {NOTE_VISIBILITIES.map(v => <option key={v} value={v}>{NOTE_VISIBILITY_LABELS[v]}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label>Title (optional)</Label>
              <Input value={noteForm.title} onChange={v => setNoteForm(f => ({ ...f, title: v }))} />
            </div>
            <div>
              <Label>Content *</Label>
              <Textarea value={noteForm.content} onChange={v => setNoteForm(f => ({ ...f, content: v }))} rows={5} />
            </div>
          </div>
        </Modal>
      )}

      {/* Add Contact */}
      {showContact && (
        <Modal title="Add Contact" onClose={() => setShowContact(false)} onSave={saveContact} saving={saving} error={error} wide>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Contact Type</Label>
              <Select value={contactForm.contactType} onChange={v => setContactForm(f => ({ ...f, contactType: v }))}>
                {CONTACT_TYPES.map(t => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Relationship</Label>
              <Input value={contactForm.relationship} onChange={v => setContactForm(f => ({ ...f, relationship: v }))} placeholder="e.g. Mother, Support Worker…" />
            </div>
            <div>
              <Label>First Name *</Label>
              <Input value={contactForm.firstName} onChange={v => setContactForm(f => ({ ...f, firstName: v }))} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input value={contactForm.lastName} onChange={v => setContactForm(f => ({ ...f, lastName: v }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={contactForm.phone} onChange={v => setContactForm(f => ({ ...f, phone: v }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={contactForm.email} onChange={v => setContactForm(f => ({ ...f, email: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={contactForm.address} onChange={v => setContactForm(f => ({ ...f, address: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={contactForm.notes} onChange={v => setContactForm(f => ({ ...f, notes: v }))} rows={2} />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contactForm.isPrimary}
                  onChange={e => setContactForm(f => ({ ...f, isPrimary: e.target.checked }))}
                  className="w-4 h-4 text-[#0E3D52] dark:text-[#4ebac4] rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Primary contact</span>
              </label>
            </div>
          </div>
        </Modal>
      )}
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500  mb-3">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-700 dark:text-gray-300 text-right">{value || '—'}</span>
    </div>
  )
}

function Spinner() {
  return <div className="flex justify-center items-center h-24 text-gray-400 text-sm">Loading…</div>
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-24 text-gray-400 text-sm">
      <span className="text-2xl mb-1">📋</span>{label}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{children}</label>
}

function Input({ value, onChange, type = 'text', placeholder }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#0E3D52]/20 focus:outline-none" />
  )
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0E3D52]/20 focus:outline-none">
      {children}
    </select>
  )
}

function Textarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#0E3D52]/20 focus:outline-none resize-none" />
  )
}

function Modal({ title, onClose, onSave, saving, error, children, wide }: {
  title: string; onClose: () => void; onSave: () => void
  saving: boolean; error: string; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="modal-overlay">
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] ${wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {error && <p className="px-6 text-sm text-red-600 dark:text-red-400 pb-2">{error}</p>}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            className="px-4 py-2 text-sm bg-[#0E3D52] text-white rounded-lg hover:bg-[#1A6080] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
