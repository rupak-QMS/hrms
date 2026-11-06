'use client'

/**
 * Skeleton loading placeholders.
 *
 * Usage:
 *   if (loading) return <SkeletonTable rows={5} cols={4} />
 *   if (loading) return <SkeletonCards count={3} />
 *   if (loading) return <SkeletonPage />
 */

function Pulse({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-[#0E3D52]/60 ${className}`}
    />
  )
}

/** A table body with skeleton rows */
export function SkeletonTable({
  rows = 5,
  cols = 4,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <div className="card-premium overflow-hidden">
      {/* header */}
      <div className="px-6 py-4 border-b border-gray-100 dark:border-[#1A6080]/30 flex gap-4">
        <Pulse className="h-5 w-40" />
        <Pulse className="h-5 w-24 ml-auto" />
      </div>
      {/* rows */}
      <div className="divide-y divide-gray-100 dark:divide-[#1A6080]/30">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, j) => (
              <Pulse
                key={j}
                className={`h-4 ${j === 0 ? 'w-32' : j === cols - 1 ? 'w-16' : 'flex-1'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** A grid of card skeletons */
export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-premium p-6 space-y-3">
          <div className="flex gap-3 items-center">
            <Pulse className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Pulse className="h-4 w-3/4" />
              <Pulse className="h-3 w-1/2" />
            </div>
          </div>
          <Pulse className="h-3 w-full" />
          <Pulse className="h-3 w-5/6" />
          <div className="flex gap-2 pt-2">
            <Pulse className="h-6 w-16 rounded-full" />
            <Pulse className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Full page loading skeleton with title + table */
export function SkeletonPage({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Pulse className="h-7 w-56" />
          <Pulse className="h-4 w-80" />
        </div>
        <Pulse className="h-9 w-28 rounded-lg" />
      </div>
      <SkeletonTable rows={rows} cols={5} />
    </div>
  )
}

/** Inline row skeleton — use inside a table body */
export function SkeletonRows({
  rows = 3,
  cols = 4,
}: {
  rows?: number
  cols?: number
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <Pulse className={`h-4 ${j === 0 ? 'w-28' : j === cols - 1 ? 'w-12' : 'w-full max-w-xs'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
