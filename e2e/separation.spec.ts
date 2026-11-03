import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Separation module', () => {
  let empId: string
  let separationId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, 'hr_officer')
    const { data } = await apiCall(page, 'GET', '/api/tenant/employees?limit=1')
    empId = data?.employees?.[0]?.id ?? ''
    await ctx.close()
  })

  test('hr_officer can list separations', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/separation')
    expect(status).toBe(200)
    expect(data).toHaveProperty('records')
    expect(Array.isArray(data.records)).toBe(true)
  })

  test('hr_officer can initiate a separation', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!empId) return test.skip()
    const { status, data } = await apiCall(page, 'POST', '/api/tenant/separation', {
      employeeId: empId,
      type: 'resignation',
      effectiveDate: new Date(Date.now() + 30 * 86400_000).toISOString().split('T')[0],
      notes: 'E2E_TEST_2026-11-03',
    })
    expect(status).toBe(201)
    separationId = (data.record ?? data.separation)?.id
  })

  test('POST without employeeId or type returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'POST', '/api/tenant/separation', { notes: 'missing' })
    expect(status).toBe(400)
  })

  test('hr_officer can update a separation record', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!separationId) return test.skip()
    const { status } = await apiCall(page, 'PATCH', '/api/tenant/separation', {
      id: separationId, notes: 'E2E_TEST updated',
    })
    expect([200, 204]).toContain(status)
  })

  test('employee cannot access separations', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/separation')
    expect([403, 401]).toContain(status)
  })

  test('operations_manager cannot access separations', async ({ page }) => {
    await loginAs(page, 'operations_manager')
    const { status } = await apiCall(page, 'GET', '/api/tenant/separation')
    expect([403, 401]).toContain(status)
  })
})
