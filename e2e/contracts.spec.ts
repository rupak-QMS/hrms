import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Contracts module', () => {
  let empId: string
  let contractId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, 'hr_officer')
    const { data } = await apiCall(page, 'GET', '/api/tenant/employees?limit=1')
    empId = data?.employees?.[0]?.id ?? ''
    await ctx.close()
  })

  test('hr_officer can list contracts', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/contracts')
    expect(status).toBe(200)
    expect(data).toHaveProperty('contracts')
  })

  test('hr_officer can create a contract', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!empId) return test.skip()
    const { status, data } = await apiCall(page, 'POST', '/api/tenant/contracts', {
      employeeId: empId,
      type: 'permanent',
      startDate: new Date().toISOString().split('T')[0],
      notes: 'E2E_TEST_2026-11-03',
    })
    expect(status).toBe(201)
    contractId = (data.contract ?? data.record)?.id
  })

  test('POST without employeeId or type returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'POST', '/api/tenant/contracts', { notes: 'missing' })
    expect(status).toBe(400)
  })

  test('hr_officer can update a contract', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!contractId) return test.skip()
    const { status } = await apiCall(page, 'PATCH', '/api/tenant/contracts', {
      id: contractId, notes: 'E2E_TEST updated',
    })
    expect([200, 204]).toContain(status)
  })

  test('employee cannot access contracts', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/contracts')
    expect([403, 401]).toContain(status)
  })

  test('operations_manager can read contracts but not write', async ({ page }) => {
    await loginAs(page, 'operations_manager')
    const { status: getStatus } = await apiCall(page, 'GET', '/api/tenant/contracts')
    expect(getStatus).toBe(200)
    if (!empId) return
    const { status: postStatus } = await apiCall(page, 'POST', '/api/tenant/contracts', {
      employeeId: empId, type: 'casual',
    })
    expect([403, 401]).toContain(postStatus)
  })
})
