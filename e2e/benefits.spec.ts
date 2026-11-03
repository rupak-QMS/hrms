import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Benefits module', () => {
  let empId: string
  let benefitId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, 'hr_officer')
    const { data } = await apiCall(page, 'GET', '/api/tenant/employees?limit=1')
    empId = data?.employees?.[0]?.id ?? ''
    await ctx.close()
  })

  test('hr_officer can list benefits', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/benefits')
    expect(status).toBe(200)
    expect(data).toHaveProperty('benefits')
    expect(Array.isArray(data.benefits)).toBe(true)
  })

  test('hr_officer can assign a benefit', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!empId) return test.skip()
    const { status, data } = await apiCall(page, 'POST', '/api/tenant/benefits', {
      employeeId: empId,
      type: 'health_insurance',
      startDate: new Date().toISOString().split('T')[0],
      notes: 'E2E_TEST_2026-11-03',
    })
    expect(status).toBe(201)
    benefitId = (data.benefit ?? data.record)?.id
  })

  test('POST without employeeId or type returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'POST', '/api/tenant/benefits', { notes: 'missing' })
    expect(status).toBe(400)
  })

  test('PATCH without id returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'PATCH', '/api/tenant/benefits', { notes: 'no id' })
    expect(status).toBe(400)
  })

  test('hr_officer can update a benefit', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    if (!benefitId) return test.skip()
    const { status } = await apiCall(page, 'PATCH', '/api/tenant/benefits', {
      id: benefitId, notes: 'E2E_TEST updated',
    })
    expect([200, 204]).toContain(status)
  })

  test('employee can read own benefits', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/benefits')
    expect(status).toBe(200)
  })

  test('employee cannot write benefits', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'POST', '/api/tenant/benefits', {
      employeeId: empId, type: 'dental',
    })
    expect([403, 401]).toContain(status)
  })
})
