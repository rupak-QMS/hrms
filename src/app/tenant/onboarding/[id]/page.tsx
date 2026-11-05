'use client'
import { fetchWithAuth } from '@/lib/fetchWithAuth'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type ChecklistItem = { id: string; task: string; done: boolean; category: string }

type Record_ = {
  id: string
  employeeId: string
  stage: string
  status: string
  completedAt: string | null
  buddyId: string | null
  checklist: ChecklistItem[]
  notes: string | null
  createdAt: string
  employeeFirstName: string | null
  employeeLastName:  string | null
  employeeEmail:     string | null
  employeePositionId: string | null
  employeeStartDate: string | null
  employeePhotoUrl:  string | null
}

type Employee = { id: string; firstName: string; lastName: string; jobTitle: string | null }

const CATEGORIES = ['admin', 'it', 'hr', 'legal', 'compliance', 'culture']

const STAGE_LABELS: Record<string, string> = {
  pre_start:     'Pre-start',
  day1:          'Day 1',
  week1:         'Week 1',
  weeks2_4:      'Weeks 2–4',
  end_probation: 'End of Probation',
  fully_active:  'Fully Active',
}

const STAGES = Object.entries(STAGE_LABELS)

const CATEGORY_COLOR: Record<string, string> = {
  admin:      'bg-gray-700 text-gray-300',
  it:         'bg-blue-900/60 text-blue-300',
  hr:         'bg-[#0E3D52]/60 text-[#4ebac4]',
  legal:      'bg-amber-900/60 text-amber-300',
  compliance: 'bg-red-900/60 text-red-300',
  culture:    'bg-pink-900/60 text-pink-300',
}

const STATUS_STYLE: Record<string, string> = {
  pending:     'badge badge-amber',
  in_progress: 'badge badge-blue',
  completed:   'badge badge-green',
}

export default function OnboardingDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [rec,    setRec]    = useState<Record_ | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft,   setNotesDraft]   = useState('')
  const [notesSaving,  setNotesSaving]  = useState(false)

  // Buddy
  const [buddyName,     setBuddyName]     = useState<string | null>(null)
  const [showBuddyEdit, setShowBuddyEdit] = useState(false)
  const [allEmployees,  setAllEmployees]  = useState<Employee[]>([])
  const [buddyDraft,    setBuddyDraft]    = useState('')
  const [buddySaving,   setBuddySaving]   = useState(false)

  // Custom task
  const [addingTask,    setAddingTask]    = useState(false)
  const [newTaskText,   setNewTaskText]   = useState('')
  const [newTaskCat,    setNewTaskCat]    = useState('admin')
  const [taskSaving,    setTaskSaving]    = useState(false)

  useEffect(() => {
    fetchWithAuth(`/api/tenant/onboarding/${id}`)
      .then(r => r.json())
      .then(d => {
        const record = d.record ?? null
        setRec(record)
        if (record?.buddyId) {
          fetchWithAuth(`/api/tenant/employees?limit=200`)
            .then(r => r.json())
            .then(ed => {
              const buddy = (ed.employees ?? []).find((e: Employee) => e.id === record.buddyId)
              if (buddy) setBuddyName(`${buddy.firstName} ${buddy.lastName}`)
              setAllEmployees(ed.employees ?? [])
            })
        }
      })
  }, [id])

  async function saveNotes() {
    if (!rec) return
    setNotesSaving(true)
    try {
      const res  = await fetchWithAuth(`/api/tenant/onboarding/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notes: notesDraft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRec(r => r ? { ...r, notes: data.record.notes } : r)
      setEditingNotes(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setNotesSaving(false)
    }
  }

  async function saveBuddy() {
    if (!rec) return
    setBuddySaving(true)
    try {
      const res  = await fetchWithAuth(`/api/tenant/onboarding/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ buddyId: buddyDraft || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRec(r => r ? { ...r, buddyId: data.record.buddyId } : r)
      const buddy = allEmployees.find(e => e.id === buddyDraft)
      setBuddyName(buddy ? `${buddy.firstName} ${buddy.lastName}` : null)
      setShowBuddyEdit(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBuddySaving(false)
    }
  }

  async function addTask() {
    if (!rec || !newTaskText.trim()) return
    setTaskSaving(true)
    const newItem: ChecklistItem = {
      id:       `custom_${Date.now()}`,
      task:     newTaskText.trim(),
      done:     false,
      category: newTaskCat,
    }
    const updated = [...rec.checklist, newItem]
    try {
      const res  = await fetchWithAuth(`/api/tenant/onboarding/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ checklist: updated }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRec(r => r ? { ...r, checklist: updated, status: data.record.status, completedAt: data.record.completedAt } : r)
      setNewTaskText('')
      setNewTaskCat('admin')
      setAddingTask(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTaskSaving(false)
    }
  }

  async function toggleItem(itemId: string) {
    if (!rec) return
    const updated = rec.checklist.map(t =>
      t.id === itemId ? { ...t, done: !t.done } : t
    )
    setRec({ ...rec, checklist: updated })

    setSaving(true)
    try {
      const res  = await fetchWithAuth(`/api/tenant/onboarding/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ checklist: updated }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Reflect any auto-status change from server
      setRec(r => r ? { ...r, status: data.record.status, completedAt: data.record.completedAt } : r)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function advanceStage() {
    if (!rec) return
    const idx  = STAGES.findIndex(([k]) => k === rec.stage)
    const next = STAGES[idx + 1]?.[0]
    if (!next) return
    setSaving(true)
    try {
      const res  = await fetchWithAuth(`/api/tenant/onboarding/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stage: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRec(r => r ? { ...r, stage: data.record.stage } : r)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!rec) return <div className="text-gray-600 dark:text-gray-400">Loading…</div>

  const checklist = rec.checklist ?? []
  const done      = checklist.filter(t => t.done).length
  const pct       = checklist.length ? Math.round(done / checklist.length * 100) : 0
  const stageIdx  = STAGES.findIndex(([k]) => k === rec.stage)
  const canAdvance = stageIdx < STAGES.length - 1

  // Group checklist by category
  const grouped = checklist.reduce<Record<string, ChecklistItem[]>>((acc, t) => {
    ;(acc[t.category] = acc[t.category] ?? []).push(t)
    return acc
  }, {})

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#0E3D52] flex items-center justify-center text-white text-lg font-bold shrink-0">
            {(rec.employeeFirstName?.[0] ?? '?').toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {rec.employeeFirstName} {rec.employeeLastName}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">{rec.employeeEmail}</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {saved && <span className="text-xs text-green-400">Saved </span>}
          <span className={`text-xs px-3 py-1 rounded-full border font-medium ${STATUS_STYLE[rec.status] ?? 'bg-gray-800 text-gray-300 border-gray-700'}`}>
            {rec.status === 'in_progress' ? 'In Progress' : rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
          </span>
          <Link href="/tenant/onboarding"
            className="text-xs border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition">
            ← Back
          </Link>
        </div>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm text-red-600 dark:text-red-300">{error}</div>}

      {/* Progress + stage */}
      <div className="card-premium p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Overall Progress</p>
            <p className="text-2xl font-bold text-foreground">{pct}%
              <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">{done}/{checklist.length} tasks</span>
            </p>
          </div>
          {rec.employeeStartDate && (
            <div className="text-right">
              <p className="text-xs text-gray-600 dark:text-gray-400">Start Date</p>
              <p className="text-sm text-white">
                {new Date(rec.employeeStartDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>

        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
          <div className="h-2 rounded-full bg-[#f0f7fb]0 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>

        {/* Stage timeline */}
        <div className="flex items-center gap-1 pt-1">
          {STAGES.map(([key, label], i) => (
            <div key={key} className="flex items-center flex-1">
              <div className={`flex flex-col items-center flex-1 ${i < stageIdx ? 'opacity-100' : i === stageIdx ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                  i < stageIdx  ? 'bg-green-600 text-white' :
                  i === stageIdx ? 'bg-[#0E3D52] text-white ring-2 ring-[#4ebac4]' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {i < stageIdx ? '' : i + 1}
                </div>
                <p className="text-[10px] text-gray-600 dark:text-gray-400 text-center leading-tight">{label}</p>
              </div>
              {i < STAGES.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 rounded ${i < stageIdx ? 'bg-green-600' : 'bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {canAdvance && (
          <button onClick={advanceStage} disabled={saving}
            className="w-full mt-2 border border-[#1A6080] text-[#4ebac4] hover:bg-[#0E3D52]/30 text-sm py-2 rounded-lg transition">
            {saving ? 'Saving…' : `Advance to ${STAGE_LABELS[STAGES[stageIdx + 1]?.[0]] ?? 'Next Stage'} →`}
          </button>
        )}
        {rec.status === 'completed' && rec.completedAt && (
          <p className="text-xs text-green-400 text-center">
            Completed {new Date(rec.completedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Buddy + Notes row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Buddy */}
        <div className="card-premium p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">Onboarding Buddy</p>
            <button onClick={() => {
              setBuddyDraft(rec.buddyId ?? '')
              if (allEmployees.length === 0) {
                fetchWithAuth('/api/tenant/employees?limit=200').then(r => r.json()).then(d => setAllEmployees(d.employees ?? []))
              }
              setShowBuddyEdit(b => !b)
            }} className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] transition">
              {showBuddyEdit ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {showBuddyEdit ? (
            <div className="space-y-2">
              <select value={buddyDraft} onChange={e => setBuddyDraft(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]">
                <option value="">— No buddy —</option>
                {allEmployees
                  .filter(e => e.id !== rec.employeeId)
                  .map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.jobTitle ? ` — ${e.jobTitle}` : ''}</option>)
                }
              </select>
              <button onClick={saveBuddy} disabled={buddySaving}
                className="w-full bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm py-1.5 rounded-lg transition">
                {buddySaving ? 'Saving…' : 'Save Buddy'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#0E3D52]/50 flex items-center justify-center text-[#4ebac4] text-sm font-bold">
                {buddyName ? buddyName[0].toUpperCase() : '?'}
              </div>
              <span className="text-sm text-gray-200">{buddyName ?? <span className="text-gray-500 italic">Not assigned</span>}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card-premium p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="section-label">Notes</p>
            <button onClick={() => {
              setNotesDraft(rec.notes ?? '')
              setEditingNotes(n => !n)
            }} className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] transition">
              {editingNotes ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} rows={4}
                placeholder="Add notes…"
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52] resize-none" />
              <button onClick={saveNotes} disabled={notesSaving}
                className="w-full bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm py-1.5 rounded-lg transition">
                {notesSaving ? 'Saving…' : 'Save Notes'}
              </button>
            </div>
          ) : rec.notes ? (
            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{rec.notes}</p>
          ) : (
            <p className="text-sm text-gray-500 italic">No notes yet.</p>
          )}
        </div>
      </div>

      {/* Checklist by category */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-label">Onboarding Checklist</h2>
          <button onClick={() => setAddingTask(t => !t)}
            className="text-xs text-[#0E3D52] hover:text-[#1A6080] dark:text-[#4ebac4] transition flex items-center gap-1">
            {addingTask ? '✕ Cancel' : '+ Add Task'}
          </button>
        </div>

        {/* Add task form */}
        {addingTask && (
          <div className="card-premium border-[#0E3D52]/30 p-4 space-y-3">
            <p className="text-xs font-semibold text-[#4ebac4]">New Checklist Task</p>
            <input value={newTaskText} onChange={e => setNewTaskText(e.target.value)}
              placeholder="Task description…"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#0E3D52]" />
            <div className="flex gap-2 items-center">
              <select value={newTaskCat} onChange={e => setNewTaskCat(e.target.value)}
                className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#0E3D52]">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <button onClick={addTask} disabled={taskSaving || !newTaskText.trim()}
                className="flex-1 bg-[#0E3D52] hover:bg-[#1A6080] disabled:opacity-60 text-white text-sm py-2 rounded-lg transition">
                {taskSaving ? 'Adding…' : 'Add Task'}
              </button>
            </div>
          </div>
        )}

        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="card-premium overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CATEGORY_COLOR[category] ?? 'bg-gray-700 text-gray-300'}`}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {items.filter(t => t.done).length}/{items.length}
              </span>
            </div>
            <ul className="divide-y divide-gray-200 dark:divide-gray-800/50">
              {items.map(item => (
                <li key={item.id}
                  className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/30 transition ${saving ? 'pointer-events-none opacity-70' : ''}`}
                  onClick={() => toggleItem(item.id)}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition ${
                    item.done ? 'bg-[#0E3D52] border-[#0E3D52]' : 'border-gray-600'
                  }`}>
                    {item.done && <span className="text-white text-xs"></span>}
                  </div>
                  <span className={`text-sm transition ${item.done ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                    {item.task}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

    </div>
  )
}
