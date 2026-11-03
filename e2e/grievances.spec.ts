import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Grievances module', () => {
  let grievanceId: string

  test('hr_officer can list grievances', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/grievances')
    expect(status).toBe(200)
    expect(data).toHaveProperty('grievances')
    expect(Array.isArray(data.grievances)).toBe(true)
  })

  test('hr_officer can create a grievance', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'POST', '/api/tenant/grievances', {
      type: 'workplace_conflict',
      description: 'E2E_TEST_2026-11-03 grievance test',
      priority: 'medium',
    })
    expect(status).toBe(201)
    expect(data.grievance ?? data.record).toHaveProperty('id')
    grievanceId = (data.grievance ?? data.record)?.id
  })

  test('POST without type or description returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'POST', '/api/tenant/grievances', { priority: 'high' })
    expect(status).toBe(400)
  })

  test('hr_officer can update grievance status', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!grievanceId) return test.skip()
    const { status } = await apiCall(page, 'PATCH', '/api/tenant/grievances', {
      id: grievanceId, status: 'under_review',
    })
    expect([200, 204]).toContain(status)
  })

  test('employee cannot read grievances', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/grievances')
    expect([403, 401]).toContain(status)
  })

  test('compliance_manager can read grievances', async ({ page }) => {
    await loginAs(page, 'compliance_manager')
    const { status } = await apiCall(page, 'GET', '/api/tenant/grievances')
    expect(status).toBe(200)
  })
})
