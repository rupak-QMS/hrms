'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { SkeletonPage } from '@/components/ui/Skeleton'

type Employee = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  preferredName: string | null
  dateOfBirth: string | null
  gender: string | null
  phone: string | null
  email: string
  address: string | null
  photoUrl: string | null
  entityName: string | null
  departmentName: string | null
  positionTitle: string | null
  departmentId: string | null
  positionId: string | null
  employmentType: string
  awardClassification: string | null
  payLevel: string | null
  annualSalary: string | null
  ordinaryHoursPerWeek: string | null
  startDate: string
  probationEndDate: string | null
  endDate: string | null
  isActive: boolean
  complianceStatus: string
  ndisWorker: boolean
  createdAt: string
  updatedAt: string
}

function calcCompleteness(emp: Employee): { pct: number; missing: string[] } {
  const checks: { label: string; filled: boolean }[] = [
    { label: 'Phone number',    filled: !!emp.phone },
    { label: 'Date of birth',   filled: !!emp.dateOfBirth },
    { label: 'Address',         filled: !!emp.address },
    { label: 'Gender',          filled: !!emp.gender },
    { label: 'Position',        filled: !!emp.positionId },
    { label: 'Department',      filled: !!emp.departmentId },
    { label: 'Annual salary',   filled: !!emp.annualSalary },
    { label: 'Profile photo',   filled: !!emp.photoUrl },
    { label: 'Start date',      filled: !!emp.startDate },
    { label: 'Employment type', filled: !!emp.employmentType },
  ]
  const filled  = checks.filter(c => c.filled).length
  const missing = checks.filter(c => !c.filled).map(c => c.label)
  return { pct: Math.round((filled / checks.length) * 100), missing }
}

const COMPLIANCE_BADGE: Record<string, { label: string; cls: string }> = {
  green:   { label: 'Compliant',     cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  amber:   { label: 'Needs Review',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  red:     { label: 'Non-Compliant', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  pending: { label: 'Pending',       cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
}

const EMP_TYPE_LABEL: Record<string, string> = {
  full_time:'Full-time', part_time:'Part-time', casual:'Casual', contractor:'Contractor', volunteer:'Volunteer',
}

const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' }) : '—'
const age  = (d: string | null) => {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  return ` (${Math.floor(diff / (365.25*24*3600*1000))} yrs)`
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="sm:w-44 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-sm text-gray-800 dark:text-gray-200">{value ?? '—'}</span>
    </div>
  )
}

const TABS = ['Overview', 'Employment', 'Emergency Contacts', 'Compliance', 'Documents', 'Training', 'Promotions', 'Notes'] as const
type Tab = typeof TABS[number]

type PromotionRecord = {
  id: string; raisedByName: string | null
  currentTitle: string | null; currentSalary: number | null
  proposedTitle: string; proposedSalary: number | null
  effectiveDate: string | null; justification: string
  status: string; reviewedBy: string | null; reviewedAt: string | null
  reviewNotes: string | null; implementedAt: string | null; createdAt: string
}

type ScreeningRecord = {
  id: string
  checkType: string
  status: string
  referenceNumber: string | null
  issuedDate: string | null
  expiryDate: string | null
  notes: string | null
}

type EmployeeDoc = {
  id: string
  category: string
  title: string
  blobUrl: string
  fileName: string | null
  fileSizeBytes: number | null
  mimeType: string | null
  status: string
  expiryDate: string | null
  createdAt: string
}

type EmergencyContact = {
  id: string
  name: string
  relationship: string | null
  phone: string | null
  email: string | null
  isPrimary: boolean
}

type TrainingRecord = {
  id: string; courseId: string; courseTitle: string | null; courseCategory: string | null
  courseMandatory: boolean | null; courseValidity: number | null
  status: string; completedAt: string | null; expiryDate: string | null
  score: string | null; attempts: number; certificateUrl: string | null; createdAt: string
}

type Course = { id: string; title: string; category: string | null; isMandatory: boolean }

const BLANK_CONTACT = { name: '', relationship: '', phone: '', email: '', isPrimary: false }

export default function EmployeeProfilePage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [emp,     setEmp]    = useState<Employee | null>(null)
  const [loading, setLoading]= useState(true)
  const [tab,     setTab]    = useState<Tab>('Overview')
  const [saving,  setSaving] = useState(false)
  const [toast,   setToast]  = useState<ToastState>(null)
  const { markDirty, markClean } = useUnsavedChanges()

  // Emergency contacts state
  const [contacts,      setContacts]      = useState<EmergencyContact[]>([])
  const [contactsLoaded, setContactsLoaded] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact,  setEditingContact]  = useState<EmergencyContact | null>(null)
  const [contactForm,    setContactForm]    = useState(BLANK_CONTACT)
  const [contactSaving,  setContactSaving]  = useState(false)
  const [contactError,   setContactError]   = useState('')
  const [deletingContact, setDeletingContact] = useState<string | null>(null)

  // Compliance screening state
  const [screening,        setScreening]        = useState<ScreeningRecord[]>([])
  const [screeningLoaded,  setScreeningLoaded]  = useState(false)

  // Documents state
  const [docs,       setDocs]       = useState<EmployeeDoc[]>([])
  const [docsLoaded, setDocsLoaded] = useState(false)

  // Promotions state
  const [promotions,       setPromotions]       = useState<PromotionRecord[]>([])
  const [promotionsLoaded, setPromotionsLoaded] = useState(false)
  const [showPromoForm,    setShowPromoForm]    = useState(false)
  const [promoSaving,      setPromoSaving]      = useState(false)
  const [promoUpdating,    setPromoUpdating]    = useState<string | null>(null)
  const [promoForm, setPromoForm] = useState({
    type: 'promotion', proposedTitle: '', proposedSalary: '', effectiveDate: '', justification: '',
  })
  const [reviewModal,  setReviewModal]  = useState<{ id: string; action: 'approved' | 'rejected' | 'implemented' } | null>(null)
  const [reviewNotes,  setReviewNotes]  = useState('')

  // Training state
  const [training,        setTraining]        = useState<TrainingRecord[]>([])
  const [trainingLoaded,  setTrainingLoaded]  = useState(false)
  const [courses,         setCourses]         = useState<Course[]>([])
  const [showEnrolModal,  setShowEnrolModal]  = useState(false)
  const [enrolCourseId,   setEnrolCourseId]   = useState('')
  const [enrolSaving,     setEnrolSaving]     = useState(false)
  const [trainingUpdating, setTrainingUpdating] = useState<string | null>(null)

  // Notes state
  const [notes,        setNotes]        = useState<{ id: string; authorId: string; authorEmail: string; content: string; createdAt: string }[]>([])
  const [notesLoaded,  setNotesLoaded]  = useState(false)
  const [noteContent,  setNoteContent]  = useState('')
  const [noteSaving,   setNoteSaving]   = useState(false)
  const [deletingNote, setDeletingNote] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Photo upload state
  const [photoUploading, setPhotoUploading] = useState(false)

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !emp) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setToast({ message: 'Please select a JPG, PNG, WebP or GIF image.', type: 'error' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: 'Image must be smaller than 2 MB.', type: 'error' })
      return
    }
    setPhotoUploading(true)
    try {
      const reader = new FileReader()
      const dataUrl: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const res = await fetchWithAuth(`/api/tenant/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: dataUrl }),
      })
      if (res.ok) {
        const d = await res.json()
        setEmp(d.employee ?? emp)
        setToast({ message: 'Photo updated', type: 'success' })
      } else {
        setToast({ message: 'Failed to save photo. Please try again.', type: 'error' })
      }
    } catch {
      setToast({ message: 'Upload failed. Please try again.', type: 'error' })
    } finally {
      setPhotoUploading(false)
    }
  }

  useEffect(() => {
    fetchWithAuth(`/api/tenant/employees/${id}`)
      .then(r => r.json())
      .then(d => { setEmp(d.employee ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  // Load emergency contacts when that tab is first opened
  useEffect(() => {
    if (tab === 'Emergency Contacts' && !contactsLoaded) {
      fetchWithAuth(`/api/tenant/employees/${id}/emergency-contacts`)
        .then(r => r.json())
        .then(d => { setContacts(d.contacts ?? []); setContactsLoaded(true) })
        .catch(() => setContactsLoaded(true))
    }
  }, [tab, id, contactsLoaded])

  // Load screening records when Compliance tab is first opened
  useEffect(() => {
    if (tab === 'Compliance' && !screeningLoaded) {
      fetchWithAuth(`/api/tenant/compliance/screening?employeeId=${id}`)
        .then(r => r.json())
        .then(d => { setScreening(d.records ?? []); setScreeningLoaded(true) })
        .catch(() => setScreeningLoaded(true))
    }
  }, [tab, id, screeningLoaded])

  // Load documents when Documents tab is first opened
  useEffect(() => {
    if (tab === 'Documents' && !docsLoaded) {
      fetchWithAuth(`/api/tenant/documents?employeeId=${id}`)
        .then(r => r.json())
        .then(d => { setDocs(d.documents ?? []); setDocsLoaded(true) })
        .catch(() => setDocsLoaded(true))
    }
  }, [tab, id, docsLoaded])

  // Load promotions when Promotions tab is first opened
  useEffect(() => {
    if (tab === 'Promotions' && !promotionsLoaded) {
      fetchWithAuth(`/api/tenant/promotions?employeeId=${id}`)
        .then(r => r.json())
        .then(d => { setPromotions(d.promotions ?? []); setPromotionsLoaded(true) })
        .catch(() => setPromotionsLoaded(true))
    }
  }, [tab, id, promotionsLoaded])

  // Load notes when Notes tab is first opened
  useEffect(() => {
    if (tab === 'Notes' && !notesLoaded) {
      fetchWithAuth(`/api/tenant/employees/${id}/notes`)
        .then(r => r.json())
        .then(d => { setNotes(d.notes ?? []); setNotesLoaded(true) })
        .catch(() => setNotesLoaded(true))
    }
  }, [tab, id, notesLoaded])

  // Fetch current user session info (for own-note detection)
  useEffect(() => {
    fetchWithAuth('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d?.user?.sub) setCurrentUserId(d.user.sub) })
      .catch(() => {})
  }, [])

  // Load training records + course library when Training tab is first opened
  useEffect(() => {
    if (tab === 'Training' && !trainingLoaded) {
      Promise.all([
        fetchWithAuth(`/api/tenant/training/records?employeeId=${id}`).then(r => r.json()),
        fetchWithAuth('/api/tenant/training/courses').then(r => r.json()),
      ]).then(([recs, crss]) => {
        setTraining(recs.records ?? [])
        setCourses(crss.courses ?? [])
        setTrainingLoaded(true)
      }).catch(() => setTrainingLoaded(true))
    }
  }, [tab, id, trainingLoaded])

  async function enrolEmployee() {
    if (!enrolCourseId) return
    setEnrolSaving(true)
    await fetchWithAuth('/api/tenant/training/records', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: id, courseId: enrolCourseId }),
    })
    const res = await fetchWithAuth(`/api/tenant/training/records?employeeId=${id}`)
    const d   = await res.json()
    setTraining(d.records ?? [])
    setEnrolCourseId(''); setShowEnrolModal(false); setEnrolSaving(false)
  }

  async function markTrainingComplete(recordId: string) {
    setTrainingUpdating(recordId)
    await fetchWithAuth('/api/tenant/training/records', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: recordId, status: 'completed' }),
    })
    const res = await fetchWithAuth(`/api/tenant/training/records?employeeId=${id}`)
    const d   = await res.json()
    setTraining(d.records ?? [])
    setTrainingUpdating(null)
  }

  async function raisePromotion(e: React.FormEvent) {
    e.preventDefault()
    if (!emp) return
    setPromoSaving(true)
    const isHike = promoForm.type === 'salary_hike'
    const payload = {
      employeeId:     id,
      currentTitle:   emp.positionTitle,
      currentSalary:  emp.annualSalary ? Math.round(Number(emp.annualSalary)) : null,
      proposedTitle:  isHike ? emp.positionTitle : promoForm.proposedTitle,
      proposedSalary: promoForm.proposedSalary ? Number(promoForm.proposedSalary) : null,
      effectiveDate:  promoForm.effectiveDate || null,
      justification:  promoForm.justification,
      raisedByName:   'HR',
    }
    const res = await fetchWithAuth('/api/tenant/promotions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setPromoSaving(false)
    if (res.ok) {
      setShowPromoForm(false)
      setPromoForm({ type: 'promotion', proposedTitle: '', proposedSalary: '', effectiveDate: '', justification: '' })
      setPromotionsLoaded(false) // force reload
    }
  }

  async function updatePromoStatus(promoId: string, status: string, notes?: string) {
    setPromoUpdating(promoId)
    await fetchWithAuth(`/api/tenant/promotions/${promoId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reviewNotes: notes }),
    })
    setPromoUpdating(null)
    setReviewModal(null)
    setReviewNotes('')
    setPromotionsLoaded(false) // force reload
  }

  // ── Letter generation helpers ──────────────────────────────────────────────

  function printWindow(title: string, html: string) {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.7;margin:50px 65px;color:#111}
      h1{font-size:15pt;margin-bottom:2px}.org{font-size:10pt;color:#555;margin-bottom:20px}
      .divider{border:none;border-top:2px solid #1a4fff;margin:16px 0}
      pre{font-family:inherit;white-space:pre-wrap}
      .label{font-weight:bold;min-width:180px;display:inline-block}
      .row{margin:4px 0}
      @media print{body{margin:25px 45px}}
    </style></head><body>${html}
    <script>window.onload=()=>{window.print()}<\/script></body></html>`)
    win.document.close()
  }

  function letterHeader(refId: string) {
    const date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    return `<h1>Yahweh Care Pty Ltd</h1><div class="org">ABN: [ABN] &nbsp;|&nbsp; [Address] &nbsp;|&nbsp; [Phone]</div>
    <hr class="divider"/><div class="row"><span class="label">Date:</span>${date}</div>
    <div class="row"><span class="label">Reference:</span>${refId.slice(0,8).toUpperCase()}</div>`
  }

  function printNominationLetter(p: PromotionRecord) {
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'
    const isHike  = p.proposedTitle === p.currentTitle || p.proposedTitle === emp?.positionTitle
    const subject = isHike ? 'Annual Salary Review — Recommendation' : `Promotion Nomination — ${p.proposedTitle}`
    printWindow(subject, `
      ${letterHeader(p.id)}
      <br/>
      <div class="row"><span class="label">To:</span>Hiring Committee / Director</div>
      <div class="row"><span class="label">Re:</span>${empName} — ${subject}</div>
      <hr class="divider"/>
      <p><strong>Dear Committee,</strong></p>
      <p>I am pleased to nominate <strong>${empName}</strong>${p.currentTitle ? `, currently holding the position of <em>${p.currentTitle}</em>,` : ''} for the following change effective <strong>${p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('en-AU') : '[Effective Date]'}</strong>.</p>
      <br/>
      <div class="row"><span class="label">Current Title:</span>${p.currentTitle || '—'}</div>
      <div class="row"><span class="label">Proposed Title:</span>${p.proposedTitle}</div>
      ${p.currentSalary  ? `<div class="row"><span class="label">Current Salary:</span>$${Number(p.currentSalary).toLocaleString()} p.a.</div>` : ''}
      ${p.proposedSalary ? `<div class="row"><span class="label">Proposed Salary:</span>$${Number(p.proposedSalary).toLocaleString()} p.a.</div>` : ''}
      ${(p.currentSalary && p.proposedSalary) ? `<div class="row"><span class="label">Increase:</span>$${(Number(p.proposedSalary)-Number(p.currentSalary)).toLocaleString()} (${(((Number(p.proposedSalary)-Number(p.currentSalary))/Number(p.currentSalary))*100).toFixed(1)}%)</div>` : ''}
      <br/>
      <p><strong>Justification:</strong></p>
      <p>${p.justification}</p>
      <br/>
      <p>I trust this nomination will receive favourable consideration.</p>
      <br/><br/>
      <p>___________________________</p>
      <p>[Nominating Manager / HR]<br/>[Title]<br/>Yahweh Care Pty Ltd</p>
    `)
  }

  function printApprovalLetter(p: PromotionRecord) {
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'
    printWindow(`Promotion Approval — ${empName}`, `
      ${letterHeader(p.id)}
      <br/>
      <div class="row"><span class="label">To:</span>${empName}</div>
      ${emp?.email ? `<div class="row"><span class="label">Email:</span>${emp.email}</div>` : ''}
      <hr class="divider"/>
      <p>Dear <strong>${emp?.firstName || empName}</strong>,</p>
      <p>On behalf of Yahweh Care Pty Ltd, I am delighted to inform you that your promotion nomination has been <strong>approved</strong>.</p>
      <br/>
      <div class="row"><span class="label">New Position:</span><strong>${p.proposedTitle}</strong></div>
      ${p.currentTitle ? `<div class="row"><span class="label">Previous Position:</span>${p.currentTitle}</div>` : ''}
      ${p.proposedSalary ? `<div class="row"><span class="label">New Annual Salary:</span><strong>$${Number(p.proposedSalary).toLocaleString()}</strong> per annum</div>` : ''}
      <div class="row"><span class="label">Effective Date:</span>${p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('en-AU') : '[Effective Date]'}</div>
      ${p.reviewNotes ? `<br/><p><em>Notes: ${p.reviewNotes}</em></p>` : ''}
      <br/>
      <p>We congratulate you on this achievement and look forward to your continued contribution to the team.</p>
      <p>Please sign and return a copy of this letter to acknowledge acceptance of this offer.</p>
      <br/><br/>
      <p>Yours sincerely,</p><br/>
      <p>___________________________</p>
      <p>[Director / HR Manager]<br/>Yahweh Care Pty Ltd</p>
      <br/><br/><br/>
      <p>------- ACKNOWLEDGEMENT -------</p>
      <p>I, <strong>${empName}</strong>, acknowledge receipt of this promotion letter and accept the terms as stated above.</p>
      <br/>
      <p>Signature: ___________________________ &nbsp;&nbsp; Date: _______________</p>
    `)
  }

  function printDesignationLetter(p: PromotionRecord) {
    const empName = emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'
    printWindow(`New Designation Letter — ${empName}`, `
      ${letterHeader(p.id)}
      <br/>
      <div class="row"><span class="label">To:</span>${empName}</div>
      ${emp?.email ? `<div class="row"><span class="label">Email:</span>${emp.email}</div>` : ''}
      <hr class="divider"/>
      <p>Dear <strong>${emp?.firstName || empName}</strong>,</p>
      <p>This letter serves to formally confirm your <strong>change of designation</strong> within Yahweh Care Pty Ltd, effective <strong>${p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('en-AU') : '[Effective Date]'}</strong>.</p>
      <br/>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Previous Designation</td><td style="padding:6px 12px;border:1px solid #ddd">${p.currentTitle || '—'}</td></tr>
        <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">New Designation</td><td style="padding:6px 12px;border:1px solid #ddd"><strong>${p.proposedTitle}</strong></td></tr>
        <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Department</td><td style="padding:6px 12px;border:1px solid #ddd">${emp?.departmentName || '[Department]'}</td></tr>
        <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Entity</td><td style="padding:6px 12px;border:1px solid #ddd">${emp?.entityName || 'Yahweh Care Pty Ltd'}</td></tr>
        <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Effective Date</td><td style="padding:6px 12px;border:1px solid #ddd">${p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('en-AU') : '—'}</td></tr>
      </table>
      <br/>
      <p>All other terms and conditions of your employment remain unchanged unless separately notified in writing.</p>
      <p>Please retain this letter for your records. A copy will be maintained in your personnel file.</p>
      <br/><br/>
      <p>Yours sincerely,</p><br/>
      <p>___________________________</p>
      <p>[Director / People & Culture]<br/>Yahweh Care Pty Ltd</p>
    `)
  }

  function printSalaryLetter(p: PromotionRecord) {
    const empName  = emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'
    const isHike   = p.proposedTitle === p.currentTitle || !p.currentTitle || p.proposedTitle === emp?.positionTitle
    const letterT  = isHike ? 'Annual Salary Review' : 'Salary Increment'
    const increase = (p.currentSalary && p.proposedSalary) ? Number(p.proposedSalary) - Number(p.currentSalary) : null
    const pct      = (increase && p.currentSalary) ? ((increase / Number(p.currentSalary)) * 100).toFixed(2) : null
    printWindow(`${letterT} Letter — ${empName}`, `
      ${letterHeader(p.id)}
      <br/>
      <div class="row"><span class="label">To:</span>${empName}</div>
      ${emp?.email ? `<div class="row"><span class="label">Email:</span>${emp.email}</div>` : ''}
      <hr class="divider"/>
      <p>Dear <strong>${emp?.firstName || empName}</strong>,</p>
      <p>We are pleased to inform you that following the ${isHike ? 'annual salary review' : 'review of your performance and contribution'}, your remuneration has been revised effective <strong>${p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('en-AU') : '[Effective Date]'}</strong>.</p>
      <br/>
      <table style="border-collapse:collapse;width:100%">
        ${p.currentSalary  ? `<tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Previous Annual Salary</td><td style="padding:6px 12px;border:1px solid #ddd">$${Number(p.currentSalary).toLocaleString('en-AU', {minimumFractionDigits:2})}</td></tr>` : ''}
        ${p.proposedSalary ? `<tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Revised Annual Salary</td><td style="padding:6px 12px;border:1px solid #ddd"><strong>$${Number(p.proposedSalary).toLocaleString('en-AU', {minimumFractionDigits:2})}</strong></td></tr>` : ''}
        ${increase !== null ? `<tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Increment Amount</td><td style="padding:6px 12px;border:1px solid #ddd">$${increase.toLocaleString('en-AU', {minimumFractionDigits:2})}${pct ? ` (${pct}% increase)` : ''}</td></tr>` : ''}
        <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Position</td><td style="padding:6px 12px;border:1px solid #ddd">${p.proposedTitle || emp?.positionTitle || '—'}</td></tr>
        <tr><td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold">Effective Date</td><td style="padding:6px 12px;border:1px solid #ddd">${p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString('en-AU') : '—'}</td></tr>
      </table>
      <br/>
      <p>This revision reflects our appreciation for your ongoing dedication and contribution to Yahweh Care Pty Ltd. All other terms and conditions of employment remain unchanged.</p>
      <p>Please do not hesitate to contact the People & Culture team if you have any questions.</p>
      <br/><br/>
      <p>Yours sincerely,</p><br/>
      <p>___________________________</p>
      <p>[Director / People & Culture]<br/>Yahweh Care Pty Ltd</p>
    `)
  }

  function openAddContact() {
    setEditingContact(null)
    setContactForm(BLANK_CONTACT)
    setContactError('')
    setShowContactForm(true)
  }

  function openEditContact(c: EmergencyContact) {
    setEditingContact(c)
    setContactForm({ name: c.name, relationship: c.relationship ?? '', phone: c.phone ?? '', email: c.email ?? '', isPrimary: c.isPrimary })
    setContactError('')
    setShowContactForm(true)
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault()
    setContactSaving(true)
    setContactError('')
    try {
      const payload = { ...contactForm, relationship: contactForm.relationship || null, phone: contactForm.phone || null, email: contactForm.email || null }
      const res = editingContact
        ? await fetchWithAuth(`/api/tenant/employees/${id}/emergency-contacts`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: editingContact.id, ...payload }) })
        : await fetchWithAuth(`/api/tenant/employees/${id}/emergency-contacts`, { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const d = await res.json(); setContactError(d.error ?? 'Failed to save'); return }
      // Refresh list
      const refreshed = await fetchWithAuth(`/api/tenant/employees/${id}/emergency-contacts`).then(r => r.json())
      setContacts(refreshed.contacts ?? [])
      markClean()
      setShowContactForm(false)
    } catch {
      setContactError('Network error — please try again.')
    } finally {
      setContactSaving(false)
    }
  }

  async function deleteContact(contactId: string) {
    setDeletingContact(contactId)
    try {
      await fetchWithAuth(`/api/tenant/employees/${id}/emergency-contacts`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId }) })
      setContacts(prev => prev.filter(c => c.id !== contactId))
    } finally {
      setDeletingContact(null)
    }
  }

  async function toggleActive() {
    if (!emp) return
    setSaving(true)
    const res  = await fetchWithAuth(`/api/tenant/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !emp.isActive }),
    })
    const data = await res.json()
    if (res.ok) { setEmp(data.employee); setToast({ message: data.employee.isActive ? 'Employee activated' : 'Employee deactivated', type: 'success' }) }
    setSaving(false)
  }

  async function setCompliance(status: string) {
    if (!emp) return
    setSaving(true)
    const res  = await fetchWithAuth(`/api/tenant/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complianceStatus: status }),
    })
    const data = await res.json()
    if (res.ok) { setEmp(data.employee); setToast({ message: 'Compliance status updated', type: 'success' }) }
    setSaving(false)
  }

  if (loading) return <SkeletonPage rows={4} />
  if (!emp)    return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <span className="text-5xl"></span>
      <p className="text-gray-500 dark:text-gray-400">Employee not found</p>
      <Link href="/tenant/employee-management" className="text-sm text-blue-500">← Back to Employees</Link>
    </div>
  )

  const badge    = COMPLIANCE_BADGE[emp.complianceStatus] ?? COMPLIANCE_BADGE.pending
  const fullName = `${emp.firstName} ${emp.lastName}`
  const initials = `${emp.firstName[0] ?? ''}${emp.lastName[0] ?? ''}`

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Back */}
      <Link href="/tenant/employee-management" className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-700 dark:text-gray-200 transition">
        ← All Employees
      </Link>

      {/* Profile header card */}
      <div className="card-premium rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {/* Avatar / photo upload */}
          <label className="relative group cursor-pointer shrink-0" title="Click to upload photo">
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold"
              style={{ background: emp.photoUrl ? 'transparent' : 'var(--primary)' }}>
              {emp.photoUrl
                ? <img src={emp.photoUrl} alt={fullName} className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
              <span className="text-white text-xs font-medium">{photoUploading ? '…' : '📷'}</span>
            </div>
          </label>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="page-premium-title">{fullName}</h1>
              {emp.ndisWorker && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  NDIS Worker
                </span>
              )}
            </div>
            {emp.preferredName && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Goes by "{emp.preferredName}"</p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {emp.employeeNumber}
              </span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                {EMP_TYPE_LABEL[emp.employmentType] ?? emp.employmentType}
              </span>
              {emp.positionTitle && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {emp.positionTitle}
                </span>
              )}
              {emp.departmentName && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  {emp.departmentName}
                </span>
              )}
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            <Link
              href={`/tenant/employee-management/${id}/edit`}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white text-center"
              style={{ background: 'var(--primary)' }}
            >
              ️ Edit
            </Link>
            <button
              onClick={toggleActive}
              disabled={saving}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                emp.isActive
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'
              }`}
            >
              {emp.isActive ? '⏸ Deactivate' : '▶ Reactivate'}
            </button>
          </div>
        </div>
      </div>

      {/* Profile Completeness */}
      {(() => {
        const { pct, missing } = calcCompleteness(emp)
        const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
        return (
          <div className="card-premium mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile completeness</span>
              <span className={`text-sm font-bold ${pct >= 80 ? 'text-green-600 dark:text-green-400' : pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                {pct}%
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mb-3">
              <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
            </div>
            {missing.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {missing.map(m => (
                  <span key={m} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    + {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t
                ? 'border-current text-gray-900 dark:text-white'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            style={tab === t ? { borderColor: 'var(--primary)', color: 'var(--primary)' } : {}}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card-premium rounded-2xl p-6">

        {tab === 'Overview' && (
          <div>
            <Row label="Full Name"     value={fullName} />
            <Row label="Email"         value={<a href={`mailto:${emp.email}`} className="text-blue-500 hover:underline">{emp.email}</a>} />
            <Row label="Phone"         value={emp.phone} />
            <Row label="Date of Birth" value={emp.dateOfBirth ? `${fmt(emp.dateOfBirth)}${age(emp.dateOfBirth)}` : '—'} />
            <Row label="Gender"        value={emp.gender} />
            <Row label="Address"       value={emp.address} />
            <Row label="Status"        value={
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${emp.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                <span className={`w-2 h-2 rounded-full ${emp.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                {emp.isActive ? 'Active' : 'Inactive'}
              </span>
            } />
            <Row label="Profile Added" value={fmt(emp.createdAt)} />
          </div>
        )}

        {tab === 'Employment' && (
          <div>
            <Row label="Employee #"       value={<span className="font-mono">{emp.employeeNumber}</span>} />
            <Row label="Entity"           value={emp.entityName} />
            <Row label="Employment Type"  value={EMP_TYPE_LABEL[emp.employmentType] ?? emp.employmentType} />
            <Row label="Department"       value={emp.departmentName} />
            <Row label="Position"         value={emp.positionTitle} />
            <Row label="Award / Class."      value={emp.awardClassification} />
            <Row label="Pay Level"           value={emp.payLevel} />
            {emp.annualSalary && <Row label="Annual Salary"  value={`$${Number(emp.annualSalary).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`} />}
            {emp.ordinaryHoursPerWeek && <Row label="Hrs / Week"  value={`${emp.ordinaryHoursPerWeek} hrs`} />}
            <Row label="Start Date"          value={fmt(emp.startDate)} />
            <Row label="Probation End"    value={emp.probationEndDate ? fmt(emp.probationEndDate) : '—'} />
            {emp.endDate && <Row label="End Date" value={fmt(emp.endDate)} />}
            <Row label="NDIS Worker"      value={emp.ndisWorker ? 'Yes' : 'No'} />
          </div>
        )}

        {tab === 'Emergency Contacts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">People to contact in an emergency</p>
              <button
                onClick={openAddContact}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
                style={{ background: 'var(--primary)' }}
              >
                + Add Contact
              </button>
            </div>

            {/* Add/Edit modal */}
            {showContactForm && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <form
                  onSubmit={saveContact}
                  className="card-premium rounded-2xl p-6 w-full max-w-md space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {editingContact ? 'Edit Contact' : 'Add Emergency Contact'}
                    </h3>
                    <button type="button" onClick={() => setShowContactForm(false)} className="text-gray-600 dark:text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                    <input required value={contactForm.name} onChange={e => { markDirty(); setContactForm(f => ({ ...f, name: e.target.value })) }}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400"
                      placeholder="e.g. John Smith" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Relationship</label>
                    <input value={contactForm.relationship} onChange={e => { markDirty(); setContactForm(f => ({ ...f, relationship: e.target.value })) }}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400"
                      placeholder="e.g. Spouse, Parent, Sibling" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                      <input value={contactForm.phone} onChange={e => { markDirty(); setContactForm(f => ({ ...f, phone: e.target.value })) }}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400"
                        placeholder="+61 4xx xxx xxx" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                      <input type="email" value={contactForm.email} onChange={e => { markDirty(); setContactForm(f => ({ ...f, email: e.target.value })) }}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-400"
                        placeholder="john@example.com" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={contactForm.isPrimary} onChange={e => { markDirty(); setContactForm(f => ({ ...f, isPrimary: e.target.checked })) }}
                      className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Primary emergency contact</span>
                  </label>

                  {contactError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {contactError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button type="submit" disabled={contactSaving}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                      style={{ background: 'var(--primary)' }}>
                      {contactSaving ? 'Saving…' : editingContact ? 'Save Changes' : 'Add Contact'}
                    </button>
                    <button type="button" onClick={() => { markClean(); setShowContactForm(false) }}
                      className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Contact list */}
            {!contactsLoaded ? (
              <p className="text-sm text-gray-600 dark:text-gray-400 py-4">Loading…</p>
            ) : contacts.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-3xl mb-2"></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">No emergency contacts added yet</p>
                <button onClick={openAddContact} className="mt-3 text-sm font-medium text-blue-500 hover:text-blue-700">
                  + Add first contact
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: 'var(--primary)' }}
                    >
                      {c.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 dark:text-white">{c.name}</p>
                        {c.isPrimary && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">Primary</span>
                        )}
                        {c.relationship && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{c.relationship}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {c.phone && <span>{c.phone}</span>}
                        {c.email && <span>{c.email}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEditContact(c)} className="text-xs text-gray-600 dark:text-gray-400 hover:text-blue-500 transition px-1" title="Edit"></button>
                      <button
                        onClick={() => deleteContact(c.id)}
                        disabled={deletingContact === c.id}
                        className="text-xs text-gray-600 dark:text-gray-400 hover:text-red-500 disabled:opacity-40 transition px-1"
                        title="Delete"
                      >
                        {deletingContact === c.id ? '…' : ''}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Compliance' && (
          <div className="space-y-5">
            {/* Overall status + change */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1.5">Overall Status</p>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['green','amber','red','pending'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setCompliance(s)}
                    disabled={saving || emp.complianceStatus === s}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      emp.complianceStatus === s ? 'ring-2 ring-offset-1' : 'opacity-60 hover:opacity-100'
                    } ${COMPLIANCE_BADGE[s].cls}`}
                  >
                    {COMPLIANCE_BADGE[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Screening records */}
            <div>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">Screening Checks</p>
              {!screeningLoaded ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p>
              ) : screening.length === 0 ? (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-6 text-center">
                  <p className="text-3xl mb-2"></p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No screening records yet</p>
                  <a href="/tenant/compliance" className="mt-2 inline-block text-xs text-blue-500 hover:underline">
                    Add via Compliance module →
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {screening.map(sr => {
                    const statusStyle: Record<string, string> = {
                      green:'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
                      amber:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
                      red:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
                      pending:'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                    }
                    // Compute expiry countdown badge
                    let countdownBadge: { label: string; cls: string } | null = null
                    if (sr.expiryDate) {
                      const daysLeft = Math.round((new Date(sr.expiryDate + 'T00:00:00').getTime() - Date.now()) / 86_400_000)
                      if (daysLeft < 0) {
                        countdownBadge = { label: `Expired ${Math.abs(daysLeft)}d ago`, cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' }
                      } else if (daysLeft === 0) {
                        countdownBadge = { label: 'Expires today', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' }
                      } else if (daysLeft <= 14) {
                        countdownBadge = { label: `Expires in ${daysLeft}d`, cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' }
                      } else if (daysLeft <= 30) {
                        countdownBadge = { label: `Expires in ${daysLeft}d`, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' }
                      }
                    }
                    return (
                      <div key={sr.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{sr.checkType}</p>
                          <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                            {sr.referenceNumber && <span>Ref: {sr.referenceNumber}</span>}
                            {sr.issuedDate && <span>Issued: {fmt(sr.issuedDate)}</span>}
                            {sr.expiryDate && <span>Expires: {fmt(sr.expiryDate)}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[sr.status] ?? statusStyle.pending}`}>
                            {sr.status.charAt(0).toUpperCase() + sr.status.slice(1)}
                          </span>
                          {countdownBadge && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${countdownBadge.cls}`}>
                              ⏰ {countdownBadge.label}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'Documents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">Employee Documents</p>
              <a
                href="/tenant/documents"
                className="text-xs text-blue-500 hover:underline"
              >
                Manage in Documents module →
              </a>
            </div>
            {!docsLoaded ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p>
            ) : docs.length === 0 ? (
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-6 text-center">
                <p className="text-3xl mb-2"></p>
                <p className="text-sm text-gray-500 dark:text-gray-400">No documents uploaded for this employee</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => {
                  const statusStyle: Record<string, string> = {
                    active:'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
                    expired:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
                    archived:'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                    pending_review:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
                  }
                  const size = doc.fileSizeBytes ? `${(doc.fileSizeBytes / 1024).toFixed(0)} KB` : ''
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <span className="text-2xl shrink-0">
                        {doc.mimeType?.includes('pdf') ? '' : doc.mimeType?.includes('image') ? '' : ''}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{doc.title}</p>
                        <div className="flex gap-2 mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                          <span>{doc.category}</span>
                          {size && <span>{size}</span>}
                          {doc.expiryDate && <span>Expires: {fmt(doc.expiryDate)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[doc.status] ?? statusStyle.active}`}>
                          {doc.status.replace('_', ' ')}
                        </span>
                        <a
                          href={doc.blobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Training Tab ─────────────────────────────────────────────────── */}
        {tab === 'Training' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">Course enrolments and completion records</p>
              <button
                onClick={() => { setEnrolCourseId(''); setShowEnrolModal(true) }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
                style={{ background: 'var(--primary)' }}>
                + Enrol in Course
              </button>
            </div>

            {/* Enrol modal */}
            {showEnrolModal && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="card-premium rounded-2xl w-full max-w-md p-6 space-y-4">
                  <h3 className="text-base font-bold text-white">Enrol in Course</h3>
                  <select
                    value={enrolCourseId}
                    onChange={e => setEnrolCourseId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                    <option value="">Select a course…</option>
                    {courses
                      .filter(c => !training.some(t => t.courseId === c.id && t.status !== 'expired'))
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.title}{c.isMandatory ? ' ★' : ''}{c.category ? ` — ${c.category}` : ''}
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400">★ = mandatory training</p>
                  <div className="flex gap-3">
                    <button
                      disabled={!enrolCourseId || enrolSaving}
                      onClick={enrolEmployee}
                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                      {enrolSaving ? 'Enrolling…' : 'Enrol'}
                    </button>
                    <button onClick={() => setShowEnrolModal(false)}
                      className="px-5 py-2 border border-gray-700 text-gray-400 hover:text-white text-sm rounded-lg transition">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Summary stats */}
            {trainingLoaded && training.length > 0 && (() => {
              const completed = training.filter(t => t.status === 'completed').length
              const overdue   = training.filter(t => t.status === 'overdue').length
              const enrolled  = training.filter(t => t.status === 'enrolled').length
              const mandatory = training.filter(t => t.courseMandatory && t.status !== 'completed').length
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total',     value: training.length, cls: 'text-gray-300' },
                    { label: 'Completed', value: completed,        cls: 'text-green-400' },
                    { label: 'Enrolled',  value: enrolled,         cls: 'text-blue-400' },
                    { label: 'Overdue',   value: overdue + mandatory, cls: 'text-red-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-800 rounded-xl p-3 text-center">
                      <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Records list */}
            {!trainingLoaded ? (
              <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
            ) : training.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <p className="text-4xl mb-2">🎓</p>
                <p className="text-sm">No training records yet. Click &quot;Enrol in Course&quot; to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {training.map(rec => {
                  const STATUS_BADGE: Record<string, string> = {
                    enrolled:  'bg-blue-900/50 text-blue-300 border border-blue-800',
                    completed: 'bg-green-900/50 text-green-300 border border-green-800',
                    overdue:   'bg-red-900/50 text-red-300 border border-red-800',
                    expired:   'bg-gray-800 text-gray-400 border border-gray-700',
                  }
                  const daysLeft = rec.expiryDate
                    ? Math.ceil((new Date(rec.expiryDate).getTime() - Date.now()) / 86400000)
                    : null

                  return (
                    <div key={rec.id} className="flex items-start gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">
                            {rec.courseTitle ?? 'Untitled Course'}
                            {rec.courseMandatory && <span className="ml-1 text-amber-400 text-xs">★ Mandatory</span>}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[rec.status] ?? STATUS_BADGE.enrolled}`}>
                            {rec.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                          {rec.courseCategory && <span>{rec.courseCategory}</span>}
                          {rec.completedAt && <span>Completed {fmt(rec.completedAt)}</span>}
                          {rec.expiryDate && (
                            <span className={daysLeft !== null && daysLeft < 30 ? 'text-amber-400' : ''}>
                              Expires {fmt(rec.expiryDate)}{daysLeft !== null && daysLeft >= 0 ? ` (${daysLeft}d)` : ' (expired)'}
                            </span>
                          )}
                          {rec.score && <span>Score: {rec.score}</span>}
                          {rec.attempts > 1 && <span>{rec.attempts} attempts</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {rec.certificateUrl && (
                          <a href={rec.certificateUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline">Certificate ↗</a>
                        )}
                        {rec.status === 'enrolled' && (
                          <button
                            disabled={trainingUpdating === rec.id}
                            onClick={() => markTrainingComplete(rec.id)}
                            className="px-2.5 py-1 text-xs bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg transition">
                            {trainingUpdating === rec.id ? '…' : 'Mark Complete'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-xs text-gray-600 dark:text-gray-500 text-right">
              <a href="/tenant/training" className="hover:text-purple-400 transition">View full Training module →</a>
            </p>
          </div>
        )}

        {/* ── Promotions Tab ───────────────────────────────────────────────── */}
        {tab === 'Promotions' && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">Promotions, designation changes and salary reviews</p>
              <button
                onClick={() => {
                  setPromoForm({ type: 'promotion', proposedTitle: emp?.positionTitle ?? '', proposedSalary: emp?.annualSalary ?? '', effectiveDate: '', justification: '' })
                  setShowPromoForm(true)
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
                style={{ background: 'var(--primary)' }}>
                + Raise Request
              </button>
            </div>

            {/* List */}
            {!promotionsLoaded ? (
              <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>
            ) : promotions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <p className="text-4xl mb-2">📋</p>
                <p className="text-sm">No promotion records yet.</p>
              </div>
            ) : (
              promotions.map(p => {
                const isHike = p.proposedTitle === p.currentTitle || p.proposedTitle === emp?.positionTitle
                const increase = (p.currentSalary && p.proposedSalary) ? Number(p.proposedSalary) - Number(p.currentSalary) : null
                const pct = (increase && p.currentSalary) ? ((increase / Number(p.currentSalary)) * 100).toFixed(1) : null

                const STATUS_STYLE: Record<string, string> = {
                  pending:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                  approved:     'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
                  rejected:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                  implemented:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
                }

                return (
                  <div key={p.id} className="border border-gray-100 dark:border-gray-800 rounded-xl p-5 space-y-4">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {isHike ? '💰 Annual Salary Review' : `🏅 ${p.currentTitle ? `${p.currentTitle} → ` : ''}${p.proposedTitle}`}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status] ?? ''}`}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Raised {fmt(p.createdAt)}{p.raisedByName ? ` by ${p.raisedByName}` : ''}
                          {p.effectiveDate ? ` · Effective ${fmt(p.effectiveDate)}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {p.currentTitle && <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Current Title</p>
                        <p className="text-xs font-medium text-gray-800 dark:text-white mt-0.5">{p.currentTitle}</p>
                      </div>}
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Proposed Title</p>
                        <p className="text-xs font-medium text-gray-800 dark:text-white mt-0.5">{p.proposedTitle}</p>
                      </div>
                      {p.currentSalary && <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Current Salary</p>
                        <p className="text-xs font-medium text-gray-800 dark:text-white mt-0.5">${Number(p.currentSalary).toLocaleString()}</p>
                      </div>}
                      {p.proposedSalary && <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Proposed Salary</p>
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 mt-0.5">
                          ${Number(p.proposedSalary).toLocaleString()}
                          {pct ? <span className="text-gray-500 dark:text-gray-400"> (+{pct}%)</span> : null}
                        </p>
                      </div>}
                    </div>

                    {/* Justification */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Justification</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{p.justification}</p>
                    </div>

                    {/* Review notes */}
                    {p.reviewNotes && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Review Notes</p>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">{p.reviewNotes}</p>
                        {p.reviewedBy && <p className="text-xs text-gray-400 mt-1">— {p.reviewedBy} on {fmt(p.reviewedAt)}</p>}
                      </div>
                    )}

                    {/* Workflow actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {p.status === 'pending' && (
                        <button
                          onClick={() => updatePromoStatus(p.id, 'under_review')}
                          disabled={promoUpdating === p.id}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50">
                          Submit for Review
                        </button>
                      )}
                      {p.status === 'under_review' && (
                        <>
                          <button
                            onClick={() => { setReviewModal({ id: p.id, action: 'approved' }); setReviewNotes('') }}
                            className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition">
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => { setReviewModal({ id: p.id, action: 'rejected' }); setReviewNotes('') }}
                            className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
                            ✗ Reject
                          </button>
                        </>
                      )}
                      {p.status === 'approved' && (
                        <button
                          onClick={() => { setReviewModal({ id: p.id, action: 'implemented' }); setReviewNotes('') }}
                          className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition">
                          ⚡ Implement
                        </button>
                      )}
                      {/* Letter buttons */}
                      <div className="flex flex-wrap gap-1.5 ml-auto">
                        <button onClick={() => printNominationLetter(p)}
                          className="px-2.5 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition">
                          🖨 Nomination Letter
                        </button>
                        {['approved','implemented'].includes(p.status) && (
                          <>
                            <button onClick={() => printApprovalLetter(p)}
                              className="px-2.5 py-1.5 text-xs font-medium border border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition">
                              🖨 Approval Letter
                            </button>
                            {!isHike && (
                              <button onClick={() => printDesignationLetter(p)}
                                className="px-2.5 py-1.5 text-xs font-medium border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                                🖨 Designation Letter
                              </button>
                            )}
                            {p.proposedSalary && (
                              <button onClick={() => printSalaryLetter(p)}
                                className="px-2.5 py-1.5 text-xs font-medium border border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition">
                                🖨 {isHike ? 'Hike Letter' : 'Salary Letter'}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Notes Tab ────────────────────────────────────────────────────── */}
        {tab === 'Notes' && (
          <div className="space-y-5">
            {/* Add note form */}
            <div className="space-y-2">
              <textarea
                value={noteContent}
                onChange={e => { markDirty(); setNoteContent(e.target.value) }}
                placeholder="Add a note about this employee…"
                rows={3}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 resize-y"
              />
              <div className="flex justify-end">
                <button
                  disabled={!noteContent.trim() || noteSaving}
                  onClick={async () => {
                    if (!noteContent.trim()) return
                    setNoteSaving(true)
                    try {
                      const res = await fetchWithAuth(`/api/tenant/employees/${id}/notes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: noteContent.trim() }),
                      })
                      if (res.ok) {
                        const d = await res.json()
                        setNotes(prev => [d.note, ...prev])
                        setNoteContent('')
                        markClean()
                        setToast({ message: 'Note added', type: 'success' })
                      } else {
                        setToast({ message: 'Failed to add note', type: 'error' })
                      }
                    } catch {
                      setToast({ message: 'Network error — please try again.', type: 'error' })
                    } finally {
                      setNoteSaving(false)
                    }
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'var(--primary)' }}
                >
                  {noteSaving ? 'Saving…' : 'Add Note'}
                </button>
              </div>
            </div>

            {/* Notes list */}
            {!notesLoaded ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading…</p>
            ) : notes.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-3xl mb-2">📝</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">No notes yet. Add the first one above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map(note => {
                  const isOwn = currentUserId === note.authorId
                  const initials = note.authorEmail.slice(0, 2).toUpperCase()
                  const relTime = (() => {
                    const diff = Date.now() - new Date(note.createdAt).getTime()
                    const mins  = Math.floor(diff / 60000)
                    const hours = Math.floor(diff / 3600000)
                    const days  = Math.floor(diff / 86400000)
                    if (mins < 2)   return 'just now'
                    if (mins < 60)  return `${mins} min ago`
                    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`
                    if (days < 30)  return `${days} day${days > 1 ? 's' : ''} ago`
                    return new Date(note.createdAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
                  })()

                  return (
                    <div key={note.id} className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: 'var(--primary)' }}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{note.authorEmail}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{relTime}</span>
                        </div>
                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{note.content}</p>
                      </div>
                      {isOwn && (
                        <button
                          title="Delete note"
                          disabled={deletingNote === note.id}
                          onClick={async () => {
                            setDeletingNote(note.id)
                            try {
                              const res = await fetchWithAuth(`/api/tenant/employees/${id}/notes/${note.id}`, { method: 'DELETE' })
                              if (res.ok) {
                                setNotes(prev => prev.filter(n => n.id !== note.id))
                                setToast({ message: 'Note deleted', type: 'success' })
                              } else {
                                setToast({ message: 'Failed to delete note', type: 'error' })
                              }
                            } catch {
                              setToast({ message: 'Network error', type: 'error' })
                            } finally {
                              setDeletingNote(null)
                            }
                          }}
                          className="shrink-0 text-gray-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40 transition text-lg leading-none mt-0.5"
                        >
                          {deletingNote === note.id ? '…' : '×'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Review / Implement modal ──────────────────────────────────────── */}
        {reviewModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card-premium rounded-2xl p-6 w-full max-w-md space-y-4">
              <h3 className="text-base font-bold text-white capitalize">
                {reviewModal.action === 'implemented' ? 'Implement Promotion' : `${reviewModal.action === 'approved' ? 'Approve' : 'Reject'} Nomination`}
              </h3>
              {reviewModal.action === 'implemented' ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This will update the employee&apos;s salary record to the proposed amount and mark the case as implemented.
                </p>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {reviewModal.action === 'approved' ? 'Approval Notes (optional)' : 'Reason for Rejection *'}
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none min-h-[80px] resize-y"
                    placeholder={reviewModal.action === 'approved' ? 'Any additional conditions or comments…' : 'Reason for rejection…'}
                  />
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => updatePromoStatus(reviewModal.id, reviewModal.action, reviewNotes || undefined)}
                  disabled={promoUpdating === reviewModal.id}
                  className={`flex-1 py-2 text-sm font-medium text-white rounded-lg transition disabled:opacity-50 ${
                    reviewModal.action === 'approved' ? 'bg-green-600 hover:bg-green-700' :
                    reviewModal.action === 'rejected' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-purple-600 hover:bg-purple-700'
                  }`}>
                  {promoUpdating === reviewModal.id ? 'Saving…' : reviewModal.action === 'implemented' ? 'Confirm & Implement' : reviewModal.action === 'approved' ? 'Approve' : 'Reject'}
                </button>
                <button onClick={() => setReviewModal(null)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700 text-gray-500 hover:text-white rounded-lg transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── New Promotion Form Modal ──────────────────────────────────────── */}
        {showPromoForm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="card-premium rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-base font-bold text-white">Raise Promotion / Salary Request</h2>
                <button onClick={() => setShowPromoForm(false)} className="text-gray-400 hover:text-white text-xl">×</button>
              </div>
              <form onSubmit={raisePromotion} className="p-5 space-y-4">
                {/* Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Request Type</label>
                  <select
                    value={promoForm.type}
                    onChange={e => {
                      const t = e.target.value
                      setPromoForm(f => ({
                        ...f, type: t,
                        proposedTitle: t === 'salary_hike' ? (emp?.positionTitle ?? '') : f.proposedTitle,
                      }))
                    }}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500">
                    <option value="promotion">Promotion (Title + Salary change)</option>
                    <option value="salary_hike">Annual Salary Hike (salary only)</option>
                    <option value="designation">Designation Change (title only)</option>
                  </select>
                </div>

                {/* Proposed title — hidden for salary_hike */}
                {promoForm.type !== 'salary_hike' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Proposed Title *</label>
                    <input
                      required
                      value={promoForm.proposedTitle}
                      onChange={e => setPromoForm(f => ({ ...f, proposedTitle: e.target.value }))}
                      className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                      placeholder="e.g. Senior Support Worker"
                    />
                  </div>
                )}

                {/* Salary — hidden for designation-only */}
                {promoForm.type !== 'designation' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Current Salary ($)
                      </label>
                      <input
                        readOnly
                        value={emp?.annualSalary ? Math.round(Number(emp.annualSalary)) : ''}
                        className="w-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Proposed Salary ($) *
                      </label>
                      <input
                        required={promoForm.type !== 'designation'}
                        type="number"
                        value={promoForm.proposedSalary}
                        onChange={e => setPromoForm(f => ({ ...f, proposedSalary: e.target.value }))}
                        className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                        placeholder="e.g. 72000"
                      />
                    </div>
                  </div>
                )}

                {/* Effective date */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={promoForm.effectiveDate}
                    onChange={e => setPromoForm(f => ({ ...f, effectiveDate: e.target.value }))}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Justification */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Justification / Reason *</label>
                  <textarea
                    required
                    value={promoForm.justification}
                    onChange={e => setPromoForm(f => ({ ...f, justification: e.target.value }))}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 min-h-[80px] resize-y"
                    placeholder="Describe the reason for this request (performance, CPI review, restructure, etc.)…"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={promoSaving}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                    {promoSaving ? 'Submitting…' : 'Raise Request'}
                  </button>
                  <button type="button" onClick={() => setShowPromoForm(false)}
                    className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-500 hover:text-white text-sm rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}
