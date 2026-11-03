import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

/**
 * WHS (Work Health & Safety) E2E
 * POST requires: reportedBy (employee UUID), type, description, occurredAt
 */

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('WHS incidents', () => {
  let empId: string
  let incidentId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, 'hr_officer')
    const { data } = await apiCall(page, 'GET', '/api/tenant/employees?limit=1')
    empId = data?.employees?.[0]?.id ?? ''
    await ctx.close()
  })

  test('hr_officer can list WHS incidents', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/whs')
    expect(status).toBe(200)
    expect(data).toHaveProperty('records')
    expect(data).toHaveProperty('stats')
    expect(Array.isArray(data.records)).toBe(true)
  })

  test('hr_officer can filter by status', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/whs?status=open')
    expect(status).toBe(200)
    data.records.forEach((r: any) => expect(r.status).toBe('open'))
  })

  test('hr_officer can lodge a WHS incident', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!empId) return test.skip()
    const { status, data } = await apiCall(page, 'POST', '/api/tenant/whs', {
      reportedBy:  empId,
      type:        'near_miss',
      severity:    'medium',
      description: 'E2E_TEST_2026-11-03 near miss during manual handling',
      location:    'Warehouse A',
      occurredAt:  new Date().toISOString(),
    })
    expect(status).toBe(201)
    expect(data.record).toHaveProperty('id')
    expect(data.record.status).toBe('open')
    incidentId = data.record.id
  })

  test('POST without required fields returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'POST', '/api/tenant/whs', {
      type: 'near_miss',
    })
    expect(status).toBe(400)
  })

  test('hr_officer can update incident to investigating', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!incidentId) return test.skip()
    const { status, data } = await apiCall(page, 'PATCH', '/api/tenant/whs', {
      id: incidentId, status: 'investigating',
    })
    expect(status).toBe(200)
    expect(data.record.status).toBe('investigating')
  })

  test('hr_officer can close an incident', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!incidentId) return test.skip()
    const { status, data } = await apiCall(page, 'PATCH', '/api/tenant/whs', {
      id: incidentId, status: 'closed',
    })
    expect(status).toBe(200)
    expect(data.record.status).toBe('closed')
    expect(data.record.closedAt).toBeTruthy()
  })

  test('employee can self-report an incident', async ({ page }) => {
    await loginAs(page, 'employee')
    if (!empId) return test.skip()
    const { status } = await apiCall(page, 'POST', '/api/tenant/whs', {
      reportedBy:  empId,
      type:        'hazard',
      description: 'E2E_TEST_2026-11-03 slippery floor',
      occurredAt:  new Date().toISOString(),
    })
    expect(status).toBe(201)
  })
})
