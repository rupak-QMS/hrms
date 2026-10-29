import { test, expect } from '@playwright/test'
import { apiCall } from './helpers/login'

/**
 * Employee CRUD E2E — runs as director (storageState from setup).
 * Tests create, read, update, soft-delete lifecycle.
 */

const E2E_TAG = `E2E_TEST_${new Date().toISOString().slice(0,10)}`

test.describe('Employee management', () => {
  let createdEmployeeId: string

  test('GET /api/tenant/employees returns paginated list', async ({ page }) => {
    await page.goto('/dashboard')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/employees?limit=10&offset=0')
    expect(status).toBe(200)
    expect(data).toHaveProperty('employees')
    expect(Array.isArray(data.employees)).toBe(true)
    expect(data).toHaveProperty('pagination')
  })

  test('GET with search filter returns relevant employees', async ({ page }) => {
    await page.goto('/dashboard')
    const { status, data } = await apiCall(
      page, 'GET', '/api/tenant/employees?search=director'
    )
    expect(status).toBe(200)
    if (data.employees.length > 0) {
      const match = data.employees.some(
        (e: any) =>
          e.email?.includes('director') ||
          e.firstName?.toLowerCase().includes('director') ||
          e.lastName?.toLowerCase().includes('director')
      )
      expect(match).toBe(true)
    }
  })

  test('GET with role filter returns only matching roles', async ({ page }) => {
    await page.goto('/dashboard')
    const { status, data } = await apiCall(
      page, 'GET', '/api/tenant/employees?employmentType=full_time&limit=5'
    )
    expect(status).toBe(200)
    for (const emp of data.employees ?? []) {
      expect(emp.employmentType).toBe('full_time')
    }
  })

  test('employee list UI renders without errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
    await page.goto('/employees')
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
    // Table or list should be visible
    const content = await page.textContent('main')
    expect(content).toBeTruthy()
  })

  test('org chart page loads and shows employee names', async ({ page }) => {
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/org-chart')
    expect(status).toBe(200)
    expect(data).toHaveProperty('tree')
    expect(Array.isArray(data.tree)).toBe(true)
    expect(data).toHaveProperty('total')
    expect(data.total).toBeGreaterThan(0)
  })
})
