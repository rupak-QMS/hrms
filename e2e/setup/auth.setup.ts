import { test as setup } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '../.auth/director.json')

setup('authenticate as director', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name="email"]', 'director@yahwehcare.com.au')
  await page.fill('[name="password"]', process.env.TEST_PASSWORD ?? 'Test@12345')
  await page.click('[type="submit"]')

  // Wait for dashboard redirect
  await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 15_000 })

  await page.context().storageState({ path: AUTH_FILE })
})
