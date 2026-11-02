/**
 * Date formatting utilities — always respect the tenant's timezone.
 *
 * Usage:
 *   import { formatDate, formatDateTime, formatDateShort } from '@/lib/formatDate'
 *
 *   // With explicit timezone (preferred — pass from tenant settings)
 *   formatDate(employee.createdAt, 'Australia/Sydney')
 *
 *   // Without timezone — defaults to Australia/Sydney (safe for AU-only deployment)
 *   formatDate(grievance.closedAt)
 *
 * Migration: replace `new Date(x).toLocaleDateString('en-AU')` with `formatDate(x)`
 */

export const DEFAULT_TZ = 'Australia/Sydney'
export const DEFAULT_LOCALE = 'en-AU'

/**
 * Format a date value as DD/MM/YYYY in the given timezone.
 * Accepts Date objects, ISO strings, or timestamps.
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  timeZone: string = DEFAULT_TZ,
): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
    timeZone,
  }).format(d)
}

/**
 * Format a datetime value as DD/MM/YYYY, H:MM am/pm in the given timezone.
 */
export function formatDateTime(
  value: Date | string | number | null | undefined,
  timeZone: string = DEFAULT_TZ,
): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(d)
}

/**
 * Format a date as "12 Jan 2026" — month abbreviated, no leading zeros.
 */
export function formatDateLong(
  value: Date | string | number | null | undefined,
  timeZone: string = DEFAULT_TZ,
): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, {
    day:   'numeric',
    month: 'short',
    year:  'numeric',
    timeZone,
  }).format(d)
}

/**
 * Format relative time: "2 hours ago", "in 3 days", etc.
 * Falls back to formatDate for values older than 30 days.
 */
export function formatRelative(
  value: Date | string | number | null | undefined,
  timeZone: string = DEFAULT_TZ,
): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return '—'
  const diffMs = d.getTime() - Date.now()
  const diffSec = Math.round(diffMs / 1000)
  const abs = Math.abs(diffSec)

  if (abs < 60)   return diffSec >= 0 ? 'just now' : 'just now'
  if (abs < 3600) return `${Math.round(abs / 60)} min${abs < 120 ? '' : 's'} ${diffSec < 0 ? 'ago' : ''}`
  if (abs < 86400)return `${Math.round(abs / 3600)} hr${abs < 7200 ? '' : 's'} ${diffSec < 0 ? 'ago' : ''}`
  if (abs < 86400 * 30) return `${Math.round(abs / 86400)} day${abs < 172800 ? '' : 's'} ${diffSec < 0 ? 'ago' : ''}`
  return formatDate(d, timeZone)
}
