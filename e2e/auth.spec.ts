import { test, expect } from 'playwright/test'

/**
 * Auth E2E — login, logout, wrong password, direct URL guard
 * Runs as guest (no storageState dependency)
 */

test.use({ storageState: { cookies: [], origins: [] } })

/** Helper: POST login with one automatic retry after 5s on rate-limit 500 */
async function loginRequest(page: import('playwright/test').Page, email: string, password: string) {
  let res = await page.request.post('/api/auth/login', {
    data: { email, password, tenantSlug: 'yahwehcare' }
  })
  if (res.status() === 500) {
    // Rate limiter may be cooling down — wait and retry once
    await new Promise(r => setTimeout(r, 5_000))
    res = await page.request.post('/api/auth/login', {
      data: { email, password, tenantSlug: 'yahwehcare' }
    })
  }
  return res
}

test.describe('Authentication', () => {
  test('login with valid credentials redirects to tenant dashboard', async ({ page }) => {
    const res = await loginRequest(page, 'hr@yahwehcare.com.au', 'Test@12345')
    expect(res.ok()).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('redirectTo')
  })

  test('wrong password returns 401', async ({ page }) => {
    const res = await page.request.post('/api/auth/login', {
      data: { email: 'hr@yahwehcare.com.au', password: 'WrongPassword99!', tenantSlug: 'yahwehcare' }
    })
    expect(res.status()).toBe(401)
  })

  test('unauthenticated user accessing /tenant/dashboard is redirected to /login', async ({ page }) => {
    await page.goto('/tenant/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('unauthenticated user accessing an API route gets 401', async ({ page }) => {
    const res = await page.request.get('/api/tenant/employees')
    expect(res.status()).toBe(401)
  })

  test('logout clears session — API returns 401 after logout', async ({ page }) => {
    // Login first
    const loginRes = await loginRequest(page, 'hr@yahwehcare.com.au', 'Test@12345')
    expect(loginRes.ok()).toBe(true)

    // Confirm we can access a protected API
    const before = await page.request.get('/api/auth/me')
    expect(before.status()).toBe(200)

    // Logout
    const logoutRes = await page.request.post('/api/auth/logout')
    expect([200, 204]).toContain(logoutRes.status())

    // Now protected API should fail
    const after = await page.request.get('/api/auth/me')
    expect([401, 403]).toContain(after.status())
  })
})
