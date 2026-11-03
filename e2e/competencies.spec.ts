import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Competencies module', () => {
  test('hr_officer can list competencies', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/competencies')
    expect(status).toBe(200)
    expect(data).toHaveProperty('competencies')
    expect(Array.isArray(data.competencies)).toBe(true)
  })

  test('competencies with includeAssessments returns 200', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'GET', '/api/tenant/competencies?includeAssessments=true')
    expect(status).toBe(200)
  })

  test('employee can read competencies', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/competencies')
    expect(status).toBe(200)
  })

  test('auditor cannot access competencies', async ({ page }) => {
    await loginAs(page, 'auditor')
    const { status } = await apiCall(page, 'GET', '/api/tenant/competencies')
    expect([403, 401]).toContain(status)
  })

  test('employee cannot write competencies', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'POST', '/api/tenant/competencies', {
      name: 'E2E_TEST should be denied',
    })
    expect([403, 401]).toContain(status)
  })
})
