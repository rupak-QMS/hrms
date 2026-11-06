'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: string
  firstName: string
  lastName: string
  preferredName: string | null
  ndisNumber: string | null
  fundingBody: string
  isActive: boolean
}

interface Medication {
  id: string
  medicationName: string
  genericName: string | null
  dosage: string | null
  form: string
  route: string
  frequency: string | null
  prescribedBy: string | null
  indication: string | null
  instructions: string | null
  startDate: string | null
  endDate: string | null
  status: string
  requiresAssist: boolean
  refrigerated: boolean
  notes: string | null
  createdBy: string | null
  createdAt: string
}

interface MedLog {
  id: string
  scheduledTime: string
  administeredAt: string | null
  outcome: string
  administeredBy: string | null
  notes: string | null
  createdAt: string
}

interface HealthCondition {
  id: string
  conditionName: string
  conditionType: string
  icdCode: string | null
  severity: string
  diagnosedDate: string | null
  diagnosedBy: string | null
  status: string
  description: string | null
  managementPlan: string | null
  alerts: string | null
  createdBy: string | null
  createdAt: string
}

interface Appointment {
  id: string
  appointmentType: string
  providerName: string | null
  providerOrg: string | null
  appointmentDate: string
  appointmentTime: string | null
  location: string | null
  purpose: string | null
  outcome: string | null
  followUpDate: string | null
  followUpNotes: string | null
  status: string
  requiresTransport: boolean
  supportWorkerNeeded: boolean
  createdBy: string | null
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MED_FORMS = ['tablet', 'capsule', 'liquid', 'injection', 'patch', 'inhaler', 'cream', 'drops', 'other']
const MED_FORM_LABELS: Record<string, string> = {
  tablet: 'Tablet', capsule: 'Capsule', liquid: 'Liquid', injection: 'Injection',
  patch: 'Patch', inhaler: 'Inhaler', cream: 'Cream', drops: 'Drops', other: 'Other',
}
const MED_ROUTES = ['oral', 'topical', 'inhaled', 'injection', 'sublingual', 'other']
const MED_ROUTE_LABELS: Record<string, string> = {
  oral: 'Oral', topical: 'Topical', inhaled: 'Inhaled', injection: 'Injection',
  sublingual: 'Sublingual', other: 'Other',
}
const MED_STATUSES = ['active', 'paused', 'discontinued', 'completed']
const MED_STATUS_LABELS: Record<string, string> = {
  active: 'Active', paused: 'Paused', discontinued: 'Discontinued', completed: 'Completed',
}

const LOG_OUTCOMES = ['given', 'missed', 'refused', 'held', 'partial']
const LOG_OUTCOME_LABELS: Record<string, string> = {
  given: 'Given', missed: 'Missed', refused: 'Refused', held: 'Held (PRN)', partial: 'Partial',
}

const CONDITION_TYPES = ['chronic', 'acute', 'allergy', 'mental_health', 'disability', 'other']
const CONDITION_TYPE_LABELS: Record<string, string> = {
  chronic: 'Chronic', acute: 'Acute', allergy: 'Allergy', mental_health: 'Mental Health',
  disability: 'Disability', other: 'Other',
}
const SEVERITIES = ['mild', 'moderate', 'severe', 'critical']
const SEVERITY_LABELS: Record<string, string> = {
  mild: 'Mild', moderate: 'Moderate', severe: 'Severe', critical: 'Critical',
}
const CONDITION_STATUSES = ['active', 'resolved', 'managed', 'monitoring']
const CONDITION_STATUS_LABELS: Record<string, string> = {
  active: 'Active', resolved: 'Resolved', managed: 'Managed', monitoring: 'Monitoring',
}

const APPT_TYPES = ['gp', 'specialist', 'allied_health', 'dental', 'mental_health', 'other']
const APPT_TYPE_LABELS: Record<string, string> = {
  gp: 'GP / Doctor', specialist: 'Specialist', allied_health: 'Allied Health',
  dental: 'Dental', mental_health: 'Mental Health', other: 'Other',
}
const APPT_STATUSES = ['scheduled', 'completed', 'cancelled', 'missed']
const APPT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled', missed: 'Missed',
}

const DETAIL_TABS = ['medications', 'conditions', 'appointments'] as const
type DetailTab = typeof DETAIL_TABS[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-AU') : '—'
const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const displayName = (p: Participant) => `${p.firstName} ${p.lastName}${p.preferredName ? ` (${p.preferredName})` : ''}`

const medStatusColor: Record<string, string> = {
  active:       'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  paused:       'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  discontinued: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  completed:    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}
const outcomeColor: Record<string, string> = {
  given:   'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  missed:  'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  refused: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  held:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  partial: 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/30 dark:text-[#7dcfd7]',
}
const severityColor: Record<string, string> = {
  mild:     'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  severe:   'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}
const apptStatusColor: Record<string, string> = {
  scheduled: 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/30 dark:text-[#7dcfd7]',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  missed:    'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MedicationHealthPage() {
  // Participant list
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [selected, setSelected]         = useState<Participant | null>(null)
  const [activeTab, setActiveTab]       = useState<DetailTab>('medications')

  // Sub-data
  const [medications, setMedications]   = useState<Medication[]>([])
  const [conditions, setConditions]     = useState<HealthCondition[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [medLogs, setMedLogs]           = useState<MedLog[]>([])
  const [logsFor, setLogsFor]           = useState<Medication | null>(null)
  const [subLoading, setSubLoading]     = useState(false)

  // Modals
  const [showMed, setShowMed]           = useState(false)
  const [showLog, setShowLog]           = useState(false)
  const [showCond, setShowCond]         = useState(false)
  const [showAppt, setShowAppt]         = useState(false)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [confirm, setConfirm]           = useState<ConfirmState>(null)
  const [toast, setToast]               = useState<ToastState>(null)

  // Edit IDs
  const [editMedId, setEditMedId]       = useState<string | null>(null)
  const [editCondId, setEditCondId]     = useState<string | null>(null)
  const [editApptId, setEditApptId]     = useState<string | null>(null)

  // Forms
  const blankMed = {
    medicationName: '', genericName: '', dosage: '', form: 'tablet', route: 'oral',
    frequency: '', prescribedBy: '', indication: '', instructions: '',
    startDate: '', endDate: '', status: 'active',
    requiresAssist: true, refrigerated: false, notes: '',
  }
  const [medForm, setMedForm] = useState({ ...blankMed })

  const blankLog = { scheduledTime: '', administeredAt: '', outcome: 'given', notes: '' }
  const [logForm, setLogForm] = useState({ ...blankLog })

  const blankCond = {
    conditionName: '', conditionType: 'chronic', icdCode: '', severity: 'moderate',
    diagnosedDate: '', diagnosedBy: '', status: 'active',
    description: '', managementPlan: '', alerts: '',
  }
  const [condForm, setCondForm] = useState({ ...blankCond })

  const blankAppt = {
    appointmentType: 'gp', providerName: '', providerOrg: '',
    appointmentDate: '', appointmentTime: '', location: '', purpose: '',
    outcome: '', followUpDate: '', followUpNotes: '', status: 'scheduled',
    requiresTransport: false, supportWorkerNeeded: false,
  }
  const [apptForm, setApptForm] = useState({ ...blankAppt })

  // ── Fetch participants ──────────────────────────────────────────────────────
  const fetchParticipants = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetchWithAuth(`/api/tenant/medication-health/participants?${params}`)
      const data = await res.json()
      setParticipants(data.participants || [])
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchParticipants() }, [fetchParticipants])

  // ── Fetch sub-data ─────────────────────────────────────────────────────────
  const fetchTab = useCallback(async (tab: DetailTab, pid: string) => {
    setSubLoading(true)
    try {
      if (tab === 'medications') {
        const r = await fetchWithAuth(`/api/tenant/medication-health/participants/${pid}/medications`)
        setMedications((await r.json()).medications || [])
      } else if (tab === 'conditions') {
        const r = await fetchWithAuth(`/api/tenant/medication-health/participants/${pid}/conditions`)
        setConditions((await r.json()).conditions || [])
      } else if (tab === 'appointments') {
        const r = await fetchWithAuth(`/api/tenant/medication-health/participants/${pid}/appointments`)
        setAppointments((await r.json()).appointments || [])
      }
    } finally { setSubLoading(false) }
  }, [])

  const selectParticipant = (p: Participant) => {
    setSelected(p)
    setActiveTab('medications')
    setLogsFor(null)
    fetchTab('medications', p.id)
  }

  const changeTab = (tab: DetailTab) => {
    setActiveTab(tab)
    setLogsFor(null)
    if (selected) fetchTab(tab, selected.id)
  }

  const openLogs = async (med: Medication) => {
    if (!selected) return
    setLogsFor(med)
    setSubLoading(true)
    try {
      const r = await fetchWithAuth(`/api/tenant/medication-health/participants/${selected.id}/medications/${med.id}/logs`)
      setMedLogs((await r.json()).logs || [])
    } finally { setSubLoading(false) }
  }

  // ── Delete handlers ────────────────────────────────────────────────────────
  const deleteMedication = async (medId: string) => {
    if (!selected) return
    const res = await fetchWithAuth(`/api/tenant/medication-health/participants/${selected.id}/medications/${medId}`, { method: 'DELETE' })
    if (res.ok) { setMedications(prev => prev.filter(m => m.id !== medId)); setToast({ message: 'Medication deleted', type: 'success' }) }
    else setToast({ message: 'Failed to delete medication', type: 'error' })
  }

  const deleteCondition = async (condId: string) => {
    if (!selected) return
    const res = await fetchWithAuth(`/api/tenant/medication-health/participants/${selected.id}/conditions/${condId}`, { method: 'DELETE' })
    if (res.ok) { setConditions(prev => prev.filter(c => c.id !== condId)); setToast({ message: 'Condition deleted', type: 'success' }) }
    else setToast({ message: 'Failed to delete condition', type: 'error' })
  }

  const deleteAppointment = async (apptId: string) => {
    if (!selected) return
    const res = await fetchWithAuth(`/api/tenant/medication-health/participants/${selected.id}/appointments/${apptId}`, { method: 'DELETE' })
    if (res.ok) { setAppointments(prev => prev.filter(a => a.id !== apptId)); setToast({ message: 'Appointment deleted', type: 'success' }) }
    else setToast({ message: 'Failed to delete appointment', type: 'error' })
  }

  // ── Edit open handlers ────────────────────────────────────────────────────
  const openEditMed = (m: Medication) => {
    setEditMedId(m.id)
    setMedForm({
      medicationName: m.medicationName, genericName: m.genericName || '',
      dosage: m.dosage || '', form: m.form, route: m.route,
      frequency: m.frequency || '', prescribedBy: m.prescribedBy || '',
      indication: m.indication || '', instructions: m.instructions || '',
      startDate: m.startDate || '', endDate: m.endDate || '',
      status: m.status, requiresAssist: m.requiresAssist, refrigerated: m.refrigerated,
      notes: m.notes || '',
    })
    setError(''); setShowMed(true)
  }

  const openEditCond = (c: HealthCondition) => {
    setEditCondId(c.id)
    setCondForm({
      conditionName: c.conditionName, conditionType: c.conditionType,
      icdCode: c.icdCode || '', severity: c.severity,
      diagnosedDate: c.diagnosedDate || '', diagnosedBy: c.diagnosedBy || '',
      status: c.status, description: c.description || '',
      managementPlan: c.managementPlan || '', alerts: c.alerts || '',
    })
    setError(''); setShowCond(true)
  }

  const openEditAppt = (a: Appointment) => {
    setEditApptId(a.id)
    setApptForm({
      appointmentType: a.appointmentType, providerName: a.providerName || '',
      providerOrg: a.providerOrg || '', appointmentDate: a.appointmentDate,
      appointmentTime: a.appointmentTime || '', location: a.location || '',
      purpose: a.purpose || '', outcome: a.outcome || '',
      followUpDate: a.followUpDate || '', followUpNotes: a.followUpNotes || '',
      status: a.status, requiresTransport: a.requiresTransport,
      supportWorkerNeeded: a.supportWorkerNeeded,
    })
    setError(''); setShowAppt(true)
  }

  // ── CSV exports ───────────────────────────────────────────────────────────
  const exportMedsCsv = () => {
    exportCsv({
      filename: `medications-${selected?.firstName}-${selected?.lastName}`,
      columns: [
        { header: 'Medication',   key: 'medicationName' },
        { header: 'Generic Name', key: 'genericName' },
        { header: 'Dosage',       key: 'dosage' },
        { header: 'Form',         key: 'form' },
        { header: 'Route',        key: 'route' },
        { header: 'Frequency',    key: 'frequency' },
        { header: 'Status',       key: 'status' },
        { header: 'Prescribed By', key: 'prescribedBy' },
        { header: 'Indication',   key: 'indication' },
        { header: 'Start Date',   key: 'startDate',   format: fmtCsvDate },
        { header: 'End Date',     key: 'endDate',     format: fmtCsvDate },
        { header: 'Requires Assist', key: 'requiresAssist', format: v => v ? 'Yes' : 'No' },
        { header: 'Refrigerated', key: 'refrigerated', format: v => v ? 'Yes' : 'No' },
      ],
      rows: medications,
    })
  }

  const exportCondsCsv = () => {
    exportCsv({
      filename: `conditions-${selected?.firstName}-${selected?.lastName}`,
      columns: [
        { header: 'Condition',    key: 'conditionName' },
        { header: 'Type',         key: 'conditionType' },
        { header: 'Severity',     key: 'severity' },
        { header: 'Status',       key: 'status' },
        { header: 'ICD Code',     key: 'icdCode' },
        { header: 'Diagnosed Date', key: 'diagnosedDate', format: fmtCsvDate },
        { header: 'Diagnosed By', key: 'diagnosedBy' },
        { header: 'Description',  key: 'description' },
        { header: 'Management Plan', key: 'managementPlan' },
        { header: 'Alerts',       key: 'alerts' },
      ],
      rows: conditions,
    })
  }

  const exportApptsCsv = () => {
    exportCsv({
      filename: `appointments-${selected?.firstName}-${selected?.lastName}`,
      columns: [
        { header: 'Type',         key: 'appointmentType' },
        { header: 'Date',         key: 'appointmentDate', format: fmtCsvDate },
        { header: 'Time',         key: 'appointmentTime' },
        { header: 'Status',       key: 'status' },
        { header: 'Provider',     key: 'providerName' },
        { header: 'Organisation', key: 'providerOrg' },
        { header: 'Location',     key: 'location' },
        { header: 'Purpose',      key: 'purpose' },
        { header: 'Outcome',      key: 'outcome' },
        { header: 'Follow-up Date', key: 'followUpDate', format: fmtCsvDate },
        { header: 'Transport Needed', key: 'requiresTransport', format: v => v ? 'Yes' : 'No' },
        { header: 'Support Worker', key: 'supportWorkerNeeded', format: v => v ? 'Yes' : 'No' },
      ],
      rows: appointments,
    })
  }

  // ── Save handlers ──────────────────────────────────────────────────────────
  const saveMedication = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      const url = editMedId
        ? `/api/tenant/medication-health/participants/${selected.id}/medications/${editMedId}`
        : `/api/tenant/medication-health/participants/${selected.id}/medications`
      const res = await fetchWithAuth(url, {
        method: editMedId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...medForm,
          startDate: medForm.startDate || null,
          endDate:   medForm.endDate   || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
      setShowMed(false); setMedForm({ ...blankMed }); setEditMedId(null)
      fetchTab('medications', selected.id)
      setToast({ message: editMedId ? 'Medication updated' : 'Medication added', type: 'success' })
    } finally { setSaving(false) }
  }

  const saveLog = async () => {
    if (!selected || !logsFor) return
    setSaving(true); setError('')
    try {
      const res = await fetchWithAuth(
        `/api/tenant/medication-health/participants/${selected.id}/medications/${logsFor.id}/logs`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...logForm,
            administeredAt: logForm.administeredAt || null,
          }),
        },
      )
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
      setShowLog(false); setLogForm({ ...blankLog })
      openLogs(logsFor)
    } finally { setSaving(false) }
  }

  const saveCondition = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      const url = editCondId
        ? `/api/tenant/medication-health/participants/${selected.id}/conditions/${editCondId}`
        : `/api/tenant/medication-health/participants/${selected.id}/conditions`
      const res = await fetchWithAuth(url, {
        method: editCondId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...condForm,
          diagnosedDate: condForm.diagnosedDate || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
      setShowCond(false); setCondForm({ ...blankCond }); setEditCondId(null)
      fetchTab('conditions', selected.id)
      setToast({ message: editCondId ? 'Condition updated' : 'Condition added', type: 'success' })
    } finally { setSaving(false) }
  }

  const saveAppointment = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      const url = editApptId
        ? `/api/tenant/medication-health/participants/${selected.id}/appointments/${editApptId}`
        : `/api/tenant/medication-health/participants/${selected.id}/appointments`
      const res = await fetchWithAuth(url, {
        method: editApptId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...apptForm,
          followUpDate: apptForm.followUpDate || null,
          appointmentTime: apptForm.appointmentTime || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Save failed'); return }
      setShowAppt(false); setApptForm({ ...blankAppt }); setEditApptId(null)
      fetchTab('appointments', selected.id)
      setToast({ message: editApptId ? 'Appointment updated' : 'Appointment added', type: 'success' })
    } finally { setSaving(false) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-gray-900">

      {/* ── Left: Participant list ──────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-[#1A6080]/30 bg-white dark:bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-[#1A6080]/30">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Medication & Health</h1>
          <input
            type="text" placeholder="Search participants…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-[#1A6080]/40 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#0E3D52]/20 focus:outline-none"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-gray-400 text-sm">Loading…</div>
          ) : participants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-gray-400 text-sm">
              <span className="text-2xl mb-1">👤</span>No active participants
            </div>
          ) : participants.map(p => (
            <button key={p.id} onClick={() => selectParticipant(p)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-[#1A6080]/30 hover:bg-gray-50 dark:hover:bg-[#0E3D52]/40 transition-colors ${selected?.id === p.id ? 'bg-[#E0EEF4] dark:bg-[#0E3D52]/20 border-l-2 border-l-[#0E3D52]' : ''}`}>
              <p className="font-medium text-sm text-gray-900 dark:text-white">{displayName(p)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{p.fundingBody}{p.ndisNumber ? ` · ${p.ndisNumber}` : ''}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right: Detail panel ────────────────────────────────────────────── */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
          <div className="text-center">
            <div className="text-5xl mb-3">💊</div>
            <p className="text-lg font-medium">Select a participant</p>
            <p className="text-sm mt-1">to view their medication & health records</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-[#1A6080]/30">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="page-premium-title">{displayName(selected)}</h2>
                <p className="page-premium-subtitle mt-0.5">
                  {selected.fundingBody}{selected.ndisNumber ? ` · ${selected.ndisNumber}` : ''}
                </p>
              </div>
              {logsFor && (
                <button onClick={() => { setLogsFor(null) }}
                  className="flex items-center gap-1 text-sm text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] hover:underline">
                  ← Back to medications
                </button>
              )}
            </div>

            {!logsFor && (
              <div className="flex gap-1 mt-4 -mb-px">
                {DETAIL_TABS.map(tab => (
                  <button key={tab} onClick={() => changeTab(tab)}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize transition-colors ${activeTab === tab
                      ? 'bg-gray-50 dark:bg-gray-900 border border-b-0 border-gray-200 dark:border-[#1A6080]/30 text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4]'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                    {tab === 'medications' ? '💊 Medications' : tab === 'conditions' ? '🩺 Conditions' : '📅 Appointments'}
                  </button>
                ))}
              </div>
            )}

            {logsFor && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Admin log — {logsFor.medicationName} {logsFor.dosage || ''}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${medStatusColor[logsFor.status] || ''}`}>
                  {MED_STATUS_LABELS[logsFor.status] || logsFor.status}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">

            {/* ── Medication admin log view ── */}
            {logsFor && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Administration Log ({medLogs.length})</h3>
                  <button onClick={() => { setLogForm({ ...blankLog }); setError(''); setShowLog(true) }}
                    className="px-3 py-1.5 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition-colors">
                    + Log Administration
                  </button>
                </div>
                {subLoading ? <Spinner /> : medLogs.length === 0 ? <Empty label="No administration logs recorded" /> : (
                  <div className="space-y-2">
                    {medLogs.map(log => (
                      <div key={log.id} className="card-premium p-4 flex items-start gap-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${outcomeColor[log.outcome] || ''}`}>
                          {LOG_OUTCOME_LABELS[log.outcome] || log.outcome}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Scheduled: <strong className="text-gray-900 dark:text-white">{fmtDateTime(log.scheduledTime)}</strong></span>
                            {log.administeredAt && <span className="text-gray-400">Given: {fmtDateTime(log.administeredAt)}</span>}
                          </div>
                          {log.administeredBy && <p className="text-xs text-gray-400 mt-0.5">By: {log.administeredBy}</p>}
                          {log.notes && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">{log.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Medications tab ── */}
            {!logsFor && activeTab === 'medications' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Medications ({medications.length})</h3>
                  <div className="flex gap-2">
                    <ExportButton onClick={exportMedsCsv} disabled={medications.length === 0} />
                    <button onClick={() => { setMedForm({ ...blankMed }); setEditMedId(null); setError(''); setShowMed(true) }}
                      className="px-3 py-1.5 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition-colors">
                      + Add Medication
                    </button>
                  </div>
                </div>
                {subLoading ? <Spinner /> : medications.length === 0 ? <Empty label="No medications recorded" /> : (
                  <div className="space-y-3">
                    {medications.map(m => (
                      <div key={m.id} className="group card-premium p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 dark:text-white">{m.medicationName}</p>
                              {m.dosage && <span className="text-sm text-gray-500 dark:text-gray-400">{m.dosage}</span>}
                            </div>
                            {m.genericName && <p className="text-xs text-gray-400 dark:text-gray-500">({m.genericName})</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${medStatusColor[m.status] || ''}`}>
                              {MED_STATUS_LABELS[m.status] || m.status}
                            </span>
                            <button onClick={() => openEditMed(m)} className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] hover:bg-[#E0EEF4] dark:hover:bg-[#0E3D52]/30 rounded transition">Edit</button>
                            <button onClick={() => setConfirm({ message: `Delete medication ${m.medicationName}?`, confirmLabel: 'Delete', onConfirm: () => deleteMedication(m.id) })}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Tag>{MED_FORM_LABELS[m.form] || m.form}</Tag>
                          <Tag>{MED_ROUTE_LABELS[m.route] || m.route}</Tag>
                          {m.frequency && <Tag>{m.frequency}</Tag>}
                          {m.requiresAssist && <Tag color="blue">Requires Assist</Tag>}
                          {m.refrigerated && <Tag color="blue">Refrigerated</Tag>}
                        </div>
                        {m.indication && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Indication: {m.indication}</p>}
                        {m.instructions && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">{m.instructions}</p>}
                        {m.prescribedBy && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Prescribed by: {m.prescribedBy}</p>}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex gap-4 text-xs text-gray-400">
                            {m.startDate && <span>Start: {fmtDate(m.startDate)}</span>}
                            {m.endDate && <span>End: {fmtDate(m.endDate)}</span>}
                          </div>
                          <button onClick={() => openLogs(m)}
                            className="text-xs text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] hover:underline">
                            View log →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Conditions tab ── */}
            {!logsFor && activeTab === 'conditions' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Health Conditions ({conditions.length})</h3>
                  <div className="flex gap-2">
                    <ExportButton onClick={exportCondsCsv} disabled={conditions.length === 0} />
                    <button onClick={() => { setCondForm({ ...blankCond }); setEditCondId(null); setError(''); setShowCond(true) }}
                      className="px-3 py-1.5 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition-colors">
                      + Add Condition
                    </button>
                  </div>
                </div>
                {subLoading ? <Spinner /> : conditions.length === 0 ? <Empty label="No health conditions recorded" /> : (
                  <div className="space-y-3">
                    {conditions.map(c => (
                      <div key={c.id} className="group card-premium p-4">
                        {c.alerts && (
                          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                            <span className="text-red-500 flex-shrink-0">⚠️</span>
                            <p className="text-sm text-red-700 dark:text-red-300">{c.alerts}</p>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{c.conditionName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400">{CONDITION_TYPE_LABELS[c.conditionType] || c.conditionType}</span>
                              {c.icdCode && <span className="text-xs text-gray-400">ICD: {c.icdCode}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityColor[c.severity] || ''}`}>
                              {SEVERITY_LABELS[c.severity] || c.severity}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              c.status === 'active' ? 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/30 dark:text-[#7dcfd7]'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                              {CONDITION_STATUS_LABELS[c.status] || c.status}
                            </span>
                            <button onClick={() => openEditCond(c)} className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] hover:bg-[#E0EEF4] dark:hover:bg-[#0E3D52]/30 rounded transition">Edit</button>
                            <button onClick={() => setConfirm({ message: `Delete condition ${c.conditionName}?`, confirmLabel: 'Delete', onConfirm: () => deleteCondition(c.id) })}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                        {c.description && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{c.description}</p>}
                        {c.managementPlan && (
                          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Management Plan</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{c.managementPlan}</p>
                          </div>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          {c.diagnosedDate && <span>Diagnosed: {fmtDate(c.diagnosedDate)}</span>}
                          {c.diagnosedBy && <span>By: {c.diagnosedBy}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Appointments tab ── */}
            {!logsFor && activeTab === 'appointments' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Health Appointments ({appointments.length})</h3>
                  <div className="flex gap-2">
                    <ExportButton onClick={exportApptsCsv} disabled={appointments.length === 0} />
                    <button onClick={() => { setApptForm({ ...blankAppt }); setEditApptId(null); setError(''); setShowAppt(true) }}
                      className="px-3 py-1.5 bg-[#0E3D52] text-white text-sm rounded-lg hover:bg-[#1A6080] transition-colors">
                      + Add Appointment
                    </button>
                  </div>
                </div>
                {subLoading ? <Spinner /> : appointments.length === 0 ? <Empty label="No appointments recorded" /> : (
                  <div className="space-y-3">
                    {appointments.map(a => (
                      <div key={a.id} className="group card-premium p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {APPT_TYPE_LABELS[a.appointmentType] || a.appointmentType}
                              </p>
                              <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                                {fmtDate(a.appointmentDate)}{a.appointmentTime ? ` at ${a.appointmentTime}` : ''}
                              </span>
                            </div>
                            {(a.providerName || a.providerOrg) && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                {a.providerName}{a.providerOrg ? ` — ${a.providerOrg}` : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${apptStatusColor[a.status] || ''}`}>
                              {APPT_STATUS_LABELS[a.status] || a.status}
                            </span>
                            <button onClick={() => openEditAppt(a)} className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] hover:bg-[#E0EEF4] dark:hover:bg-[#0E3D52]/30 rounded transition">Edit</button>
                            <button onClick={() => setConfirm({ message: `Delete this appointment?`, confirmLabel: 'Delete', onConfirm: () => deleteAppointment(a.id) })}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                        {a.location && <p className="text-xs text-gray-400 mt-1">📍 {a.location}</p>}
                        <div className="flex gap-2 mt-2">
                          {a.requiresTransport && <Tag color="orange">Transport Needed</Tag>}
                          {a.supportWorkerNeeded && <Tag color="purple">Support Worker</Tag>}
                        </div>
                        {a.purpose && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{a.purpose}</p>}
                        {a.outcome && (
                          <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-0.5">Outcome</p>
                            <p className="text-sm text-green-800 dark:text-green-200">{a.outcome}</p>
                          </div>
                        )}
                        {a.followUpDate && (
                          <p className="text-xs text-gray-400 mt-2">Follow-up: {fmtDate(a.followUpDate)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────────────────────────────── */}

      {/* Add Medication */}
      {showMed && (
        <Modal title={editMedId ? 'Edit Medication' : 'Add Medication'} onClose={() => { setShowMed(false); setEditMedId(null) }} onSave={saveMedication} saving={saving} error={error} wide>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Medication Name *</Label>
              <Input value={medForm.medicationName} onChange={v => setMedForm(f => ({ ...f, medicationName: v }))} placeholder="e.g. Metformin" />
            </div>
            <div>
              <Label>Generic Name</Label>
              <Input value={medForm.genericName} onChange={v => setMedForm(f => ({ ...f, genericName: v }))} />
            </div>
            <div>
              <Label>Dosage</Label>
              <Input value={medForm.dosage} onChange={v => setMedForm(f => ({ ...f, dosage: v }))} placeholder="e.g. 500mg" />
            </div>
            <div>
              <Label>Form</Label>
              <Select value={medForm.form} onChange={v => setMedForm(f => ({ ...f, form: v }))}>
                {MED_FORMS.map(f => <option key={f} value={f}>{MED_FORM_LABELS[f]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Route</Label>
              <Select value={medForm.route} onChange={v => setMedForm(f => ({ ...f, route: v }))}>
                {MED_ROUTES.map(r => <option key={r} value={r}>{MED_ROUTE_LABELS[r]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Frequency</Label>
              <Input value={medForm.frequency} onChange={v => setMedForm(f => ({ ...f, frequency: v }))} placeholder="e.g. Twice daily with meals" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={medForm.status} onChange={v => setMedForm(f => ({ ...f, status: v }))}>
                {MED_STATUSES.map(s => <option key={s} value={s}>{MED_STATUS_LABELS[s]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={medForm.startDate} onChange={v => setMedForm(f => ({ ...f, startDate: v }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={medForm.endDate} onChange={v => setMedForm(f => ({ ...f, endDate: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Prescribed By</Label>
              <Input value={medForm.prescribedBy} onChange={v => setMedForm(f => ({ ...f, prescribedBy: v }))} placeholder="Doctor / specialist name" />
            </div>
            <div className="col-span-2">
              <Label>Indication (reason)</Label>
              <Input value={medForm.indication} onChange={v => setMedForm(f => ({ ...f, indication: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Administration Instructions</Label>
              <Textarea value={medForm.instructions} onChange={v => setMedForm(f => ({ ...f, instructions: v }))} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea value={medForm.notes} onChange={v => setMedForm(f => ({ ...f, notes: v }))} rows={2} />
            </div>
            <div className="col-span-2 flex gap-6">
              <Checkbox label="Requires support worker assistance" checked={medForm.requiresAssist}
                onChange={v => setMedForm(f => ({ ...f, requiresAssist: v }))} />
              <Checkbox label="Requires refrigeration" checked={medForm.refrigerated}
                onChange={v => setMedForm(f => ({ ...f, refrigerated: v }))} />
            </div>
          </div>
        </Modal>
      )}

      {/* Log Administration */}
      {showLog && (
        <Modal title={`Log: ${logsFor?.medicationName}`} onClose={() => setShowLog(false)} onSave={saveLog} saving={saving} error={error}>
          <div className="space-y-3">
            <div>
              <Label>Scheduled Time *</Label>
              <Input type="datetime-local" value={logForm.scheduledTime} onChange={v => setLogForm(f => ({ ...f, scheduledTime: v }))} />
            </div>
            <div>
              <Label>Outcome</Label>
              <Select value={logForm.outcome} onChange={v => setLogForm(f => ({ ...f, outcome: v }))}>
                {LOG_OUTCOMES.map(o => <option key={o} value={o}>{LOG_OUTCOME_LABELS[o]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Administered At</Label>
              <Input type="datetime-local" value={logForm.administeredAt} onChange={v => setLogForm(f => ({ ...f, administeredAt: v }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={logForm.notes} onChange={v => setLogForm(f => ({ ...f, notes: v }))} rows={3} />
            </div>
          </div>
        </Modal>
      )}

      {/* Add Health Condition */}
      {showCond && (
        <Modal title={editCondId ? 'Edit Health Condition' : 'Add Health Condition'} onClose={() => { setShowCond(false); setEditCondId(null) }} onSave={saveCondition} saving={saving} error={error} wide>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Condition Name *</Label>
              <Input value={condForm.conditionName} onChange={v => setCondForm(f => ({ ...f, conditionName: v }))} placeholder="e.g. Type 2 Diabetes" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={condForm.conditionType} onChange={v => setCondForm(f => ({ ...f, conditionType: v }))}>
                {CONDITION_TYPES.map(t => <option key={t} value={t}>{CONDITION_TYPE_LABELS[t]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={condForm.severity} onChange={v => setCondForm(f => ({ ...f, severity: v }))}>
                {SEVERITIES.map(s => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}
              </Select>
            </div>
            <div>
              <Label>ICD Code</Label>
              <Input value={condForm.icdCode} onChange={v => setCondForm(f => ({ ...f, icdCode: v }))} placeholder="e.g. E11" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={condForm.status} onChange={v => setCondForm(f => ({ ...f, status: v }))}>
                {CONDITION_STATUSES.map(s => <option key={s} value={s}>{CONDITION_STATUS_LABELS[s]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Diagnosed Date</Label>
              <Input type="date" value={condForm.diagnosedDate} onChange={v => setCondForm(f => ({ ...f, diagnosedDate: v }))} />
            </div>
            <div>
              <Label>Diagnosed By</Label>
              <Input value={condForm.diagnosedBy} onChange={v => setCondForm(f => ({ ...f, diagnosedBy: v }))} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Textarea value={condForm.description} onChange={v => setCondForm(f => ({ ...f, description: v }))} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>Management Plan</Label>
              <Textarea value={condForm.managementPlan} onChange={v => setCondForm(f => ({ ...f, managementPlan: v }))} rows={3} />
            </div>
            <div className="col-span-2">
              <Label>Alerts / Warnings (shown prominently)</Label>
              <Input value={condForm.alerts} onChange={v => setCondForm(f => ({ ...f, alerts: v }))} placeholder="e.g. Anaphylaxis risk — carry EpiPen" />
            </div>
          </div>
        </Modal>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {/* Add Appointment */}
      {showAppt && (
        <Modal title={editApptId ? 'Edit Appointment' : 'Add Appointment'} onClose={() => { setShowAppt(false); setEditApptId(null) }} onSave={saveAppointment} saving={saving} error={error} wide>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Appointment Type</Label>
              <Select value={apptForm.appointmentType} onChange={v => setApptForm(f => ({ ...f, appointmentType: v }))}>
                {APPT_TYPES.map(t => <option key={t} value={t}>{APPT_TYPE_LABELS[t]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={apptForm.status} onChange={v => setApptForm(f => ({ ...f, status: v }))}>
                {APPT_STATUSES.map(s => <option key={s} value={s}>{APPT_STATUS_LABELS[s]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={apptForm.appointmentDate} onChange={v => setApptForm(f => ({ ...f, appointmentDate: v }))} />
            </div>
            <div>
              <Label>Time</Label>
              <Input type="time" value={apptForm.appointmentTime} onChange={v => setApptForm(f => ({ ...f, appointmentTime: v }))} />
            </div>
            <div>
              <Label>Provider Name</Label>
              <Input value={apptForm.providerName} onChange={v => setApptForm(f => ({ ...f, providerName: v }))} placeholder="Dr. Smith" />
            </div>
            <div>
              <Label>Provider Organisation</Label>
              <Input value={apptForm.providerOrg} onChange={v => setApptForm(f => ({ ...f, providerOrg: v }))} placeholder="City Medical Centre" />
            </div>
            <div className="col-span-2">
              <Label>Location</Label>
              <Input value={apptForm.location} onChange={v => setApptForm(f => ({ ...f, location: v }))} placeholder="Address or telehealth" />
            </div>
            <div className="col-span-2">
              <Label>Purpose</Label>
              <Textarea value={apptForm.purpose} onChange={v => setApptForm(f => ({ ...f, purpose: v }))} rows={2} />
            </div>
            <div className="col-span-2">
              <Label>Outcome (fill after appointment)</Label>
              <Textarea value={apptForm.outcome} onChange={v => setApptForm(f => ({ ...f, outcome: v }))} rows={2} />
            </div>
            <div>
              <Label>Follow-up Date</Label>
              <Input type="date" value={apptForm.followUpDate} onChange={v => setApptForm(f => ({ ...f, followUpDate: v }))} />
            </div>
            <div>
              <Label>Follow-up Notes</Label>
              <Input value={apptForm.followUpNotes} onChange={v => setApptForm(f => ({ ...f, followUpNotes: v }))} />
            </div>
            <div className="col-span-2 flex gap-6">
              <Checkbox label="Transport required" checked={apptForm.requiresTransport}
                onChange={v => setApptForm(f => ({ ...f, requiresTransport: v }))} />
              <Checkbox label="Support worker needed" checked={apptForm.supportWorkerNeeded}
                onChange={v => setApptForm(f => ({ ...f, supportWorkerNeeded: v }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function Tag({ children, color = 'gray' }: { children: React.ReactNode; color?: 'gray' | 'blue' | 'orange' | 'purple' }) {
  const colors: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    blue:   'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52]/30 dark:text-[#7dcfd7]',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    purple: 'bg-[#E0EEF4] text-[#0E3D52] dark:bg-[#0E3D52] dark:text-[#4ebac4]',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[color]}`}>{children}</span>
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
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-[#1A6080]/40 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#0E3D52]/20 focus:outline-none" />
  )
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-[#1A6080]/40 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#0E3D52]/20 focus:outline-none">
      {children}
    </select>
  )
}

function Textarea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-[#1A6080]/40 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-[#0E3D52]/20 focus:outline-none resize-none" />
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 text-[#0E3D52] dark:text-[#4ebac4] rounded" />
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  )
}

function Modal({ title, onClose, onSave, saving, error, children, wide }: {
  title: string; onClose: () => void; onSave: () => void
  saving: boolean; error: string; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="modal-overlay">
      <div className={`bg-white dark:bg-[#0F1E2E] rounded-xl shadow-xl flex flex-col max-h-[90vh] ${wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[#1A6080]/30">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {error && <p className="px-6 text-sm text-red-600 dark:text-red-400 pb-2">{error}</p>}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-[#1A6080]/30">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 dark:border-[#1A6080]/40 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-[#0E3D52]/40 transition-colors">
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
