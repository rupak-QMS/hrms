import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Training module', () => {
  test('hr_officer can list training courses', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/training')
    expect(status).toBe(200)
    expect(data).toHaveProperty('courses')
    expect(Array.isArray(data.courses)).toBe(true)
  })

  test('hr_officer can create a course', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'POST', '/api/tenant/training', {
      title: 'E2E_TEST_2026-11-03 Manual Handling',
      category: 'WHS',
      isMandatory: true,
      validityMonths: 12,
    })
    expect(status).toBe(201)
    expect(data.course ?? data.row).toHaveProperty('id')
  })

  test('POST without title returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'POST', '/api/tenant/training', {
      description: 'No title',
    })
    expect(status).toBe(400)
  })

  test('employee can read but not create courses', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status: getStatus } = await apiCall(page, 'GET', '/api/tenant/training')
    expect(getStatus).toBe(200)
    const { status: postStatus } = await apiCall(page, 'POST', '/api/tenant/training', {
      title: 'E2E_TEST employee denied',
    })
    expect([403, 401]).toContain(postStatus)
  })

  test('auditor can read training', async ({ page }) => {
    await loginAs(page, 'auditor')
    const { status } = await apiCall(page, 'GET', '/api/tenant/training')
    expect(status).toBe(200)
  })

  test('training with includeRecords param returns 200', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'GET', '/api/tenant/training?includeRecords=true')
    expect(status).toBe(200)
  })
})
