import { test, expect } from '@playwright/test'
import { loginAs, apiCall } from './helpers/login'

/**
 * RBAC E2E — each role sees only its permitted resources.
 * Tests both UI visibility and API enforcement.
 *
 * Rate-limit note: max 9 logins per 60s. This file logs in 4 roles.
 */

test.use({ storageState: { cookies: [], origins: [] } })

// ── UI visibility ─────────────────────────────────────────────────────────

test.describe('Role-based navigation', () => {
  test('employee cannot see Payroll menu item', async ({ page }) => {
    await loginAs(page, 'employee')
    const nav = await page.textContent('nav')
    expect(nav).not.toMatch(/payroll/i)
  })

  test('contractor cannot see Payroll menu item', async ({ page }) => {
    await loginAs(page, 'contractor')
    const nav = await page.textContent('nav')
    expect(nav).not.toMatch(/payroll/i)
  })

  test('payroll_officer sees Payroll menu item', async ({ page }) => {
    await loginAs(page, 'payroll_officer')
    const nav = await page.textContent('nav')
    expect(nav).toMatch(/payroll/i)
  })

  test('director sees all major nav sections', async ({ page }) => {
    await loginAs(page, 'director')
    const nav = await page.textContent('nav')
    for (const section of ['employee', 'leave', 'payroll', 'compliance']) {
      expect(nav?.toLowerCase()).toContain(section)
    }
  })
})

// ── API enforcement ───────────────────────────────────────────────────────

test.describe('API permission enforcement', () => {
  test('employee cannot read payroll runs', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/payroll-finance/runs')
    expect([401, 403]).toContain(status)
  })

  test('employee cannot read users list', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/users')
    expect([401, 403]).toContain(status)
  })

  test('employee cannot write to users', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'POST', '/api/tenant/users', {
      email: 'hack@test.com', role: 'director', password: 'Hacked123!'
    })
    expect([401, 403]).toContain(status)
  })

  test('payroll_officer can read payroll runs', async ({ page }) => {
    await loginAs(page, 'payroll_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/payroll-finance/runs')
    expect(status).toBe(200)
    expect(data).toHaveProperty('runs')
  })

  test('auditor can read audit log', async ({ page }) => {
    await loginAs(page, 'auditor')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/audit-log')
    expect(status).toBe(200)
    expect(data).toHaveProperty('logs')
  })

  test('employee cannot read audit log', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/audit-log')
    expect([401, 403]).toContain(status)
  })
})

// ── Tenant isolation ──────────────────────────────────────────────────────

test.describe('Tenant isolation', () => {
  test('yahwehcare employee data does not appear to yahwehpc director', async ({ browser }) => {
    // Login as yahwehcare director in context A
    const ctxA = await browser.newContext()
    const pageA = await ctxA.newPage()
    await pageA.goto(process.env.BASE_URL_TENANT_B ?? 'https://yahwehpc-hrmsapp.vercel.app/login')
    await pageA.fill('[name="email"]', 'director@yahwehpc.com.au')
    await pageA.fill('[name="password"]', 'Test@12345')
    await pageA.click('[type="submit"]')
    await expect(pageA).toHaveURL(/\/(dashboard|home|app)/, { timeout: 15_000 })

    // Fetch employee list from yahwehpc context
    const { data } = await apiCall(pageA, 'GET', '/api/tenant/employees')
    const emails: string[] = (data?.employees ?? []).map((e: any) => e.email)

    // No yahwehcare.com.au emails should appear in yahwehpc context
    const crossTenant = emails.filter(e => e.endsWith('@yahwehcare.com.au'))
    expect(crossTenant).toHaveLength(0)

    await ctxA.close()
  })
})
