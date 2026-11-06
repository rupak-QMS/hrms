'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useState, useEffect, useCallback, useRef } from 'react'
import ConfirmModal, { type ConfirmState } from '@/components/ui/ConfirmModal'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ExportButton } from '@/components/ui/ExportButton'
import { exportCsv, fmtCsvDate } from '@/lib/exportCsv'

type Contract = {
  id:string; employeeId:string; type:string; status:string
  sentAt:string|null; signedAt:string|null; tfnProvided:boolean; superFund:string|null
  pdfUrl:string|null; createdAt:string
  firstName:string|null; lastName:string|null; email:string|null; employmentType:string|null
}
type Stats = { total:number; draft:number; sent:number; signed:number; expired:number }
type Employee = { id:string; firstName:string; lastName:string }

const STATUS_COLORS: Record<string,string> = {
  draft:'bg-gray-100 text-gray-600', sent:'bg-[#E0EEF4] text-[#0E3D52]',
  signed:'bg-green-100 text-green-700', expired:'bg-red-100 text-red-700',
}

const CONTRACT_TYPES = ['employment','casual','contractor','volunteer','fixed_term']

export default function ContractingPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [stats, setStats]         = useState<Stats>({ total:0,draft:0,sent:0,signed:0,expired:0 })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected]   = useState<Contract|null>(null)
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatus] = useState('')
  const [search, setSearch]       = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ employeeId:'', type:'employment' })
  const [confirm,   setConfirm]   = useState<ConfirmState>(null)
  const [toast,     setToast]     = useState<ToastState>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (statusFilter) p.set('status', statusFilter)
    if (search)       p.set('search', search)
    const res = await fetchWithAuth(`/api/tenant/contracting?${p}`)
    if (res.ok) { const d = await res.json(); setContracts(d.contracts ?? []); setStats(d.stats ?? {}) }
    setLoading(false)
  }, [statusFilter, search])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetchWithAuth('/api/tenant/employees?limit=200').then(r => r.json()).then(d => setEmployees(d.employees ?? []))
  }, [])

  async function create() {
    setSaving(true)
    const res = await fetchWithAuth('/api/tenant/contracting', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
    if (res.ok) { const d = await res.json(); setShowCreate(false); await load(); setSelected(d.contract ?? null) }
    setSaving(false)
  }

  async function deleteContract(id: string) {
    const res = await fetchWithAuth(`/api/tenant/contracting/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setContracts(prev => prev.filter(c => c.id !== id))
      if (selected?.id === id) setSelected(null)
      setToast({ message: 'Contract deleted', type: 'success' })
    } else {
      setToast({ message: 'Failed to delete contract', type: 'error' })
    }
  }

  async function patch(id:string, updates:Record<string,unknown>) {
    await fetchWithAuth('/api/tenant/contracting', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id,...updates}) })
    load(); if(selected?.id===id) setSelected(s=>s?{...s,...updates as any}:s)
  }

  function exportContracts() {
    exportCsv({
      filename: 'contracts',
      columns: [
        { header: 'Contractor Name', key: 'firstName', format: (_, r) => `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() },
        { header: 'Contract Type', key: 'type', format: v => v.replace(/_/g, ' ') },
        { header: 'Sent Date', key: 'sentAt', format: v => fmtCsvDate(v) },
        { header: 'Signed Date', key: 'signedAt', format: v => fmtCsvDate(v) },
        { header: 'Status', key: 'status' },
        { header: 'Employment Type', key: 'employmentType', format: v => v ?? '' },
      ],
      rows: contracts,
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between dark:bg-gray-900 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Contracting</h1>
          <p className="text-sm text-gray-500 mt-0.5 dark:text-gray-400">Employment contracts — draft, send, track signatures</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton onClick={exportContracts} disabled={contracts.length === 0} />
          <button onClick={()=>setShowCreate(true)} className="btn-primary">+ New Contract</button>
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex gap-6 dark:bg-gray-800 dark:border-gray-800">
        {[{label:'Total',value:stats.total,cls:'text-gray-900'},{label:'Draft',value:stats.draft,cls:'text-gray-500'},{label:'Sent',value:stats.sent,cls:'text-[#0E3D52] dark:text-[#4ebac4]'},{label:'Signed',value:stats.signed,cls:'text-green-600'},{label:'Expired',value:stats.expired,cls:'text-red-600'}].map(s=>(
          <div key={s.label} className="text-center"><p className={`text-xl font-bold ${s.cls}`}>{s.value}</p><p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p></div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white dark:bg-gray-900 dark:border-gray-700">
          <div className="p-3 border-b border-gray-100 space-y-2 dark:border-gray-800">
            <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm dark:border-gray-700" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <select className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs dark:border-gray-700" value={statusFilter} onChange={e=>setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['draft','sent','signed','expired'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <p className="p-4 text-sm text-gray-600 dark:text-gray-400">Loading…</p> : contracts.length===0 ? <p className="p-6 text-sm text-gray-600 dark:text-gray-400 text-center">No contracts</p> : contracts.map(c=>(
              <div key={c.id} className={`group relative border-b border-gray-100 hover:bg-gray-50 transition dark:border-gray-800 ${selected?.id===c.id?'bg-[#E0EEF4] border-l-2 border-l-[#0E3D52]':''}`}>
                <button onClick={()=>setSelected(c)} className="w-full text-left px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate dark:text-white">{c.firstName} {c.lastName}</p>
                      <p className="text-xs text-gray-500 capitalize dark:text-gray-400">{c.type.replace(/_/g,' ')}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[c.status]??''}`}>{c.status}</span>
                  </div>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-1">{new Date(c.createdAt).toLocaleDateString()}</p>
                </button>
                <button
                  onClick={e=>{ e.stopPropagation(); setConfirm({ message: `Delete contract for ${c.firstName} ${c.lastName}? This cannot be undone.`, confirmLabel: 'Delete', onConfirm: () => deleteContract(c.id) }) }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  title="Delete contract"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {selected ? (
          <div className="flex-1 p-6 overflow-y-auto bg-white space-y-5 dark:bg-gray-900">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selected.firstName} {selected.lastName}</h2>
                <p className="text-sm text-gray-500 capitalize dark:text-gray-400">{selected.type.replace(/_/g,' ')} contract · {selected.email}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[selected.status]??''}`}>{selected.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Status</label>
                <select className="input-premium" value={selected.status}
                  onChange={e=>{patch(selected.id,{status:e.target.value});setSelected({...selected,status:e.target.value})}}>
                  {['draft','sent','signed','expired'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Super Fund</label>
                <input className="input-premium" defaultValue={selected.superFund??''} onBlur={e=>patch(selected.id,{superFund:e.target.value||null})}/>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer dark:text-gray-300">
                <input type="checkbox" checked={selected.tfnProvided} onChange={e=>{patch(selected.id,{tfnProvided:e.target.checked});setSelected({...selected,tfnProvided:e.target.checked})}}/>
                TFN Provided
              </label>
            </div>

            {selected.sentAt && <p className="text-xs text-gray-600 dark:text-gray-400">Sent: {new Date(selected.sentAt).toLocaleString()}</p>}
            {selected.signedAt && <p className="text-xs text-green-600 font-medium">✅ Signed: {new Date(selected.signedAt).toLocaleString()}</p>}

            {/* E-signature section */}
            <SendForSignaturePanel
              contract={selected}
              onSent={(updates) => {
                setSelected(s => s ? { ...s, ...updates } : s)
                load()
              }}
            />

            {/* PDF viewer */}
            {selected.pdfUrl && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Contract Document</p>
                  <a href={selected.pdfUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-[#0E3D52] dark:text-[#4ebac4] hover:underline">Open in new tab ↗</a>
                </div>
                <iframe src={selected.pdfUrl} className="w-full h-96 border border-gray-200 rounded-lg dark:border-gray-700" title="Contract PDF"/>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400">Select a contract to view details</div>
        )}
      </div>

      {showCreate && (
        <div className="modal-overlay">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 dark:text-white">New Contract</h3>
            <div className="space-y-3">
              <select className="input-premium" value={form.employeeId} onChange={e=>setForm(f=>({...f,employeeId:e.target.value}))}>
                <option value="">Select employee *</option>
                {employees.map(e=><option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
              </select>
              <select className="input-premium" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {CONTRACT_TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 dark:text-gray-400 dark:border-gray-700">Cancel</button>
              <button onClick={create} disabled={saving||!form.employeeId} className="flex-1 btn-primary">{saving?'Creating…':'Create'}</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  )
}

// ── Send for Signature Panel ─────────────────────────────────────────────────

function SendForSignaturePanel({
  contract,
  onSent,
}: {
  contract: Contract
  onSent: (updates: Partial<Contract>) => void
}) {
  const [file, setFile]       = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const [copyDone, setCopyDone] = useState(false)
  const fileRef               = useRef<HTMLInputElement>(null)

  const signingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/offer/${contract.id}`
    : `/offer/${contract.id}`

  async function sendForSignature() {
    setSending(true); setError('')
    try {
      const fd = new FormData()
      if (file) fd.append('file', file)
      fd.append('baseUrl', window.location.origin)

      const res = await fetchWithAuth(`/api/tenant/contracting/${contract.id}/send`, {
        method: 'POST',
        body:   fd,
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to send'); setSending(false); return }

      onSent({ status: 'sent', sentAt: new Date().toISOString(), pdfUrl: data.pdfUrl ?? contract.pdfUrl })
      setSent(true)
    } catch (e: any) {
      setError(e.message ?? 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(signingUrl)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  // If already signed — show read-only confirmation
  if (contract.status === 'signed') {
    return (
      <div className="border border-green-200 bg-green-50 rounded-xl p-4 dark:bg-green-950/30 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-600 text-lg">✅</span>
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">Contract signed electronically</p>
        </div>
        {contract.pdfUrl && (
          <a href={contract.pdfUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-green-700 hover:underline dark:text-green-400">View contract document ↗</a>
        )}
      </div>
    )
  }

  // If sent but not signed — show status + copy link
  if (contract.status === 'sent' && !sent) {
    return (
      <div className="border border-blue-200 bg-[#E0EEF4] rounded-xl p-4 space-y-3 dark:bg-blue-950/30 dark:border-[#1A6080]">
        <div className="flex items-center gap-2">
          <span className="text-[#0E3D52] dark:text-[#4ebac4] text-lg">📧</span>
          <p className="text-sm font-semibold text-blue-800 dark:text-[#7dcfd7]">Awaiting employee signature</p>
        </div>
        <p className="text-xs text-[#0E3D52] dark:text-[#4ebac4]">
          The signing link has been emailed to <strong>{contract.email}</strong>.
          You can also share the link directly:
        </p>
        <div className="flex gap-2">
          <input readOnly value={signingUrl}
            className="flex-1 border border-blue-200 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-[#0E3D52]/20 dark:border-[#1A6080] dark:text-blue-200 truncate"/>
          <button onClick={copyLink}
            className="px-3 py-1.5 border border-blue-300 rounded-lg text-xs font-medium text-[#0E3D52] hover:bg-[#E0EEF4] dark:text-[#7dcfd7] dark:border-[#0E3D52] dark:hover:bg-blue-800 shrink-0">
            {copyDone ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <button onClick={sendForSignature} disabled={sending}
          className="text-xs text-[#0E3D52] dark:text-[#4ebac4] hover:underline dark:text-[#4ebac4] disabled:opacity-50">
          {sending ? 'Resending…' : 'Resend email'}
        </button>
      </div>
    )
  }

  // Draft (or just-sent) — show upload + send form
  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 dark:border-gray-700">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-lg">📄</span>
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Send for e-signature</p>
      </div>

      {sent ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 dark:bg-green-950/30 dark:border-green-800">
            <span className="text-green-600 mt-0.5">✓</span>
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Sent successfully!</p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                Signing link emailed to <strong>{contract.email}</strong>
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input readOnly value={signingUrl}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-800 truncate"/>
            <button onClick={copyLink}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800 shrink-0">
              {copyDone ? '✓ Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* PDF upload */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5 dark:text-gray-400">
              Contract PDF <span className="font-normal text-gray-400">(optional — attach to send with the signing email)</span>
            </label>
            {contract.pdfUrl && !file ? (
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                <span>📎</span>
                <a href={contract.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[#0E3D52] dark:text-[#4ebac4] hover:underline">
                  Existing PDF ↗
                </a>
                <span className="text-gray-400">— upload a new file to replace it</span>
              </div>
            ) : null}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-[#1A6080] hover:bg-[#E0EEF4] transition dark:border-gray-700 dark:hover:border-[#0E3D52] dark:hover:bg-[#0E3D52]/10"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[#0E3D52] dark:text-[#4ebac4]">📎</span>
                  <span className="text-sm font-medium text-[#0E3D52] dark:text-[#4ebac4]">{file.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null) }}
                    className="text-gray-400 hover:text-red-500 ml-1 text-xs"
                  >✕</button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Click to upload PDF <span className="text-gray-400">(max 10 MB)</span>
                </p>
              )}
            </div>
            <input
              ref={fileRef} type="file" accept="application/pdf"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button onClick={sendForSignature} disabled={sending}
              className="flex-1 btn-primary disabled:opacity-50">
              {sending ? 'Sending…' : '📧 Send for Signature'}
            </button>
            <button onClick={copyLink} title="Copy signing link"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
              {copyDone ? '✓' : '🔗'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            The employee will receive an email with a secure link to review and sign the contract electronically.
          </p>
        </>
      )}
    </div>
  )
}
