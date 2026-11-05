'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

type EmpResult  = { id: string; firstName: string; lastName: string; email: string; employeeNumber: string; isActive: boolean }
type DocResult  = { id: string; title: string; category: string; status: string; employeeId: string | null }
type PartResult = { id: string; firstName: string; lastName: string; ndisNumber: string | null; isActive: boolean }
type Results = { employees: EmpResult[]; documents: DocResult[]; participants: PartResult[] }
type Item =
  | { kind: 'employee';    data: EmpResult;  href: string; label: string; sub: string; icon: string }
  | { kind: 'document';    data: DocResult;  href: string; label: string; sub: string; icon: string }
  | { kind: 'participant'; data: PartResult; href: string; label: string; sub: string; icon: string }

function flattenResults(r: Results): Item[] {
  return [
    ...r.employees.map(e => ({ kind: 'employee' as const, data: e, href: `/tenant/employee-management/${e.id}`, label: `${e.firstName} ${e.lastName}`, sub: `${e.employeeNumber} · ${e.email}`, icon: '👤' })),
    ...r.documents.map(d => ({ kind: 'document' as const, data: d, href: `/tenant/documents`, label: d.title, sub: d.category, icon: '📄' })),
    ...r.participants.map(p => ({ kind: 'participant' as const, data: p, href: `/tenant/participants`, label: `${p.firstName} ${p.lastName}`, sub: p.ndisNumber ? `NDIS ${p.ndisNumber}` : 'Participant', icon: '🧑' })),
  ]
}

export default function CommandPalette() {
  const router = useRouter()
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Results>({ employees: [], documents: [], participants: [] })
  const [loading, setLoading] = useState(false)
  const [cursor,  setCursor]  = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(v => !v) }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(''); setResults({ employees: [], documents: [], participants: [] }); setCursor(0) }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults({ employees: [], documents: [], participants: [] }); return }
    setLoading(true)
    try {
      const res  = await fetchWithAuth(`/api/tenant/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data); setCursor(0)
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  function handleInput(q: string) {
    setQuery(q)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => search(q), 200)
  }

  const items = flattenResults(results)
  const total = items.length

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, total - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && items[cursor]) { router.push(items[cursor].href); setOpen(false) }
  }

  function navigate(href: string) { router.push(href); setOpen(false) }

  if (!open) return null

  const groups = [
    { label: 'Employees',    kind: 'employee',    color: 'text-[#0E3D52] dark:text-[#4ebac4]' },
    { label: 'Documents',    kind: 'document',    color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Participants', kind: 'participant',  color: 'text-amber-600 dark:text-amber-400' },
  ]
  const hasResults = total > 0
  const isEmpty    = query.length >= 2 && !loading && !hasResults

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="text-gray-400 text-sm flex-shrink-0">
            {loading ? <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" /> : '🔍'}
          </span>
          <input ref={inputRef} value={query} onChange={e => handleInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Search employees, documents, participants…" className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400" />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {!hasResults && !isEmpty && query.length < 2 && <div className="px-4 py-6 text-center text-xs text-gray-400">Type at least 2 characters to search</div>}
          {isEmpty && <div className="px-4 py-8 text-center text-sm text-gray-400">No results for <span className="font-medium text-gray-600 dark:text-gray-300">"{query}"</span></div>}
          {hasResults && groups.map(g => {
            const groupItems = items.filter(i => i.kind === g.kind)
            if (groupItems.length === 0) return null
            return (
              <div key={g.kind}>
                <div className={`px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider ${g.color}`}>{g.label}</div>
                {groupItems.map(item => {
                  const idx = items.indexOf(item); const active = idx === cursor
                  return (
                    <button key={item.data.id} onClick={() => navigate(item.href)} onMouseEnter={() => setCursor(idx)} className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${active ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${active ? 'text-[#0E3D52] dark:text-[#4ebac4]' : 'text-gray-900 dark:text-white'}`}>{item.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.sub}</p>
                      </div>
                      {active && <span className="text-xs text-[#4ebac4] flex-shrink-0">↵ open</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
          {hasResults && <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 flex gap-4 text-[10px] text-gray-400"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span><span className="ml-auto">{total} result{total !== 1 ? 's' : ''}</span></div>}
        </div>
      </div>
    </div>
  )
}
