import { test, expect } from '@playwright/test'

/**
 * Auth E2E — login, logout, wrong password, direct URL guard
 * Runs as guest (no storageState dependency)
 */

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication', () => {
  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'director@yahwehcare.com.au')
    await page.fill('[name="password"]', 'Test@12345')
    await page.click('[type="submit"]')
    await expect(page).toHaveURL(/\/(dashboard|home|app)/, { timeout: 15_000 })
  })

  test('wrong password shows error, stays on /login', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'director@yahwehcare.com.au')
    await page.fill('[name="password"]', 'WrongPassword99!')
    await page.click('[type="submit"]')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    // Error message visible somewhere on the page
    const body = await page.textContent('body')
    expect(body?.toLowerCase()).toMatch(/invalid|incorrect|wrong|unauthori/)
  })

  test('unauthenticated user accessing /dashboard is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('unauthenticated user accessing an API route gets 401', async ({ page }) => {
    const res = await page.request.get('/api/tenant/employees')
    expect(res.status()).toBe(401)
  })

  test('logout clears session and redirects to /login', async ({ page }) => {
    // First login
    await page.goto('/login')
    await page.fill('[name="email"]', 'hr@yahwehcare.com.au')
    await page.fill('[name="password"]', 'Test@12345')
    await page.click('[type="submit"]')
    await expect(page).toHaveURL(/\/(dashboard|home|app)/, { timeout: 15_000 })

    // Logout via API (most Next.js apps expose this)
    const logoutRes = await page.request.post('/api/auth/logout')
    expect([200, 302, 204]).toContain(logoutRes.status())

    // Dashboard should now redirect to login
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })
})
