/**
 * CSV export utility.
 *
 * Usage:
 *   import { exportCsv } from '@/lib/exportCsv'
 *
 *   exportCsv({
 *     filename: 'employees-2024.csv',
 *     columns: [
 *       { header: 'First Name', key: 'firstName' },
 *       { header: 'Last Name',  key: 'lastName' },
 *       { header: 'Email',      key: 'email' },
 *       { header: 'Status',     key: 'isActive', format: v => v ? 'Active' : 'Inactive' },
 *     ],
 *     rows: employees,
 *   })
 */

type CsvColumn<T> = {
  header: string
  key: keyof T
  format?: (value: any, row: any) => string
}

type ExportCsvOptions<T> = {
  filename: string
  columns: CsvColumn<T>[]
  rows: T[]
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportCsv<T extends object>({
  filename,
  columns,
  rows,
}: ExportCsvOptions<T>): void {
  const header = columns.map(c => escapeCsv(c.header)).join(',')

  const body = rows.map(row =>
    columns.map(col => {
      const raw = row[col.key]
      const formatted = col.format ? col.format(raw, row) : raw
      return escapeCsv(formatted)
    }).join(',')
  )

  const csv = [header, ...body].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href     = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Format a date string (YYYY-MM-DD or ISO) as DD/MM/YYYY */
export function fmtCsvDate(d: string | null | undefined): string {
  if (!d) return ''
  const date = new Date(d.includes('T') ? d : d + 'T00:00:00')
  return date.toLocaleDateString('en-AU')
}

/** Format a currency number as plain dollars (no symbol) */
export function fmtCsvCurrency(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === '') return ''
  return Number(n).toFixed(2)
}
