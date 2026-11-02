import { test as setup } from 'playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '../.auth/hr_officer.json')

setup('authenticate as hr_officer', async ({ page }) => {
  // Use API login to avoid selector issues and 2FA on director account
  const res = await page.request.post('/api/auth/login', {
    data: {
      email: 'hr@yahwehcare.com.au',
      password: 'Test@12345',
      tenantSlug: 'yahwehcare'
    }
  })
  if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${await res.text()}`)

  await page.goto('/tenant/dashboard')
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 })
  await page.context().storageState({ path: AUTH_FILE })
})
