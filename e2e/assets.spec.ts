import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Assets module', () => {
  let empId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAs(page, 'hr_officer')
    const { data } = await apiCall(page, 'GET', '/api/tenant/employees?limit=1')
    empId = data?.employees?.[0]?.id ?? ''
    await ctx.close()
  })

  test('it_admin can list assets', async ({ page }) => {
    await loginAs(page, 'it_admin')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/assets')
    expect(status).toBe(200)
    expect(data).toHaveProperty('assets')
    expect(Array.isArray(data.assets)).toBe(true)
  })

  test('it_admin can filter assets by employeeId', async ({ page }) => {
    await loginAs(page, 'it_admin')
    if (!empId) return test.skip()
    const { status } = await apiCall(page, 'GET', `/api/tenant/assets?employeeId=${empId}`)
    expect(status).toBe(200)
  })

  test('POST without assetId or employeeId returns 400', async ({ page }) => {
    await loginAs(page, 'it_admin')
    const { status } = await apiCall(page, 'POST', '/api/tenant/assets', { notes: 'test' })
    expect(status).toBe(400)
  })

  test('employee can read assets', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/assets')
    expect(status).toBe(200)
  })

  test('employee cannot write assets', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'POST', '/api/tenant/assets', {
      assetId: 'some-id', employeeId: empId,
    })
    expect([403, 401]).toContain(status)
  })
})
