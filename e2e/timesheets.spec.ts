import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Timesheets module', () => {
  test('hr_officer (manager) can list all timesheets', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/timesheets')
    expect(status).toBe(200)
    expect(data).toHaveProperty('timesheets')
    expect(Array.isArray(data.timesheets)).toBe(true)
  })

  test('employee can read own timesheets', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/timesheets')
    expect(status).toBe(200)
  })

  test('payroll_officer can list timesheets', async ({ page }) => {
    await loginAs(page, 'payroll_officer')
    const { status } = await apiCall(page, 'GET', '/api/tenant/timesheets')
    expect(status).toBe(200)
  })

  test('auditor cannot access timesheets', async ({ page }) => {
    await loginAs(page, 'auditor')
    const { status } = await apiCall(page, 'GET', '/api/tenant/timesheets')
    expect([403, 401]).toContain(status)
  })

  test('it_admin cannot access timesheets', async ({ page }) => {
    await loginAs(page, 'it_admin')
    const { status } = await apiCall(page, 'GET', '/api/tenant/timesheets')
    expect([403, 401]).toContain(status)
  })

  test('timesheets filtered by status=pending returns only pending', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/timesheets?status=pending')
    expect(status).toBe(200)
    data.timesheets.forEach((t: any) => expect(t.status).toBe('pending'))
  })
})
