'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

// ─── Types ───────────────────────────────────────────────────────────────────

type Lead = {
  id: string; firstName: string; lastName: string | null; email: string | null
  phone: string | null; company: string | null; jobTitle: string | null
  source: string | null; status: string; stage: string; score: number | null
  assignedTo: string | null; notes: string | null; createdAt: string
}

type Contact = {
  id: string; firstName: string; lastName: string | null; email: string | null
  phone: string | null; jobTitle: string | null; accountId: string | null
  assignedTo: string | null; createdAt: string
}

type Account = {
  id: string; name: string; industry: string | null; website: string | null
  phone: string | null; email: string | null; city: string | null
  country: string | null; type: string | null; status: string | null
  assignedTo: string | null; createdAt: string
}

type Deal = {
  id: string; title: string; value: string | null; currency: string | null
  stage: string; probability: number | null; closeDate: string | null
  accountId: string | null; accountName: string | null; assignedTo: string | null
  createdAt: string
}

type Activity = {
  id: string; type: string; subject: string; notes: string | null
  dueDate: string | null; isDone: boolean; relatedType: string | null
  relatedId: string | null; assignedTo: string | null; createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LEAD_STAGES = [
  { key: 'new',        label: 'New',         color: '#6366f1' },
  { key: 'contacted',  label: 'Contacted',   color: '#f59e0b' },
  { key: 'qualified',  label: 'Qualified',   color: '#3b82f6' },
  { key: 'converted',  label: 'Converted',   color: '#10b981' },
  { key: 'lost',       label: 'Lost',        color: '#ef4444' },
]

const DEAL_STAGES = [
  { key: 'prospecting',   label: 'Prospecting',   prob: 10  },
  { key: 'qualification', label: 'Qualification', prob: 25  },
  { key: 'proposal',      label: 'Proposal',      prob: 50  },
  { key: 'negotiation',   label: 'Negotiation',   prob: 75  },
  { key: 'closed_won',    label: 'Closed Won',    prob: 100 },
  { key: 'closed_lost',   label: 'Closed Lost',   prob: 0   },
]

const ACTIVITY_TYPES = ['call','email','meeting','note','task']
const ACTIVITY_ICONS: Record<string,string> = { call:'📞', email:'📧', meeting:'🤝', note:'📝', task:'✅' }

const stageColor = (s: string) => {
  const map: Record<string,string> = {
    new:'#6366f1', contacted:'#f59e0b', qualified:'#3b82f6', converted:'#10b981', lost:'#ef4444',
    prospecting:'#E8973A', qualification:'#f59e0b', proposal:'#3b82f6',
    negotiation:'#f97316', closed_won:'#10b981', closed_lost:'#ef4444',
  }
  return map[s] ?? '#6b7280'
}

// Dynamic-color badge — keeps inline styles intentionally (hex alpha blending)
function ColorBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: color + '22',
      color,
      border: `1px solid ${color}55`,
      borderRadius: 6,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>
      {label.replace(/_/g,' ')}
    </span>
  )
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
  const colors = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ec4899','#14b8a6','#f97316']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function fmt(v: string | null | undefined) {
  if (!v) return '—'
  const n = Number(v)
  if (isNaN(n)) return v
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card-premium w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="m-0 text-base font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="bg-transparent border-none text-xl cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <label className="section-label">{label}</label>
      {children}
    </div>
  )
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { key:'leads',     label:'Leads',      desc:'Pipeline & scoring' },
  { key:'contacts',  label:'👤 Contacts',   desc:'People' },
  { key:'accounts',  label:'Accounts',   desc:'Companies' },
  { key:'deals',     label:'💰 Deals',      desc:'Revenue pipeline' },
  { key:'activities',label:'📋 Activities', desc:'Tasks & calls' },
]

// ─── Leads Kanban ────────────────────────────────────────────────────────────

function LeadsTab() {
  const [leads, setLeads]       = useState<Lead[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [form, setForm]         = useState({ firstName:'', lastName:'', email:'', phone:'', company:'', jobTitle:'', source:'', stage:'new', notes:'' })
  const [saving, setSaving]     = useState(false)
  const [confirm, setConfirm]   = useState<ConfirmState>(null)
  const [toast, setToast]       = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetchWithAuth(`/api/tenant/crm/leads${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      const d = await r.json()
      setLeads(d.leads ?? [])
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.firstName.trim()) return
    setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/crm/leads', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      setModal(false); setForm({ firstName:'', lastName:'', email:'', phone:'', company:'', jobTitle:'', source:'', stage:'new', notes:'' }); load()
    } finally { setSaving(false) }
  }

  const moveStage = async (id: string, stage: string) => {
    await fetchWithAuth(`/api/tenant/crm/leads/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ stage }) })
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l))
  }

  const deleteLead = async (id: string) => {
    const res = await fetchWithAuth(`/api/tenant/crm/leads/${id}`, { method:'DELETE' })
    if (res.ok) { setLeads(prev => prev.filter(l => l.id !== id)); setToast({ message: 'Lead deleted', type: 'success' }) }
    else setToast({ message: 'Failed to delete lead', type: 'error' })
  }

  const stageLeads = (s: string) => leads.filter(l => l.stage === s)

  const exportLeadsCsv = () => exportCsv({
    filename: 'crm-leads',
    columns: [
      { header: 'First Name', key: 'firstName' },
      { header: 'Last Name',  key: 'lastName' },
      { header: 'Email',      key: 'email' },
      { header: 'Phone',      key: 'phone' },
      { header: 'Company',    key: 'company' },
      { header: 'Job Title',  key: 'jobTitle' },
      { header: 'Source',     key: 'source' },
      { header: 'Stage',      key: 'stage' },
      { header: 'Score',      key: 'score' },
      { header: 'Created',    key: 'createdAt', format: fmtCsvDate },
    ],
    rows: leads,
  })

  return (
    <div>
      <div className="flex gap-3 mb-5 flex-wrap">
        <input placeholder="Search leads…" value={search} onChange={e => setSearch(e.target.value)}
          className="input-premium max-w-[280px]" />
        <ExportButton onClick={exportLeadsCsv} disabled={leads.length === 0} />
        <button onClick={() => setModal(true)}
          className="ml-auto bg-[#0E3D52] hover:bg-[#1A6080] text-white border-none rounded-lg px-4 py-2 font-semibold cursor-pointer text-sm transition-colors">
          + New Lead
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (
        <div className="grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: 'repeat(5, minmax(200px, 1fr))' }}>
          {LEAD_STAGES.map(stage => (
            <div key={stage.key}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragging) { moveStage(dragging, stage.key); setDragging(null) } }}
              className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 min-h-[200px]">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                <span className="font-semibold text-[13px] text-gray-700 dark:text-gray-300">{stage.label}</span>
                <span className="ml-auto bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5 text-[11px]">
                  {stageLeads(stage.key).length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {stageLeads(stage.key).map(lead => (
                  <div key={lead.id} draggable
                    onDragStart={() => setDragging(lead.id)}
                    onDragEnd={() => setDragging(null)}
                    className="group bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm cursor-grab select-none border-2 transition-colors relative"
                    style={{ borderColor: dragging === lead.id ? stage.color : 'transparent' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirm({ message: `Delete lead ${lead.firstName} ${lead.lastName}?`, confirmLabel: 'Delete', onConfirm: () => deleteLead(lead.id) }) }}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <div className="font-semibold text-[13px] text-gray-900 dark:text-white mb-0.5 pr-5">
                      {lead.firstName} {lead.lastName}
                    </div>
                    {lead.company && <div className="text-[11px] text-gray-500 dark:text-gray-400">{lead.company}</div>}
                    {lead.email   && <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{lead.email}</div>}
                    {lead.source  && <div className="mt-1.5"><ColorBadge label={lead.source} color="#6b7280" /></div>}
                    {(lead.score ?? 0) > 0 && (
                      <div className="mt-1.5 text-[11px] text-amber-500 font-semibold">⭐ Score: {lead.score}</div>
                    )}
                  </div>
                ))}
                {stageLeads(stage.key).length === 0 && (
                  <div className="text-center text-gray-300 dark:text-gray-600 text-xs py-3">Drop here</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {modal && (
        <Modal title="New Lead" onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name *">
              <input className="input-premium" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Jane" />
            </Field>
            <Field label="Last Name">
              <input className="input-premium" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Smith" />
            </Field>
            <Field label="Email">
              <input className="input-premium" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@company.com" />
            </Field>
            <Field label="Phone">
              <input className="input-premium" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+61 400 000 000" />
            </Field>
            <Field label="Company">
              <input className="input-premium" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="Acme Corp" />
            </Field>
            <Field label="Job Title">
              <input className="input-premium" value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} placeholder="HR Manager" />
            </Field>
            <Field label="Source">
              <select className="input-premium" value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                <option value="">— Select —</option>
                {['website','referral','linkedin','cold_call','email_campaign','event','other'].map(s => (
                  <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Stage">
              <select className="input-premium" value={form.stage} onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}>
                {LEAD_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input-premium min-h-[80px] resize-y" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Add any notes…" />
          </Field>
          <div className="flex gap-2.5 justify-end mt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={create} disabled={saving || !form.firstName.trim()}
              className="px-4 py-2 rounded-lg bg-[#0E3D52] hover:bg-[#1A6080] text-white border-none cursor-pointer font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Lead'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ firstName:'', lastName:'', email:'', phone:'', mobile:'', jobTitle:'', department:'', notes:'' })
  const [saving, setSaving]     = useState(false)
  const [confirm, setConfirm]   = useState<ConfirmState>(null)
  const [toast, setToast]       = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetchWithAuth(`/api/tenant/crm/contacts${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      const d = await r.json()
      setContacts(d.contacts ?? [])
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.firstName.trim()) return
    setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/crm/contacts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      setModal(false); setForm({ firstName:'', lastName:'', email:'', phone:'', mobile:'', jobTitle:'', department:'', notes:'' }); load()
    } finally { setSaving(false) }
  }

  const deleteContact = async (id: string) => {
    const res = await fetchWithAuth(`/api/tenant/crm/contacts/${id}`, { method:'DELETE' })
    if (res.ok) { setContacts(prev => prev.filter(c => c.id !== id)); setToast({ message: 'Contact deleted', type: 'success' }) }
    else setToast({ message: 'Failed to delete contact', type: 'error' })
  }

  const exportContactsCsv = () => exportCsv({
    filename: 'crm-contacts',
    columns: [
      { header: 'First Name', key: 'firstName' },
      { header: 'Last Name',  key: 'lastName' },
      { header: 'Email',      key: 'email' },
      { header: 'Phone',      key: 'phone' },
      { header: 'Job Title',  key: 'jobTitle' },
      { header: 'Created',    key: 'createdAt', format: fmtCsvDate },
    ],
    rows: contacts,
  })

  return (
    <div>
      <div className="flex gap-3 mb-5 flex-wrap">
        <input placeholder="Search contacts…" value={search} onChange={e => setSearch(e.target.value)} className="input-premium max-w-[280px]" />
        <ExportButton onClick={exportContactsCsv} disabled={contacts.length === 0} />
        <button onClick={() => setModal(true)}
          className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg px-4 py-2 font-semibold cursor-pointer text-sm transition-colors">
          + New Contact
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (
        <div className="table-responsive">
          <table className="table-premium">
            <thead>
              <tr>
                {['Name','Email','Phone','Job Title','Created',''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} className="group">
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${c.firstName} ${c.lastName ?? ''}`} size={32} />
                      <div>
                        <div className="font-semibold text-sm text-gray-900 dark:text-white">{c.firstName} {c.lastName}</div>
                        {c.accountId && <div className="text-[11px] text-gray-400">Has account</div>}
                      </div>
                    </div>
                  </td>
                  <td>{c.email ?? '—'}</td>
                  <td>{c.phone ?? '—'}</td>
                  <td>{c.jobTitle ?? '—'}</td>
                  <td className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleDateString('en-AU')}</td>
                  <td>
                    <button onClick={() => setConfirm({ message: `Delete contact ${c.firstName} ${c.lastName}?`, confirmLabel: 'Delete', onConfirm: () => deleteContact(c.id) })}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">No contacts yet. Create your first contact.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {modal && (
        <Modal title="New Contact" onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name *">
              <input className="input-premium" value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
            </Field>
            <Field label="Last Name">
              <input className="input-premium" value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
            </Field>
            <Field label="Email">
              <input className="input-premium" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <input className="input-premium" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </Field>
            <Field label="Job Title">
              <input className="input-premium" value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} />
            </Field>
            <Field label="Department">
              <input className="input-premium" value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input-premium min-h-[80px] resize-y" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </Field>
          <div className="flex gap-2.5 justify-end mt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={create} disabled={saving || !form.firstName.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border-none cursor-pointer font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Contact'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Accounts Tab ─────────────────────────────────────────────────────────────

function AccountsTab() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ name:'', industry:'', website:'', phone:'', email:'', address:'', city:'', state:'', abn:'', type:'prospect', notes:'' })
  const [saving, setSaving]     = useState(false)
  const [confirm, setConfirm]   = useState<ConfirmState>(null)
  const [toast, setToast]       = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetchWithAuth(`/api/tenant/crm/accounts${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      const d = await r.json()
      setAccounts(d.accounts ?? [])
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/crm/accounts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      setModal(false); setForm({ name:'', industry:'', website:'', phone:'', email:'', address:'', city:'', state:'', abn:'', type:'prospect', notes:'' }); load()
    } finally { setSaving(false) }
  }

  const deleteAccount = async (id: string) => {
    const res = await fetchWithAuth(`/api/tenant/crm/accounts/${id}`, { method:'DELETE' })
    if (res.ok) { setAccounts(prev => prev.filter(a => a.id !== id)); setToast({ message: 'Account deleted', type: 'success' }) }
    else setToast({ message: 'Failed to delete account', type: 'error' })
  }

  const ACCOUNT_TYPES = ['prospect','customer','partner','vendor']
  const TYPE_COLORS: Record<string,string> = { prospect:'#6366f1', customer:'#10b981', partner:'#f59e0b', vendor:'#6b7280' }

  const exportAccountsCsv = () => exportCsv({
    filename: 'crm-accounts',
    columns: [
      { header: 'Name',     key: 'name' },
      { header: 'Industry', key: 'industry' },
      { header: 'Type',     key: 'type' },
      { header: 'Email',    key: 'email' },
      { header: 'Phone',    key: 'phone' },
      { header: 'City',     key: 'city' },
      { header: 'Country',  key: 'country' },
      { header: 'Created',  key: 'createdAt', format: fmtCsvDate },
    ],
    rows: accounts,
  })

  return (
    <div>
      <div className="flex gap-3 mb-5 flex-wrap">
        <input placeholder="Search accounts…" value={search} onChange={e => setSearch(e.target.value)} className="input-premium max-w-[280px]" />
        <ExportButton onClick={exportAccountsCsv} disabled={accounts.length === 0} />
        <button onClick={() => setModal(true)}
          className="ml-auto bg-[#0E3D52] hover:bg-[#1A6080] text-white border-none rounded-lg px-4 py-2 font-semibold cursor-pointer text-sm transition-colors">
          + New Account
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {accounts.map(a => (
            <div key={a.id} className="card-premium p-4 group relative">
              <button onClick={() => setConfirm({ message: `Delete account ${a.name}?`, confirmLabel: 'Delete', onConfirm: () => deleteAccount(a.id) })}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
              <div className="flex items-start gap-3 mb-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#E0EEF4] dark:bg-[#0E3D52]/20 flex items-center justify-center flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#1A6080] dark:text-[#4ebac4]"><rect x="2" y="7" width="20" height="14" rx="1"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[15px] text-gray-900 dark:text-white truncate">{a.name}</div>
                  {a.industry && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{a.industry}</div>}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-2.5">
                {a.type && <ColorBadge label={a.type} color={TYPE_COLORS[a.type] ?? '#6b7280'} />}
              </div>
              {a.email && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">📧 {a.email}</div>}
              {a.phone && <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">📞 {a.phone}</div>}
              {a.city  && <div className="text-xs text-gray-400 dark:text-gray-500">📍 {a.city}{a.country ? `, ${a.country}` : ''}</div>}
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-400">No accounts yet.</div>
          )}
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {modal && (
        <Modal title="New Account" onClose={() => setModal(false)}>
          <Field label="Account Name *">
            <input className="input-premium" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Industry">
              <input className="input-premium" value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} placeholder="Healthcare" />
            </Field>
            <Field label="Type">
              <select className="input-premium" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Email">
              <input className="input-premium" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <input className="input-premium" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </Field>
            <Field label="Website">
              <input className="input-premium" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://…" />
            </Field>
            <Field label="ABN">
              <input className="input-premium" value={form.abn} onChange={e => setForm(p => ({ ...p, abn: e.target.value }))} placeholder="00 000 000 000" />
            </Field>
            <Field label="City">
              <input className="input-premium" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
            </Field>
            <Field label="State">
              <input className="input-premium" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input-premium min-h-[80px] resize-y" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </Field>
          <div className="flex gap-2.5 justify-end mt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={create} disabled={saving || !form.name.trim()}
              className="px-4 py-2 rounded-lg bg-[#0E3D52] hover:bg-[#1A6080] text-white border-none cursor-pointer font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Deals Tab ────────────────────────────────────────────────────────────────

function DealsTab() {
  const [deals, setDeals]       = useState<Deal[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const [form, setForm]         = useState({ title:'', value:'', stage:'prospecting', probability:10, closeDate:'', notes:'' })
  const [saving, setSaving]     = useState(false)
  const [confirm, setConfirm]   = useState<ConfirmState>(null)
  const [toast, setToast]       = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetchWithAuth('/api/tenant/crm/deals')
      const d = await r.json()
      setDeals(d.deals ?? [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/crm/deals', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...form, value: form.value || null }) })
      setModal(false); setForm({ title:'', value:'', stage:'prospecting', probability:10, closeDate:'', notes:'' }); load()
    } finally { setSaving(false) }
  }

  const moveStage = async (id: string, stage: string) => {
    const ds = DEAL_STAGES.find(s => s.key === stage)
    await fetchWithAuth(`/api/tenant/crm/deals/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ stage, probability: ds?.prob }) })
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage, probability: ds?.prob ?? d.probability } : d))
  }

  const deleteDeal = async (id: string) => {
    const res = await fetchWithAuth(`/api/tenant/crm/deals/${id}`, { method:'DELETE' })
    if (res.ok) { setDeals(prev => prev.filter(d => d.id !== id)); setToast({ message: 'Deal deleted', type: 'success' }) }
    else setToast({ message: 'Failed to delete deal', type: 'error' })
  }

  const stageDeals = (s: string) => deals.filter(d => d.stage === s)
  const stageValue = (s: string) => stageDeals(s).reduce((sum, d) => sum + Number(d.value ?? 0), 0)

  const exportDealsCsv = () => exportCsv({
    filename: 'crm-deals',
    columns: [
      { header: 'Title',       key: 'title' },
      { header: 'Value',       key: 'value' },
      { header: 'Stage',       key: 'stage' },
      { header: 'Probability', key: 'probability' },
      { header: 'Close Date',  key: 'closeDate',  format: fmtCsvDate },
      { header: 'Account',     key: 'accountName' },
      { header: 'Assigned To', key: 'assignedTo' },
      { header: 'Created',     key: 'createdAt',  format: fmtCsvDate },
    ],
    rows: deals,
  })

  return (
    <div>
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="flex gap-2.5 flex-wrap">
          {['closed_won','prospecting','proposal'].map(s => {
            const total = deals.filter(d => d.stage === s).reduce((sum, d) => sum + Number(d.value ?? 0), 0)
            const label = s === 'closed_won' ? '✅ Won' : s === 'prospecting' ? '🔍 Pipeline' : '📄 In Proposal'
            return total > 0 ? (
              <div key={s} className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">{label}: </span>
                <span className={`font-bold ${s === 'closed_won' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>{fmt(String(total))}</span>
              </div>
            ) : null
          })}
        </div>
        <ExportButton onClick={exportDealsCsv} disabled={deals.length === 0} />
        <button onClick={() => setModal(true)}
          className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg px-4 py-2 font-semibold cursor-pointer text-sm transition-colors">
          + New Deal
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (
        <div className="grid gap-2.5 overflow-x-auto pb-2" style={{ gridTemplateColumns: 'repeat(6, minmax(170px, 1fr))' }}>
          {DEAL_STAGES.map(stage => (
            <div key={stage.key}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragging) { moveStage(dragging, stage.key); setDragging(null) } }}
              className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-2.5 min-h-[200px]">
              <div className="mb-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stageColor(stage.key) }} />
                  <span className="font-semibold text-[12px] text-gray-700 dark:text-gray-300">{stage.label}</span>
                  <span className="ml-auto bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full px-1.5 text-[10px]">{stageDeals(stage.key).length}</span>
                </div>
                {stageValue(stage.key) > 0 && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 pl-3.5 font-semibold">{fmt(String(stageValue(stage.key)))}</div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {stageDeals(stage.key).map(deal => (
                  <div key={deal.id} draggable
                    onDragStart={() => setDragging(deal.id)}
                    onDragEnd={() => setDragging(null)}
                    className="group bg-white dark:bg-gray-800 rounded-lg p-2.5 shadow-sm cursor-grab select-none border-2 transition-colors relative"
                    style={{ borderColor: dragging === deal.id ? stageColor(stage.key) : 'transparent' }}>
                    <button onClick={e => { e.stopPropagation(); setConfirm({ message: `Delete deal "${deal.title}"?`, confirmLabel: 'Delete', onConfirm: () => deleteDeal(deal.id) }) }}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <div className="font-semibold text-[12px] text-gray-900 dark:text-white mb-0.5 pr-4">{deal.title}</div>
                    {deal.accountName && <div className="text-[11px] text-gray-500 dark:text-gray-400">{deal.accountName}</div>}
                    {deal.value      && <div className="text-[12px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">{fmt(deal.value)}</div>}
                    {deal.closeDate  && <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Close: {deal.closeDate}</div>}
                    <div className="mt-1 h-[3px] bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${deal.probability ?? 0}%`, background: stageColor(stage.key) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {modal && (
        <Modal title="New Deal" onClose={() => setModal(false)}>
          <Field label="Deal Title *">
            <input className="input-premium" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Enterprise HRMS — Acme Corp" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value (AUD)">
              <input className="input-premium" type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} placeholder="50000" />
            </Field>
            <Field label="Stage">
              <select className="input-premium" value={form.stage} onChange={e => {
                const ds = DEAL_STAGES.find(s => s.key === e.target.value)
                setForm(p => ({ ...p, stage: e.target.value, probability: ds?.prob ?? p.probability }))
              }}>
                {DEAL_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Probability (%)">
              <input className="input-premium" type="number" min={0} max={100} value={form.probability} onChange={e => setForm(p => ({ ...p, probability: Number(e.target.value) }))} />
            </Field>
            <Field label="Close Date">
              <input className="input-premium" type="date" value={form.closeDate} onChange={e => setForm(p => ({ ...p, closeDate: e.target.value }))} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="input-premium min-h-[80px] resize-y" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </Field>
          <div className="flex gap-2.5 justify-end mt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={create} disabled={saving || !form.title.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border-none cursor-pointer font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Creating…' : 'Create Deal'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Activities Tab ───────────────────────────────────────────────────────────

function ActivitiesTab() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [filter, setFilter]         = useState<'all'|'pending'|'done'>('all')
  const [form, setForm]             = useState({ type:'call', subject:'', notes:'', dueDate:'', assignedTo:'' })
  const [saving, setSaving]         = useState(false)
  const [confirm, setConfirm]       = useState<ConfirmState>(null)
  const [toast, setToast]           = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter === 'pending' ? '?isDone=false' : filter === 'done' ? '?isDone=true' : ''
      const r = await fetchWithAuth(`/api/tenant/crm/activities${params}`)
      const d = await r.json()
      setActivities(d.activities ?? [])
    } finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!form.subject.trim()) return
    setSaving(true)
    try {
      await fetchWithAuth('/api/tenant/crm/activities', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      setModal(false); setForm({ type:'call', subject:'', notes:'', dueDate:'', assignedTo:'' }); load()
    } finally { setSaving(false) }
  }

  const deleteActivity = async (id: string) => {
    const res = await fetchWithAuth(`/api/tenant/crm/activities/${id}`, { method:'DELETE' })
    if (res.ok) { setActivities(prev => prev.filter(a => a.id !== id)); setToast({ message: 'Activity deleted', type: 'success' }) }
    else setToast({ message: 'Failed to delete activity', type: 'error' })
  }

  const markDone = async (id: string) => {
    await fetchWithAuth('/api/tenant/crm/activities', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, isDone: true }) })
    setActivities(prev => prev.map(a => a.id === id ? { ...a, isDone: true } : a))
  }

  return (
    <div>
      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-0">
          {(['all','pending','done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-md border-none cursor-pointer font-semibold text-sm transition-all ${
                filter === f
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <ExportButton onClick={() => exportCsv({
          filename: 'crm-activities',
          columns: [
            { header: 'Type',        key: 'type' },
            { header: 'Subject',     key: 'subject' },
            { header: 'Notes',       key: 'notes' },
            { header: 'Due Date',    key: 'dueDate',    format: fmtCsvDate },
            { header: 'Done',        key: 'isDone',     format: (v: unknown) => v ? 'Yes' : 'No' },
            { header: 'Assigned To', key: 'assignedTo' },
            { header: 'Created',     key: 'createdAt',  format: fmtCsvDate },
          ],
          rows: activities,
        })} disabled={activities.length === 0} />
        <button onClick={() => setModal(true)}
          className="ml-auto bg-amber-500 hover:bg-amber-600 text-white border-none rounded-lg px-4 py-2 font-semibold cursor-pointer text-sm transition-colors">
          + Log Activity
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (
        <div className="flex flex-col gap-2">
          {activities.map(a => (
            <div key={a.id} className={`group card-premium p-3 px-4 flex items-center gap-3.5 transition-opacity ${a.isDone ? 'opacity-60' : ''}`}>
              <div className="text-xl">{ACTIVITY_ICONS[a.type] ?? '📋'}</div>
              <div className="flex-1 min-w-0">
                <div className={`font-semibold text-sm ${a.isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                  {a.subject}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {a.type}{a.dueDate ? ` · Due: ${new Date(a.dueDate).toLocaleDateString('en-AU')}` : ''}{a.assignedTo ? ` · ${a.assignedTo}` : ''}
                </div>
                {a.notes && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{a.notes}</div>}
              </div>
              {!a.isDone && (
                <button onClick={() => markDone(a.id)}
                  className="badge badge-green text-xs px-2.5 py-1 cursor-pointer border-none whitespace-nowrap">
                  ✓ Done
                </button>
              )}
              {a.isDone && <span className="badge badge-green">Done</span>}
              <button onClick={() => setConfirm({ message: `Delete activity "${a.subject}"?`, confirmLabel: 'Delete', onConfirm: () => deleteActivity(a.id) })}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
          {activities.length === 0 && (
            <div className="text-center py-10 text-gray-400">No activities yet.</div>
          )}
        </div>
      )}

      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />

      {modal && (
        <Modal title="Log Activity" onClose={() => setModal(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className="input-premium" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{ACTIVITY_ICONS[t]} {t}</option>)}
              </select>
            </Field>
            <Field label="Due Date">
              <input className="input-premium" type="datetime-local" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} />
            </Field>
          </div>
          <Field label="Subject *">
            <input className="input-premium" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="Follow-up call with Jane Smith" />
          </Field>
          <Field label="Notes">
            <textarea className="input-premium min-h-[80px] resize-y" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </Field>
          <div className="flex gap-2.5 justify-end mt-2">
            <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={create} disabled={saving || !form.subject.trim()}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white border-none cursor-pointer font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Log Activity'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [tab, setTab] = useState<'leads'|'contacts'|'accounts'|'deals'|'activities'>('leads')

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-premium-title">CRM</h1>
        <p className="page-premium-subtitle">Leads · Contacts · Accounts · Deals · Activities</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b-2 border-gray-100 dark:border-gray-800 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={`px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm font-semibold whitespace-nowrap transition-colors -mb-0.5 border-b-2 ${
              tab === t.key
                ? 'text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] border-[#0E3D52] dark:border-[#1A6080]'
                : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'leads'      && <LeadsTab />}
      {tab === 'contacts'   && <ContactsTab />}
      {tab === 'accounts'   && <AccountsTab />}
      {tab === 'deals'      && <DealsTab />}
      {tab === 'activities' && <ActivitiesTab />}
    </div>
  )
}
