/**
 * POST /api/tenant/employees/import
 *
 * Accepts a CSV file upload. Parses rows and bulk-inserts employees.
 *
 * Required CSV columns (case-insensitive):
 *   employee_number, first_name, last_name, email, employment_type, start_date
 *
 * Optional columns:
 *   preferred_name, date_of_birth, gender, phone, address, entity_name,
 *   award_classification, pay_level, hourly_rate, annual_salary,
 *   ordinary_hours_per_week, probation_end_date, ndis_worker
 *
 * Returns { imported, skipped, errors[] }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

const VALID_EMPLOYMENT_TYPES = ['full_time', 'part_time', 'casual', 'contractor', 'volunteer'] as const
type EmploymentType = typeof VALID_EMPLOYMENT_TYPES[number]

function normaliseHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, '_')
}

function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(normaliseHeader)

  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const cols: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    cols.push(cur.trim())

    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = cols[i] ?? '' })
    return row
  })
}

function toDateStr(val: string): string | null {
  if (!val) return null
  // Accept DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
  const ddmmyyyy = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`
  const iso = val.match(/^\d{4}-\d{2}-\d{2}$/)
  if (iso) return val
  return null
}

function toDecimal(val: string): string | null {
  const n = parseFloat(val.replace(/[^0-9.]/g, ''))
  return isNaN(n) ? null : String(n)
}

export async function POST(req: NextRequest) {
  const guard = await apiGuard('employees:write')
  if (guard.error) return guard.error
  const { session } = guard

  // ?dryRun=true validates rows and returns preview without inserting
  const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'

  try {
    const formData = await req.formData()
    const file     = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided. Send as multipart/form-data with field "file".' }, { status: 400 })
    }

    const mimeOk = file.type === 'text/csv' || file.name.endsWith('.csv')
    if (!mimeOk) {
      return NextResponse.json({ error: 'Only CSV files are accepted.' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 5 MB.' }, { status: 400 })
    }

    const raw  = await file.text()
    const rows = parseCSV(raw)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV has no data rows.' }, { status: 400 })
    }

    // Pre-fetch existing employee numbers for this tenant (to skip duplicates)
    const existing = await db
      .select({ employeeNumber: employees.employeeNumber })
      .from(employees)
      .where(eq(employees.tenantId, session.tenantId))

    const existingNumbers = new Set(existing.map(e => e.employeeNumber.toLowerCase()))

    type PreviewRow = { row: number; employeeNumber: string; firstName: string; lastName: string; email: string; status: 'valid' | 'skipped'; reason?: string }
    const results = { imported: 0, skipped: 0, errors: [] as string[], preview: [] as PreviewRow[] }

    for (let i = 0; i < rows.length; i++) {
      const row    = rows[i]
      const rowNum = i + 2 // 1-based, +1 for header

      // Required fields
      const employeeNumber  = row['employee_number']?.trim()
      const firstName       = row['first_name']?.trim()
      const lastName        = row['last_name']?.trim()
      const email           = row['email']?.trim().toLowerCase()
      const employmentType  = row['employment_type']?.trim().toLowerCase() as EmploymentType
      const startDateRaw    = row['start_date']?.trim()

      // Validate required
      const missing: string[] = []
      if (!employeeNumber) missing.push('employee_number')
      if (!firstName)      missing.push('first_name')
      if (!lastName)       missing.push('last_name')
      if (!email)          missing.push('email')
      if (!employmentType) missing.push('employment_type')
      if (!startDateRaw)   missing.push('start_date')

      if (missing.length > 0) {
        results.errors.push(`Row ${rowNum}: missing required fields: ${missing.join(', ')}`)
        results.skipped++
        continue
      }

      // Validate employment type
      if (!VALID_EMPLOYMENT_TYPES.includes(employmentType)) {
        results.errors.push(`Row ${rowNum}: invalid employment_type "${employmentType}". Must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`)
        results.skipped++
        continue
      }

      // Validate start date
      const startDate = toDateStr(startDateRaw)
      if (!startDate) {
        results.errors.push(`Row ${rowNum}: invalid start_date "${startDateRaw}". Use YYYY-MM-DD or DD/MM/YYYY.`)
        results.skipped++
        continue
      }

      // Skip duplicate employee numbers within this tenant
      if (existingNumbers.has(employeeNumber.toLowerCase())) {
        const reason = `employee_number "${employeeNumber}" already exists`
        results.errors.push(`Row ${rowNum}: ${reason} — skipped`)
        results.preview.push({ row: rowNum, employeeNumber, firstName, lastName, email, status: 'skipped', reason })
        results.skipped++
        continue
      }

      // Optional fields
      const preferredName         = row['preferred_name']?.trim()   || null
      const dateOfBirth           = toDateStr(row['date_of_birth']  || '')
      const gender                = row['gender']?.trim()            || null
      const phone                 = row['phone']?.trim()             || null
      const address               = row['address']?.trim()           || null
      const entityName            = row['entity_name']?.trim()       || null
      const awardClassification   = row['award_classification']?.trim() || null
      const payLevel              = row['pay_level']?.trim()         || null
      const hourlyRate            = toDecimal(row['hourly_rate']     || '')
      const annualSalary          = toDecimal(row['annual_salary']   || '')
      const ordinaryHours         = toDecimal(row['ordinary_hours_per_week'] || '') ?? '38'
      const probationEndDate      = toDateStr(row['probation_end_date'] || '')
      const ndisWorker            = ['true', '1', 'yes'].includes((row['ndis_worker'] || '').toLowerCase())

      // Record as valid in preview
      results.preview.push({ row: rowNum, employeeNumber, firstName, lastName, email, status: 'valid' })

      if (dryRun) {
        existingNumbers.add(employeeNumber.toLowerCase())
        results.imported++
        continue
      }

      try {
        await db.insert(employees).values({
          tenantId:             session.tenantId,
          employeeNumber,
          firstName,
          lastName,
          preferredName:        preferredName ?? undefined,
          dateOfBirth:          dateOfBirth   ?? undefined,
          gender:               gender        ?? undefined,
          phone:                phone         ?? undefined,
          email,
          address:              address       ?? undefined,
          entityName:           entityName    ?? undefined,
          employmentType,
          awardClassification:  awardClassification ?? undefined,
          payLevel:             payLevel      ?? undefined,
          hourlyRate:           hourlyRate    ?? undefined,
          annualSalary:         annualSalary  ?? undefined,
          ordinaryHoursPerWeek: ordinaryHours ?? undefined,
          startDate,
          probationEndDate:     probationEndDate ?? undefined,
          ndisWorker,
          isActive:             true,
          complianceStatus:     'pending',
        })
        existingNumbers.add(employeeNumber.toLowerCase()) // prevent duplicate within same upload
        results.imported++
      } catch (err: any) {
        const msg = err.message ?? 'DB insert failed'
        results.errors.push(`Row ${rowNum} (${employeeNumber}): ${msg}`)
        results.skipped++
      }
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      ...results,
      total: rows.length,
    })
  } catch (err: any) {
    console.error('employees/import error:', err)
    return NextResponse.json({ error: err.message ?? 'Import failed' }, { status: 500 })
  }
}
