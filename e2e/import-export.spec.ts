/**
 * e2e/import-export.spec.ts
 *
 * Employee bulk import (CSV) and export coverage.
 *
 * Endpoints under test:
 *   POST /api/tenant/employees/import          employees:write
 *   POST /api/tenant/employees/import?dryRun=true
 *   GET  /api/tenant/employees/export          employees:read
 *   GET  /api/tenant/leave/export              leave:read
 */

import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

async function loginAs(page: any, role: string) {
  const CREDS: Record<string, { email: string; password: string }> = {
    director:           { email: 'director@yahwehcare.com.au',   password: 'Test@12345' },
    hr_officer:         { email: 'hr@yahwehcare.com.au',         password: 'Test@12345' },
    payroll_officer:    { email: 'payroll@yahwehcare.com.au',    password: 'Test@12345' },
    auditor:            { email: 'auditor@yahwehcare.com.au',    password: 'Test@12345' },
    employee:           { email: 'employee@yahwehcare.com.au',   password: 'Test@12345' },
    contractor:         { email: 'contractor@yahwehcare.com.au', password: 'Test@12345' },
  }
  const cred = CREDS[role]
  if (!cred) throw new Error(`Unknown role: ${role}`)
  const res = await page.request.post('/api/auth/login', { data: { ...cred, tenantSlug: 'yahwehcare' } })
  return res.status()
}

function csvFile(rows: string[]): { name: string; mimeType: string; buffer: Buffer } {
  const header = 'employee_number,first_name,last_name,email,employment_type,start_date'
  const content = [header, ...rows].join('\n')
  return { name: 'employees.csv', mimeType: 'text/csv', buffer: Buffer.from(content) }
}

// ── dry-run / preview ─────────────────────────────────────────────────────────

test('dryRun returns preview without inserting', async ({ page }) => {
  await loginAs(page, 'hr_officer')

  const uniqueNum = `E2E-DR-${Date.now()}`
  const file = csvFile([`${uniqueNum},Dry,Run,dryrun-${Date.now()}@example.com,full_time,2025-01-01`])

  const res = await page.request.post('/api/tenant/employees/import?dryRun=true', {
    multipart: { file },
  })
  expect(res.status()).toBe(200)

  const body = await res.json()
  expect(body.ok).toBe(true)
  expect(body.dryRun).toBe(true)
  expect(typeof body.imported).toBe('number')
  expect(typeof body.skipped).toBe('number')
  expect(Array.isArray(body.errors)).toBe(true)
  expect(typeof body.total).toBe('number')

  // Confirm no real record was created
  const check = await page.request.get(`/api/tenant/employees?search=${uniqueNum}`)
  expect(check.status()).toBe(200)
  const data = await check.json()
  expect((data.employees ?? []).length).toBe(0)
})

// ── live import ───────────────────────────────────────────────────────────────

test('POST import inserts valid CSV rows', async ({ page }) => {
  await loginAs(page, 'hr_officer')

  const uniqueNum = `E2E-IMP-${Date.now()}`
  const file = csvFile([`${uniqueNum},Import,Test,import-${Date.now()}@example.com,full_time,2025-06-01`])

  const res = await page.request.post('/api/tenant/employees/import', {
    multipart: { file },
  })
  expect(res.status()).toBe(200)

  const body = await res.json()
  expect(body.ok).toBe(true)
  expect(body.imported).toBeGreaterThanOrEqual(1)
  expect(body.errors.length).toBe(0)
})

test('import rejects invalid employment_type', async ({ page }) => {
  await loginAs(page, 'hr_officer')

  const file = csvFile([`E2E-BAD-${Date.now()},Bad,Type,bad-${Date.now()}@example.com,intern,2025-01-01`])
  const res = await page.request.post('/api/tenant/employees/import', {
    multipart: { file },
  })
  if (res.status() === 200) {
    const body = await res.json()
    expect(body.errors.length).toBeGreaterThan(0)
  } else {
    expect(res.status()).toBe(400)
  }
})

test('import skips duplicate employee_number within same upload', async ({ page }) => {
  await loginAs(page, 'hr_officer')

  const num = `E2E-DUP-${Date.now()}`
  const file = csvFile([
    `${num},Dup,One,dup1-${Date.now()}@example.com,full_time,2025-01-01`,
    `${num},Dup,Two,dup2-${Date.now()}@example.com,part_time,2025-02-01`,
  ])
  const res = await page.request.post('/api/tenant/employees/import', {
    multipart: { file },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.imported + body.skipped).toBe(2)
  expect(body.skipped + body.errors.length).toBeGreaterThanOrEqual(1)
})

// ── permission: import ────────────────────────────────────────────────────────

test('employee role cannot import', async ({ page }) => {
  await loginAs(page, 'employee')
  const file = csvFile([`E2E-DENY-${Date.now()},Denied,User,deny-${Date.now()}@example.com,full_time,2025-01-01`])
  const res = await page.request.post('/api/tenant/employees/import', { multipart: { file } })
  expect([401, 403]).toContain(res.status())
})

test('auditor role cannot import', async ({ page }) => {
  await loginAs(page, 'auditor')
  const file = csvFile([`E2E-AUD-${Date.now()},Audit,Block,aud-${Date.now()}@example.com,full_time,2025-01-01`])
  const res = await page.request.post('/api/tenant/employees/import', { multipart: { file } })
  expect([401, 403]).toContain(res.status())
})

// ── employee export ───────────────────────────────────────────────────────────

test('GET employees/export returns CSV content', async ({ page }) => {
  await loginAs(page, 'hr_officer')
  const res = await page.request.get('/api/tenant/employees/export')
  expect(res.status()).toBe(200)
  const ct = res.headers()['content-type'] ?? ''
  expect(ct).toMatch(/csv|octet-stream|text\/plain/)
  const text = await res.text()
  expect(text.length).toBeGreaterThan(0)
  const firstLine = text.split('\n')[0].toLowerCase()
  expect(firstLine).toMatch(/email|employee|first_name/)
})

test('employee role cannot export employees list', async ({ page }) => {
  await loginAs(page, 'employee')
  const res = await page.request.get('/api/tenant/employees/export')
  expect([401, 403]).toContain(res.status())
})

// ── leave export ──────────────────────────────────────────────────────────────

test('GET leave/export returns CSV content', async ({ page }) => {
  await loginAs(page, 'hr_officer')
  const res = await page.request.get('/api/tenant/leave/export')
  expect(res.status()).toBe(200)
  const ct = res.headers()['content-type'] ?? ''
  expect(ct).toMatch(/csv|octet-stream|text\/plain/)
})

test('contractor cannot export leave data', async ({ page }) => {
  await loginAs(page, 'contractor')
  const res = await page.request.get('/api/tenant/leave/export')
  expect([401, 403]).toContain(res.status())
})
