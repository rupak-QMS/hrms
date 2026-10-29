import { Page } from '@playwright/test'

/**
 * Log in as a specific role and return a page ready to use.
 * Uses the test credentials from credentials.md.
 * NOTE: respect the rate limiter — max 9 logins per 60s per IP.
 */
const CREDS: Record<string, { email: string; password: string }> = {
  director:             { email: 'director@yahwehcare.com.au',    password: 'Test@12345' },
  hr_officer:           { email: 'hr@yahwehcare.com.au',          password: 'Test@12345' },
  operations_manager:   { email: 'ops@yahwehcare.com.au',         password: 'Test@12345' },
  compliance_manager:   { email: 'compliance@yahwehcare.com.au',  password: 'Test@12345' },
  team_leader:          { email: 'teamlead@yahwehcare.com.au',    password: 'Test@12345' },
  payroll_officer:      { email: 'payroll@yahwehcare.com.au',     password: 'Test@12345' },
  auditor:              { email: 'auditor@yahwehcare.com.au',     password: 'Test@12345' },
  employee:             { email: 'employee@yahwehcare.com.au',    password: 'Test@12345' },
  contractor:           { email: 'contractor@yahwehcare.com.au',  password: 'Test@12345' },
}

export async function loginAs(page: Page, role: keyof typeof CREDS) {
  const cred = CREDS[role]
  if (!cred) throw new Error(`Unknown role: ${role}`)
  await page.goto('/login')
  await page.fill('[name="email"]', cred.email)
  await page.fill('[name="password"]', cred.password)
  await page.click('[type="submit"]')
  await page.waitForURL(/\/(dashboard|home|app)/, { timeout: 15_000 })
}

export async function apiCall(
  page: Page,
  method: string,
  path: string,
  body?: object
): Promise<{ status: number; data: any }> {
  const result = await page.evaluate(
    async ({ method, path, body }) => {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      return { status: res.status, data: await res.json().catch(() => null) }
    },
    { method, path, body }
  )
  return result
}
