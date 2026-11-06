'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState, useCallback, useRef } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import { useSearchParams } from 'next/navigation'
import EmptyState from '@/components/ui/EmptyState'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate, fmtCsvCurrency } from '@/lib/exportCsv'

type Offer = {
  id: string; candidateName: string; candidateEmail: string
  position: string; department: string | null; employmentType: string
  startDate: string | null; salaryAmount: number | null; salaryCycle: string
  status: string; sentAt: string | null; acceptedAt: string | null
  rejectedAt: string | null; expiresAt: string | null; pdfUrl: string | null
  notes: string | null; createdBy: string | null; createdAt: string
  templateContent: string | null; acceptanceToken: string | null
}
type OfferEvent = { id: string; event: string; note: string | null; performedBy: string | null; createdAt: string }
type Stats = { total: number; draft: number; sent: number; accepted: number; rejected: number; expired: number }

const STATUS_STYLE: Record<string, string> = {
  draft:     'badge badge-gray',
  sent:      'badge badge-blue',
  accepted:  'badge badge-green',
  rejected:  'badge badge-red',
  expired:   'badge badge-amber',
  withdrawn: 'badge badge-gray',
}

const EVENT_ICON: Record<string, string> = {
  created:'📄', sent:'📤', viewed:'👁', accepted:'✅', rejected:'❌',
  expired:'⏰', withdrawn:'↩️', pdf_generated:'🖨', note_added:'📝', updated:'✏️',
}

const EMP_TYPES = [
  { value: 'full_time',   label: 'Full-Time' },
  { value: 'part_time',   label: 'Part-Time' },
  { value: 'casual',      label: 'Casual' },
  { value: 'contractor',  label: 'Contractor' },
]

const INPUT = 'input-premium'
const LABEL = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

type CustomTemplate = {
  id: string; name: string; content: string; fileUrl: string | null; createdAt: string
}

// ── Client-side .docx text extraction (no external packages) ─────────────────
async function readZipEntry(bytes: Uint8Array, targetName: string): Promise<Uint8Array | null> {
  const sig = [0x50, 0x4B, 0x03, 0x04]
  let i = 0
  while (i < bytes.length - 30) {
    if (bytes[i]===sig[0] && bytes[i+1]===sig[1] && bytes[i+2]===sig[2] && bytes[i+3]===sig[3]) {
      const compression = bytes[i+8] | (bytes[i+9] << 8)
      const compSize    = (bytes[i+18]) | (bytes[i+19]<<8) | (bytes[i+20]<<16) | ((bytes[i+21]<<24)>>>0)
      const nameLen     = bytes[i+26] | (bytes[i+27] << 8)
      const extraLen    = bytes[i+28] | (bytes[i+29] << 8)
      const name        = new TextDecoder().decode(bytes.slice(i+30, i+30+nameLen))
      const dataStart   = i + 30 + nameLen + extraLen
      if (name === targetName) {
        const compData = bytes.slice(dataStart, dataStart + compSize)
        if (compression === 0) return compData
        if (compression === 8) {
          const ds     = new DecompressionStream('deflate-raw')
          const writer = ds.writable.getWriter()
          const reader = ds.readable.getReader()
          writer.write(compData); writer.close()
          const chunks: Uint8Array[] = []
          for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value) }
          const len = chunks.reduce((a, b) => a + b.length, 0)
          const out = new Uint8Array(len); let off = 0
          for (const c of chunks) { out.set(c, off); off += c.length }
          return out
        }
      }
      i = dataStart + compSize
    } else { i++ }
  }
  return null
}

async function extractDocxText(file: File): Promise<string> {
  const buf   = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const xml   = await readZipEntry(bytes, 'word/document.xml')
  if (!xml) throw new Error('word/document.xml not found in .docx')
  const decoded = new TextDecoder().decode(xml)
  const paras = decoded.split('</w:p>').map(para => {
    const texts = (para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map(t => t.replace(/<[^>]+>/g, ''))
    return texts.join('')
  }).filter(p => p.trim())
  return paras.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

type PdfjsLib = {
  getDocument: (o: object) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }> }> }
  GlobalWorkerOptions: { workerSrc: string }
}
declare global { interface Window { pdfjsLib: PdfjsLib } }

async function extractPdfText(file: File): Promise<string> {
  if (!window.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
      s.onload = () => resolve(); s.onerror = () => reject(new Error('PDF.js load failed'))
      document.head.appendChild(s)
    })
    ;(window as { pdfjsLib: PdfjsLib }).pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }
  const buf  = await file.arrayBuffer()
  const pdf  = await window.pdfjsLib.getDocument({ data: buf }).promise
  const parts: string[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page    = await pdf.getPage(n)
    const content = await page.getTextContent()
    parts.push(content.items.map(item => item.str).join(' '))
  }
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function applyMergeTags(content: string, vars: {
  candidateName: string; position: string; department: string
  employmentType: string; startDate: string; salaryAmount: string; salaryCycle: string
}): string {
  const empLabel = EMP_TYPES.find(t => t.value === vars.employmentType)?.label ?? vars.employmentType
  return content
    .replace(/\{\{candidateName\}\}/g, vars.candidateName || '[Candidate Name]')
    .replace(/\{\{position\}\}/g,      vars.position      || '[Position]')
    .replace(/\{\{department\}\}/g,    vars.department    || '[Department]')
    .replace(/\{\{employmentType\}\}/g, empLabel)
    .replace(/\{\{startDate\}\}/g,     vars.startDate     || '[Start Date]')
    .replace(/\{\{salary\}\}/g,        vars.salaryAmount  ? `$${Number(vars.salaryAmount).toLocaleString()}` : '[Salary]')
    .replace(/\{\{salaryCycle\}\}/g,   vars.salaryCycle   || 'per annum')
}

// ── Predefined letter templates ───────────────────────────────────────────────
type TemplateVars = Partial<Offer> & { orgName?: string }

function DEFAULT_TEMPLATE(o: TemplateVars) {
  return `Dear ${o.candidateName || '[Candidate Name]'},

We are delighted to offer you the position of ${o.position || '[Position Title]'} at ${o.orgName || '[Organisation Name]'}.

EMPLOYMENT DETAILS
Position:         ${o.position || '[Position Title]'}
Department:       ${o.department || '[Department]'}
Employment Type:  ${EMP_TYPES.find(t => t.value === o.employmentType)?.label || 'Full-Time'}
Start Date:       ${o.startDate || '[Start Date]'}
Salary:           $${o.salaryAmount?.toLocaleString() || '[Salary]'} ${o.salaryCycle || 'per annum'}

This offer is subject to the successful completion of reference and background checks.

Please confirm your acceptance of this offer by clicking the acceptance link provided or replying to this email before the expiry date.

We look forward to welcoming you to the team.

Yours sincerely,
[Hiring Manager Name]
[Title]
[Organisation Name]`
}

const TEMPLATES: Array<{ label: string; fn: (o: TemplateVars) => string }> = [
  {
    label: 'Default (General)',
    fn: DEFAULT_TEMPLATE,
  },
  {
    label: 'Yahweh Care — Disability Support Worker',
    fn: (o) => `Dear ${o.candidateName || '[Candidate Name]'},

We are pleased to offer you employment with Yahweh Care Pty Ltd as a ${o.position || '[Position Title]'} in our ${o.department || 'Community Care'} team.

TERMS OF EMPLOYMENT
Position:             ${o.position || '[Position Title]'}
Classification:       SCHADS Award — Level [X], Pay Point [X]
Employment Type:      ${EMP_TYPES.find(t => t.value === o.employmentType)?.label || 'Full-Time'}
Commencement Date:    ${o.startDate || '[Start Date]'}
Remuneration:         $${o.salaryAmount?.toLocaleString() || '[Salary]'} ${o.salaryCycle || 'per annum'} + Superannuation (11.5%)
Probation Period:     3 months from commencement

ABOUT YOUR ROLE
You will provide high-quality support services to NDIS participants, including personal care, community access, and daily living assistance, in accordance with the NDIS Practice Standards and the Code of Conduct for Supports under the NDIS Quality and Safeguards Commission.

PRE-EMPLOYMENT REQUIREMENTS
This offer is conditional on satisfactory completion of:
• NDIS Worker Screening Check (clearance required prior to commencement)
• National Police Check (no older than 3 months)
• Proof of right to work in Australia
• Valid First Aid Certificate (HLTAID011 or equivalent)
• Completion of mandatory Yahweh Care induction training

CONFIDENTIALITY
All information relating to participants, their families and colleagues is strictly confidential and must not be disclosed to any third party.

Please confirm your acceptance by clicking the candidate link provided, or by contacting the HR team before the offer expiry date. If you have any questions, please do not hesitate to reach out.

We look forward to welcoming you to the Yahweh Care family.

Yours sincerely,

[Hiring Manager Name]
Director of People & Culture
Yahweh Care Pty Ltd
[Phone] | [Email]`,
  },
  {
    label: 'Yahweh Property Care — Field Staff',
    fn: (o) => `Dear ${o.candidateName || '[Candidate Name]'},

Yahweh Property Care Pty Ltd is delighted to offer you the position of ${o.position || '[Position Title]'}, commencing ${o.startDate || '[Start Date]'}.

EMPLOYMENT TERMS
Position:             ${o.position || '[Position Title]'}
Division:             ${o.department || 'Property Maintenance'}
Employment Type:      ${EMP_TYPES.find(t => t.value === o.employmentType)?.label || 'Casual'}
Remuneration:         $${o.salaryAmount?.toLocaleString() || '[Rate]'} ${o.salaryCycle || 'per hour'} (inclusive of casual loading where applicable)
Probation Period:     3 months (full-time / part-time positions only)

DUTIES
Your duties will include property maintenance, lawn and garden care, cleaning services, and minor repairs across client sites, as directed by your supervisor or team leader.

CONDITIONS OF EMPLOYMENT
• Valid Australian driver's licence (required)
• National Police Check — satisfactory result prior to commencement
• Proof of right to work in Australia
• Compliance with Yahweh Property Care WHS Policy and all site safety requirements
• Adherence to uniform and personal presentation standards

This offer is subject to the above conditions being satisfied. Please accept this offer by clicking the candidate link provided, or by signing and returning this letter, no later than the offer expiry date.

We are excited to have you on the team.

Yours sincerely,

[Operations Manager]
Yahweh Property Care Pty Ltd
[Phone] | [Email]`,
  },
  {
    label: 'SCHADS Casual — Hourly Rate',
    fn: (o) => `Dear ${o.candidateName || '[Candidate Name]'},

We are pleased to offer you casual employment with Yahweh Care Pty Ltd as a ${o.position || '[Position Title]'}.

CASUAL EMPLOYMENT DETAILS
Position:             ${o.position || '[Position Title]'}
SCHADS Classification: Level [X], Pay Point [X]
Casual Hourly Rate:   $${o.salaryAmount?.toLocaleString() || '[Rate]'} per hour (inclusive of 25% casual loading)
Weekend / PH Rates:   Refer to SCHADS Award 2010 penalty rate schedule
Available From:       ${o.startDate || '[Date]'}

NATURE OF CASUAL EMPLOYMENT
As a casual employee, you will not have a guaranteed minimum number of hours per week. Shifts will be offered based on operational requirements and you may accept or decline shifts at your discretion. There is no entitlement to paid personal/carer's or annual leave.

COMPLIANCE REQUIREMENTS
You must maintain the following current and valid at all times during employment:
• NDIS Worker Screening Check clearance
• National Police Check (renewed every 3 years or as required)
• First Aid Certificate (HLTAID011 or equivalent)

By accepting this offer, you confirm that you have read, understood and agree to the above terms and conditions.

Yours sincerely,

[Hiring Manager]
Yahweh Care Pty Ltd`,
  },
]

export default function OfferLettersPage() {
  const [offers,       setOffers]       = useState<Offer[]>([])
  const [stats,        setStats]        = useState<Stats>({ total:0,draft:0,sent:0,accepted:0,rejected:0,expired:0 })
  const [loading,      setLoading]      = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [search,       setSearch]       = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [selected,     setSelected]     = useState<Offer | null>(null)
  const [events,       setEvents]       = useState<OfferEvent[]>([])
  const [noteText,     setNoteText]     = useState('')
  const [addingNote,   setAddingNote]   = useState(false)
  const [copied,          setCopied]          = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('0')
  const [customTemplates, setCustomTemplates]   = useState<CustomTemplate[]>([])
  const [showUpload,      setShowUpload]        = useState(false)
  const [uploadName,      setUploadName]        = useState('')
  const [uploadFile,      setUploadFile]        = useState<File | null>(null)
  const [uploadExtracted, setUploadExtracted]   = useState('')
  const [extracting,      setExtracting]        = useState(false)
  const [uploading,       setUploading]         = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState>(null)
  const [uploadError,     setUploadError]       = useState('')
  const [orgName,         setOrgName]           = useState('')
  const [formError,       setFormError]         = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    candidateName: '', candidateEmail: '', position: '', department: '',
    employmentType: 'full_time', startDate: '', salaryAmount: '', salaryCycle: 'annual',
    notes: '', expiresAt: '', templateContent: '',
  })

  const exportOffersCsv = () => {
    exportCsv({
      filename: 'offer-letters',
      columns: [
        { header: 'Candidate Name', key: 'candidateName' },
        { header: 'Position',       key: 'position' },
        { header: 'Department',     key: 'department' },
        { header: 'Employment Type', key: 'employmentType' },
        { header: 'Salary',         key: 'salaryAmount', format: fmtCsvCurrency },
        { header: 'Start Date',     key: 'startDate',   format: fmtCsvDate },
        { header: 'Status',         key: 'status' },
        { header: 'Sent Date',      key: 'sentAt',      format: fmtCsvDate },
        { header: 'Accepted Date',  key: 'acceptedAt',  format: fmtCsvDate },
      ],
      rows: offers,
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (search)       params.set('search', search)
    const res  = await fetchWithAuth(`/api/tenant/offer-letters?${params}`)
    const data = await res.json()
    setOffers(data.offers ?? [])
    setStats(data.stats ?? { total:0,draft:0,sent:0,accepted:0,rejected:0,expired:0 })
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])

  async function loadCustomTemplates() {
    try {
      const res  = await fetchWithAuth('/api/tenant/offer-letter-templates')
      const data = await res.json()
      setCustomTemplates(data.templates ?? [])
    } catch { /* non-fatal */ }
  }
  useEffect(() => { loadCustomTemplates() }, [])

  useEffect(() => {
    fetchWithAuth('/api/tenant/config').then(r => r.json()).then(d => {
      setOrgName(d.name ?? '')
    }).catch(() => {})
  }, [])

  // Pre-fill from recruitment pipeline URL params (?candidateName=…&candidateEmail=…)
  const searchParams = useSearchParams()
  useEffect(() => {
    const name  = searchParams.get('candidateName')
    const email = searchParams.get('candidateEmail')
    if (name || email) {
      setForm(f => ({ ...f, candidateName: name ?? f.candidateName, candidateEmail: email ?? f.candidateEmail }))
      setShowForm(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function initForm() {
    setForm({ candidateName:'',candidateEmail:'',position:'',department:'',
      employmentType:'full_time',startDate:'',salaryAmount:'',salaryCycle:'annual',
      notes:'',expiresAt:'',templateContent:'' })
    setSelectedTemplate('0')
    setFormError('')
    setShowForm(true)
  }

  function applyTemplate(key: string) {
    setSelectedTemplate(key)
    const idx = parseInt(key, 10)
    if (!isNaN(idx) && idx >= 0 && idx < TEMPLATES.length) {
      // Built-in template
      const content = TEMPLATES[idx].fn({
        candidateName: form.candidateName, position: form.position,
        department: form.department, employmentType: form.employmentType,
        startDate: form.startDate, salaryAmount: Number(form.salaryAmount) || 0,
        salaryCycle: form.salaryCycle, orgName,
      })
      setForm(f => ({ ...f, templateContent: content }))
    } else {
      // Custom template — substitute merge tags
      const tmpl = customTemplates.find(t => t.id === key)
      if (!tmpl) return
      const content = applyMergeTags(tmpl.content, {
        candidateName: form.candidateName, position: form.position,
        department: form.department, employmentType: form.employmentType,
        startDate: form.startDate, salaryAmount: form.salaryAmount,
        salaryCycle: form.salaryCycle,
      })
      setForm(f => ({ ...f, templateContent: content }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const content = form.templateContent || DEFAULT_TEMPLATE({
        candidateName: form.candidateName, position: form.position,
        department: form.department, employmentType: form.employmentType,
        startDate: form.startDate, salaryAmount: Number(form.salaryAmount) || 0,
        salaryCycle: form.salaryCycle, orgName,
      })
      const res = await fetchWithAuth('/api/tenant/offer-letters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, salaryAmount: Number(form.salaryAmount)||null, templateContent: content }),
      })
      if (res.ok) {
        setShowForm(false)
        load()
      } else {
        const data = await res.json().catch(() => ({}))
        setFormError(data.error ?? `Failed to create offer (${res.status})`)
      }
    } catch {
      setFormError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function selectOffer(offer: Offer) {
    setSelected(offer)
    const res  = await fetchWithAuth(`/api/tenant/offer-letters/${offer.id}`)
    const data = await res.json()
    setSelected(data.offer)
    setEvents(data.events ?? [])
  }

  async function updateStatus(status: string) {
    if (!selected) return
    const res = await fetchWithAuth(`/api/tenant/offer-letters/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { selectOffer(selected); load() }
  }

  async function addNote() {
    if (!selected || !noteText.trim()) return
    setAddingNote(true)
    await fetchWithAuth(`/api/tenant/offer-letters/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _note: noteText.trim() }),
    })
    setNoteText(''); setAddingNote(false)
    selectOffer(selected)
  }

  async function deleteOffer(id: string) {
    setConfirmState({
      message: 'Delete this draft offer letter?',
      onConfirm: async () => {
        await fetchWithAuth(`/api/tenant/offer-letters/${id}`, { method: 'DELETE' })
        setSelected(null); load()
      }
    })
  }

  function candidateUrl(token: string | null) {
    if (!token || typeof window === 'undefined') return ''
    return `${window.location.origin}/offer/${token}`
  }

  function copyLink() {
    const url = candidateUrl(selected?.acceptanceToken ?? null)
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function emailSubject() {
    return encodeURIComponent('Your Offer Letter — Action Required')
  }

  function emailBody() {
    if (!selected) return ''
    const url = candidateUrl(selected.acceptanceToken)
    const expires = selected.expiresAt
      ? `This offer expires on ${fmt(selected.expiresAt)}.`
      : 'Please respond at your earliest convenience.'
    return encodeURIComponent(
      `Dear ${selected.candidateName},\n\nPlease review your offer letter for the position of ${selected.position} using the secure link below:\n\n${url}\n\nYou can accept or decline the offer directly from that page.\n\n${expires}\n\nIf you have any questions, please reply to this email.\n\nKind regards`
    )
  }

  function printOffer() {
    if (!selected) return
    const content = selected.templateContent || DEFAULT_TEMPLATE({ ...selected, orgName })
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>Offer Letter — ${selected.candidateName}</title>
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; margin: 40px 60px; color: #111; }
      h1 { font-size: 16pt; margin-bottom: 4px; }
      .header { border-bottom: 2px solid #0E3D52; padding-bottom: 12px; margin-bottom: 24px; }
      .meta { font-size: 10pt; color: #555; }
      pre { font-family: inherit; white-space: pre-wrap; }
      @media print { body { margin: 20px 40px; } }
    </style></head><body>
    <div class="header">
      <h1>Offer Letter</h1>
      <div class="meta">Date: ${new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})}&nbsp;&nbsp;|&nbsp;&nbsp;
      Ref: ${selected.id.slice(0,8).toUpperCase()}</div>
    </div>
    <pre>${content}</pre>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`)
    win.document.close()
  }

  function fmt(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Offer Letters</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">Generate, send and track candidate offer letters</p>
        </div>
        <button onClick={initForm}
          className="px-4 py-2 bg-[#0E3D52] hover:bg-[#1A6080] text-white text-sm font-medium rounded-lg transition">
          + New Offer Letter
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: 'Total',    value: stats.total,    col: 'border-gray-700' },
          { label: 'Draft',    value: stats.draft,    col: 'border-gray-600' },
          { label: 'Sent',     value: stats.sent,     col: 'border-blue-700' },
          { label: 'Accepted', value: stats.accepted, col: 'border-green-700' },
          { label: 'Rejected', value: stats.rejected, col: 'border-red-700' },
          { label: 'Expired',  value: stats.expired,  col: 'border-amber-700' },
        ].map(s => (
          <div key={s.label} className={`card-premium p-3 text-center ${s.col}`}>
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={e=>{setSearch(e.target.value)}}
          placeholder="Search candidate / position…"
          className="flex-1 min-w-[200px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]" />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none">
          <option value="">All Status</option>
          {Object.keys(STATUS_STYLE).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
        </select>
        <ExportButton onClick={exportOffersCsv} disabled={offers.length === 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {loading ? (
            <p className="text-gray-500 text-sm text-center py-8 dark:text-gray-400">Loading…</p>
          ) : offers.length === 0 ? (
            <EmptyState
              icon="✉️"
              title="No offer letters"
              message="Generated offer letters will appear here."
              action={{ label: 'New Offer Letter', onClick: initForm }}
            />
          ) : offers.map(o => (
            <div key={o.id} onClick={() => selectOffer(o)}
              className={`p-4 rounded-xl border cursor-pointer transition ${selected?.id === o.id ? 'border-[#0E3D52] bg-[#0E3D52]/20' : 'border-gray-800 bg-gray-900 hover:border-gray-600'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold text-white truncate">{o.candidateName}</p>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[o.status] ?? 'badge badge-gray'}`}>
                  {o.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{o.position}{o.department ? ` · ${o.department}` : ''}</p>
              <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">{o.candidateEmail}</p>
              <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">{fmt(o.createdAt)}{o.salaryAmount ? ` · $${o.salaryAmount.toLocaleString()} p/a` : ''}</p>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="card-premium p-10 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm dark:text-gray-400">Select an offer letter to view details and history</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Offer detail card */}
              <div className="card-premium p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selected.candidateName}</h2>
                    <p className="text-sm text-[#1A6080] dark:text-[#4ebac4]">{selected.position}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{selected.candidateEmail}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_STYLE[selected.status] ?? ''}`}>
                    {selected.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  {[
                    { label:'Employment Type', value: EMP_TYPES.find(t=>t.value===selected.employmentType)?.label ?? selected.employmentType },
                    { label:'Department',      value: selected.department || '—' },
                    { label:'Start Date',      value: fmt(selected.startDate) },
                    { label:'Salary',          value: selected.salaryAmount ? `$${selected.salaryAmount.toLocaleString()} / ${selected.salaryCycle}` : '—' },
                    { label:'Sent',            value: fmt(selected.sentAt) },
                    { label:'Expires',         value: fmt(selected.expiresAt) },
                    { label:'Accepted',        value: fmt(selected.acceptedAt) },
                    { label:'Rejected',        value: fmt(selected.rejectedAt) },
                  ].map(r => (
                    <div key={r.label} className="bg-gray-100 dark:bg-gray-800/60 rounded-lg p-2.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{r.label}</p>
                      <p className="text-white text-xs font-medium mt-0.5">{r.value}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={printOffer}
                    className="flex-1 py-2 text-xs font-medium bg-[#1A6080] hover:bg-[#0E3D52] text-white rounded-lg transition">
                    🖨 Print / PDF
                  </button>
                  {selected.status === 'draft' && (
                    <button onClick={() => updateStatus('sent')}
                      className="flex-1 py-2 text-xs font-medium bg-[#0E3D52] hover:bg-[#1A6080] text-white rounded-lg transition">
                      📤 Mark as Sent
                    </button>
                  )}
                  {selected.status === 'sent' && (
                    <>
                      <button onClick={() => updateStatus('accepted')}
                        className="flex-1 py-2 text-xs font-medium bg-green-700 hover:bg-green-600 text-white rounded-lg transition">
                        ✅ Mark Accepted
                      </button>
                      <button onClick={() => updateStatus('rejected')}
                        className="flex-1 py-2 text-xs font-medium bg-red-700 hover:bg-red-600 text-white rounded-lg transition">
                        ❌ Mark Rejected
                      </button>
                    </>
                  )}
                  {['draft','sent'].includes(selected.status) && (
                    <button onClick={() => updateStatus('withdrawn')}
                      className="flex-1 py-2 text-xs font-medium border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white rounded-lg transition">
                      ↩ Withdraw
                    </button>
                  )}
                  {selected.status === 'draft' && (
                    <button onClick={() => deleteOffer(selected.id)}
                      className="py-2 px-3 text-xs text-red-400 border border-red-800 hover:bg-red-900/30 rounded-lg transition">
                      🗑
                    </button>
                  )}
                </div>
              </div>

              {/* Candidate acceptance link */}
              {selected.acceptanceToken && ['draft','sent'].includes(selected.status) && (
                <div className="card-premium p-4">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">📎 Candidate Acceptance Link</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Share this link with the candidate. They can view, sign and accept or decline the offer online — no login required.
                  </p>
                  <div className="flex gap-2 items-center mb-3">
                    <input
                      readOnly
                      value={candidateUrl(selected.acceptanceToken)}
                      className="flex-1 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-200 font-mono"
                    />
                    <button
                      onClick={copyLink}
                      className={`shrink-0 px-3 py-2 text-xs font-medium rounded-lg transition ${copied ? 'bg-green-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                    <a
                      href={candidateUrl(selected.acceptanceToken)}
                      target="_blank" rel="noreferrer"
                      className="shrink-0 px-3 py-2 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition">
                      ↗
                    </a>
                  </div>
                  <a
                    href={`mailto:${selected.candidateEmail}?subject=${emailSubject()}&body=${emailBody()}`}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-2 bg-[#1A6080] hover:bg-[#0E3D52] text-white rounded-lg transition">
                    ✉ Email Candidate
                  </a>
                </div>
              )}

              {/* Add note */}
              <div className="card-premium p-4">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Add Note</p>
                <div className="flex gap-2">
                  <input value={noteText} onChange={e=>setNoteText(e.target.value)}
                    placeholder="Internal note…"
                    className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]" />
                  <button onClick={addNote} disabled={addingNote || !noteText.trim()}
                    className="px-3 py-2 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-xs font-medium rounded-lg transition">
                    Add
                  </button>
                </div>
              </div>

              {/* Letter preview */}
              {selected.templateContent && (
                <div className="card-premium p-5">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400  mb-3">Letter Preview</p>
                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                    {selected.templateContent}
                  </pre>
                </div>
              )}

              {/* History timeline */}
              <div className="card-premium p-5">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400  mb-4">History</p>
                {events.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-4 dark:text-gray-400">No events yet</p>
                ) : (
                  <div className="space-y-3">
                    {events.map((ev, i) => (
                      <div key={ev.id} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 flex items-center justify-center text-sm">
                            {EVENT_ICON[ev.event] ?? '📌'}
                          </div>
                          {i < events.length - 1 && <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mt-1" />}
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-white capitalize">{ev.event.replace(/_/g,' ')}</p>
                            <p className="text-xs text-gray-600 shrink-0 dark:text-gray-400">{fmt(ev.createdAt)}</p>
                          </div>
                          {ev.note && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{ev.note}</p>}
                          {ev.performedBy && <p className="text-xs text-gray-600 mt-0.5 dark:text-gray-400">by {ev.performedBy}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Offer Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="card-premium rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-bold text-foreground">New Offer Letter</h2>
              <button onClick={()=>{ setShowForm(false); setFormError('') }} className="text-gray-600 dark:text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <form onSubmit={submit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Candidate Name *</label>
                  <input required value={form.candidateName} onChange={e=>setForm(f=>({...f,candidateName:e.target.value}))} className={INPUT} placeholder="Jane Smith" />
                </div>
                <div>
                  <label className={LABEL}>Candidate Email *</label>
                  <input required type="email" value={form.candidateEmail} onChange={e=>setForm(f=>({...f,candidateEmail:e.target.value}))} className={INPUT} placeholder="jane@example.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Position *</label>
                  <input required value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} className={INPUT} placeholder="Support Worker" />
                </div>
                <div>
                  <label className={LABEL}>Department</label>
                  <input value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))} className={INPUT} placeholder="Community Care" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={LABEL}>Employment Type</label>
                  <select value={form.employmentType} onChange={e=>setForm(f=>({...f,employmentType:e.target.value}))} className={INPUT}>
                    {EMP_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Start Date</label>
                  <input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Offer Expires</label>
                  <input type="date" value={form.expiresAt} onChange={e=>setForm(f=>({...f,expiresAt:e.target.value}))} className={INPUT} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Salary / Rate ($)</label>
                  <input type="number" value={form.salaryAmount} onChange={e=>setForm(f=>({...f,salaryAmount:e.target.value}))} className={INPUT} placeholder="65000" />
                </div>
                <div>
                  <label className={LABEL}>Salary Cycle</label>
                  <select value={form.salaryCycle} onChange={e=>setForm(f=>({...f,salaryCycle:e.target.value}))} className={INPUT}>
                    <option value="annual">Annual</option>
                    <option value="hourly">Hourly</option>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              {/* Template picker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={LABEL + ' mb-0'}>Letter Template</label>
                  <button
                    type="button"
                    onClick={() => { setUploadName(''); setUploadFile(null); setUploadExtracted(''); setUploadError(''); setShowUpload(true) }}
                    className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] transition">
                    📎 Upload Template
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedTemplate}
                    onChange={e => applyTemplate(e.target.value)}
                    className={INPUT}>
                    <optgroup label="Built-in Templates">
                      {TEMPLATES.map((t, i) => <option key={i} value={String(i)}>{t.label}</option>)}
                    </optgroup>
                    {customTemplates.length > 0 && (
                      <optgroup label="Your Templates">
                        {customTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => applyTemplate(selectedTemplate)}
                    className="shrink-0 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition">
                    Apply
                  </button>
                </div>
              </div>

              <div>
                <label className={LABEL}>Letter Content (edit after applying template)</label>
                <textarea
                  value={form.templateContent}
                  onChange={e=>setForm(f=>({...f,templateContent:e.target.value}))}
                  className={INPUT + ' min-h-[200px] resize-y font-mono text-xs'}
                  placeholder="Select a template above or write a custom letter…"
                />
              </div>
              <div>
                <label className={LABEL}>Internal Notes</label>
                <input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} className={INPUT} placeholder="Optional HR notes (not shown to candidate)" />
              </div>
              {formError && (
                <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                  {saving ? 'Creating…' : 'Create Offer Letter'}
                </button>
                <button type="button" onClick={()=>{ setShowForm(false); setFormError('') }}
                  className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Upload Template Modal */}
      {showUpload && (
        <div className="modal-overlay">
          <div className="card-premium rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-base font-bold text-white">Upload Offer Template</h2>
              <button onClick={() => setShowUpload(false)} className="text-gray-600 dark:text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Merge tag guide */}
              <div className="bg-[#E0EEF4] dark:bg-[#0E3D52]/20 border border-[#b8d4e0] dark:border-[#1A6080] rounded-lg p-3 text-xs text-[#0E3D52] dark:text-[#4ebac4] space-y-1">
                <p className="font-semibold text-[#9ccfda]">Available merge tags</p>
                <p><code>{'{{candidateName}}'}</code> · <code>{'{{position}}'}</code> · <code>{'{{department}}'}</code></p>
                <p><code>{'{{employmentType}}'}</code> · <code>{'{{startDate}}'}</code> · <code>{'{{salary}}'}</code> · <code>{'{{salaryCycle}}'}</code></p>
                <p className="text-[#1A6080] dark:text-[#4ebac4]">Place these tags anywhere in your .docx or .pdf template file.</p>
              </div>

              {/* Template name */}
              <div>
                <label className={LABEL}>Template Name *</label>
                <input
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                  className={INPUT}
                  placeholder="e.g. Senior Care Coordinator — Full-Time"
                />
              </div>

              {/* File picker */}
              <div>
                <label className={LABEL}>Template File (.docx or .pdf) *</label>
                <input
                  type="file"
                  accept=".docx,.pdf"
                  className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-white file:text-xs hover:file:bg-gray-600 cursor-pointer"
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    setUploadFile(f)
                    setUploadExtracted('')
                    setUploadError('')
                    setExtracting(true)
                    try {
                      let text = ''
                      if (f.name.endsWith('.docx')) {
                        text = await extractDocxText(f)
                      } else if (f.name.endsWith('.pdf')) {
                        text = await extractPdfText(f)
                      } else {
                        throw new Error('Only .docx and .pdf files are supported')
                      }
                      if (!text.trim()) throw new Error('No text could be extracted from this file')
                      setUploadExtracted(text)
                    } catch (err) {
                      setUploadError(err instanceof Error ? err.message : 'Extraction failed')
                      setUploadFile(null)
                    } finally {
                      setExtracting(false)
                    }
                  }}
                />
                {extracting && <p className="text-xs text-[#1A6080] dark:text-[#4ebac4] mt-1">Extracting text…</p>}
                {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
              </div>

              {/* Extracted preview */}
              {uploadExtracted && (
                <div>
                  <label className={LABEL}>Extracted Content (edit if needed)</label>
                  <textarea
                    value={uploadExtracted}
                    onChange={e => setUploadExtracted(e.target.value)}
                    className={INPUT + ' min-h-[160px] resize-y font-mono text-xs'}
                  />
                </div>
              )}

              {uploadError === '' && uploadFile && !uploadExtracted && !extracting && (
                <p className="text-xs text-gray-500">Waiting for file selection…</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  disabled={uploading || !uploadName.trim() || !uploadExtracted.trim()}
                  onClick={async () => {
                    if (!uploadName.trim() || !uploadExtracted.trim()) return
                    setUploading(true)
                    setUploadError('')
                    try {
                      const fd = new FormData()
                      fd.append('name', uploadName.trim())
                      fd.append('content', uploadExtracted.trim())
                      if (uploadFile) fd.append('file', uploadFile)
                      const res = await fetchWithAuth('/api/tenant/offer-letter-templates', { method: 'POST', body: fd })
                      if (!res.ok) {
                        const d = await res.json()
                        throw new Error(d.error ?? 'Upload failed')
                      }
                      await loadCustomTemplates()
                      setShowUpload(false)
                    } catch (err) {
                      setUploadError(err instanceof Error ? err.message : 'Upload failed')
                    } finally {
                      setUploading(false)
                    }
                  }}
                  className="flex-1 py-2.5 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                  {uploading ? 'Saving…' : 'Save Template'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-5 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white text-sm rounded-lg transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden printable div */}
      <div ref={printRef} className="hidden" />
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </div>
  )
}
