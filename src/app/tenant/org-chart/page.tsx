'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { fetchWithAuth } from '@/lib/fetchWithAuth'
import EmptyState from '@/components/ui/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgNode = {
  id: string
  firstName: string
  lastName: string
  preferredName: string | null
  email: string
  managerId: string | null
  departmentId: string | null
  departmentName: string | null
  positionId: string | null
  positionTitle: string | null
  isActive: boolean
  complianceStatus: string
  employmentType: string
  children: OrgNode[]
}

type OrgData = {
  tree: OrgNode[]
  allDepartments: { id: string; name: string }[]
  total: number
}

// ─── Avatar colors ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-[#E0EEF4]0', 'bg-[#0E3D52]', 'bg-sky-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-teal-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500',
]

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ─── Compliance badge ─────────────────────────────────────────────────────────

function complianceBadge(status: string) {
  if (status === 'green')   return <span className="badge badge-green">Compliant</span>
  if (status === 'amber')   return <span className="badge badge-amber">Review</span>
  if (status === 'red')     return <span className="badge badge-red">Non-compliant</span>
  return <span className="badge">Pending</span>
}

// ─── Helper: flatten tree ────────────────────────────────────────────────────

function flattenTree(nodes: OrgNode[]): OrgNode[] {
  const result: OrgNode[] = []
  function walk(n: OrgNode) {
    result.push(n)
    n.children.forEach(walk)
  }
  nodes.forEach(walk)
  return result
}

// ─── Filter tree: keep only nodes matching dept + search ─────────────────────

function filterTree(nodes: OrgNode[], deptId: string, search: string): OrgNode[] {
  const q = search.toLowerCase()
  function matches(n: OrgNode): boolean {
    const nameMatch = !q ||
      n.firstName.toLowerCase().includes(q) ||
      n.lastName.toLowerCase().includes(q) ||
      (n.preferredName ?? '').toLowerCase().includes(q)
    const deptMatch = !deptId || n.departmentId === deptId
    return nameMatch && deptMatch
  }
  function filterNode(n: OrgNode): OrgNode | null {
    const filteredChildren = n.children.flatMap(c => {
      const r = filterNode(c)
      return r ? [r] : []
    })
    if (matches(n) || filteredChildren.length > 0) {
      return { ...n, children: filteredChildren }
    }
    return null
  }
  return nodes.flatMap(n => {
    const r = filterNode(n)
    return r ? [r] : []
  })
}

// ─── Connector SVG lines ──────────────────────────────────────────────────────

function ConnectorLine() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
    </div>
  )
}

function HorizontalBranch({ count }: { count: number }) {
  if (count <= 1) return <ConnectorLine />
  return (
    <div className="flex flex-col items-center">
      <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
      <div className="flex items-start">
        {/* Left arm */}
        <div className="w-1/2 border-t border-l border-gray-300 dark:border-gray-600 h-4" />
        {/* Right arm */}
        <div className="w-1/2 border-t border-gray-300 dark:border-gray-600 h-4" />
      </div>
    </div>
  )
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function EmployeeCard({
  node,
  expanded,
  onToggle,
}: {
  node: OrgNode
  expanded: boolean
  onToggle: () => void
}) {
  const displayName = node.preferredName
    ? `${node.preferredName} ${node.lastName}`
    : `${node.firstName} ${node.lastName}`
  const initials = (node.preferredName ?? node.firstName)[0].toUpperCase() +
    node.lastName[0].toUpperCase()
  const color = avatarColor(displayName)
  const hasChildren = node.children.length > 0

  return (
    <div className="flex flex-col items-center">
      <div
        className="card-premium group relative w-52 cursor-default select-none transition-shadow"
        style={{ minWidth: '13rem' }}
      >
        {/* Avatar */}
        <div className="flex flex-col items-center pt-4 pb-2 px-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm ${color} shadow-md mb-2 ring-2 ring-white dark:ring-gray-800`}>
            {initials}
          </div>

          {/* Name */}
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 text-center leading-snug line-clamp-2">
            {displayName}
          </p>

          {/* Position */}
          {node.positionTitle && (
            <p className="text-xs text-[#0E3D52] dark:text-[#4ebac4] dark:text-[#4ebac4] text-center mt-0.5 leading-tight line-clamp-1">
              {node.positionTitle}
            </p>
          )}

          {/* Department */}
          {node.departmentName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-0.5 leading-tight line-clamp-1">
              {node.departmentName}
            </p>
          )}

          {/* Compliance */}
          <div className="mt-2">
            {complianceBadge(node.complianceStatus)}
          </div>
        </div>

        {/* Expand/collapse toggle */}
        {hasChildren && (
          <div className="border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={onToggle}
              className="w-full py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-[#0E3D52] dark:text-[#4ebac4] dark:hover:text-[#4ebac4] flex items-center justify-center gap-1 transition-colors"
            >
              {expanded ? (
                <>
                  <span>▲</span>
                  <span>Collapse ({node.children.length})</span>
                </>
              ) : (
                <>
                  <span>▼</span>
                  <span>Show {node.children.length} report{node.children.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Org Node (recursive) ────────────────────────────────────────────────────

function OrgTreeNode({
  node,
  expanded,
  onToggle,
  childExpanded,
  onChildToggle,
}: {
  node: OrgNode
  expanded: boolean
  onToggle: (id: string) => void
  childExpanded: (id: string) => boolean
  onChildToggle: (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded

  return (
    <div className="flex flex-col items-center">
      <EmployeeCard
        node={node}
        expanded={isExpanded}
        onToggle={() => onToggle(node.id)}
      />

      {hasChildren && isExpanded && (
        <>
          {/* Vertical line down */}
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />

          {/* Children row */}
          <div className="flex gap-6 items-start relative">
            {/* Top horizontal line spanning children */}
            {node.children.length > 1 && (
              <div
                className="absolute top-0 left-0 right-0 border-t border-gray-300 dark:border-gray-600"
                style={{ marginLeft: '50%', marginRight: '50%', left: '26px', right: '26px' }}
              />
            )}

            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical stub from h-line to child */}
                <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
                <OrgTreeNode
                  node={child}
                  expanded={childExpanded(child.id)}
                  onToggle={onChildToggle}
                  childExpanded={childExpanded}
                  onChildToggle={onChildToggle}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const [data, setData]         = useState<OrgData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [search, setSearch]     = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    fetchWithAuth('/api/tenant/org-chart')
      .then(r => r.json())
      .then((d: OrgData & { error?: string }) => {
        if (d.error) { setError(d.error); return }
        setData(d)
      })
      .catch(() => setError('Failed to load org chart'))
      .finally(() => setLoading(false))
  }, [])

  const isExpanded = useCallback((id: string) => !collapsed.has(id), [collapsed])

  const toggleNode = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback(() => setCollapsed(new Set()), [])
  const collapseAll = useCallback(() => {
    if (!data) return
    const all = flattenTree(data.tree).map(n => n.id)
    setCollapsed(new Set(all))
  }, [data])

  const displayTree = useMemo(() => {
    if (!data) return []
    return filterTree(data.tree, deptFilter, search)
  }, [data, deptFilter, search])

  const totalVisible = useMemo(() => flattenTree(displayTree).length, [displayTree])

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Organisation Chart</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Visual hierarchy of your organisation
          {data && <span className="ml-1">— {data.total} active employees</span>}
        </p>
      </div>

      {/* Filters + Actions */}
      <div className="card-premium p-4 mb-6 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Department filter */}
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="py-2 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
        >
          <option value="">All Departments</option>
          {data?.allDepartments.sort((a, b) => a.name.localeCompare(b.name)).map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {/* Expand/Collapse */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={expandAll}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Collapse All
          </button>
        </div>

        {/* Count */}
        {(search || deptFilter) && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {totalVisible} of {data?.total ?? 0}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-[#0E3D52] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card-premium p-6 text-center text-red-500 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && displayTree.length === 0 && (
        <EmptyState
          icon="🏢"
          title="No employees found"
          message={
            search || deptFilter
              ? 'No employees match your current filters.'
              : 'Add employees to build your organisation chart.'
          }
        />
      )}

      {/* Chart */}
      {!loading && !error && displayTree.length > 0 && (
        <div className="overflow-x-auto pb-8">
          <div className="inline-flex gap-10 items-start min-w-max px-4 pt-2">
            {displayTree.map(root => (
              <OrgTreeNode
                key={root.id}
                node={root}
                expanded={isExpanded(root.id)}
                onToggle={toggleNode}
                childExpanded={isExpanded}
                onChildToggle={toggleNode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {!loading && !error && data && data.total > 0 && (
        <div className="mt-6 flex flex-wrap gap-4 items-center text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">Compliance:</span>
          <span className="flex items-center gap-1.5"><span className="badge badge-green">Compliant</span></span>
          <span className="flex items-center gap-1.5"><span className="badge badge-amber">Review</span></span>
          <span className="flex items-center gap-1.5"><span className="badge badge-red">Non-compliant</span></span>
          <span className="flex items-center gap-1.5"><span className="badge">Pending</span></span>
        </div>
      )}
    </div>
  )
}
