import { test, expect } from 'playwright/test'
import { apiCall } from './helpers/login'

/**
 * Cross-Tenant Isolation E2E
 *
 * Verifies that a user authenticated against tenant A cannot access
 * data belonging to tenant B through the API. All tenant-scoped routes
 * filter by the session's own tenantId server-side; these tests confirm
 * that no cross-tenant records bleed through.
 *
 * Strategy:
 *   1. Log into yahwehcare as hr_officer → collect employee emails / IDs.
 *   2. Log into yahwehpc (separate context) as hr_officer.
 *   3. Assert yahwehpc responses contain no @yahwehcare.com.au emails /
 *      none of the yahwehcare employee IDs.
 *   4. Attempt to read a yahwehcare employee record directly from the
 *      yahwehpc session by ID — expect 404 or 403, never 200.
 */

test.use({ storageState: { cookies: [], origins: [] } })

// ── helpers ──────────────────────────────────────────────────────────────

async function loginYahwehpc(page: any) {
  const res = await page.request.post('/api/auth/login', {
    data: { email: 'hr@yahwehpc.com.au', password: 'Test@12345', tenantSlug: 'yahwehpc' },
  })
  if (!res.ok()) {
    return { ok: false, status: res.status() }
  }
  await page.goto('/tenant/dashboard')
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 })
  return { ok: true, status: res.status() }
}

async function loginYahwehcare(page: any) {
  const res = await page.request.post('/api/auth/login', {
    data: { email: 'hr@yahwehcare.com.au', password: 'Test@12345', tenantSlug: 'yahwehcare' },
  })
  if (!res.ok()) return { ok: false, status: res.status() }
  await page.goto('/tenant/dashboard')
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 })
  return { ok: true, status: res.status() }
}

// ── tests ────────────────────────────────────────────────────────────────

test.describe('Cross-tenant isolation', () => {
  test('yahwehpc session cannot see yahwehcare employees', async ({ browser }) => {
    // Collect yahwehcare employee IDs and emails
    const ctxCare = await browser.newContext()
    const pageCare = await ctxCare.newPage()
    const loginCare = await loginYahwehcare(pageCare)
    if (!loginCare.ok) {
      await ctxCare.close()
      test.skip(true, `yahwehcare login unavailable (${loginCare.status})`)
      return
    }

    const { data: careData } = await apiCall(pageCare, 'GET', '/api/tenant/employees?limit=50')
    const careEmails: string[] = (careData?.employees ?? []).map((e: any) => e.email as string)
    const careIds: string[]    = (careData?.employees ?? []).map((e: any) => e.id as string)
    await ctxCare.close()

    // Log into yahwehpc and pull its employee list
    const ctxPc = await browser.newContext()
    const pagePc = await ctxPc.newPage()
    const loginPc = await loginYahwehpc(pagePc)
    if (!loginPc.ok) {
      await ctxPc.close()
      test.skip(true, `yahwehpc login unavailable (${loginPc.status})`)
      return
    }

    const { data: pcData } = await apiCall(pagePc, 'GET', '/api/tenant/employees?limit=50')
    const pcEmails: string[] = (pcData?.employees ?? []).map((e: any) => e.email as string)
    const pcIds: string[]    = (pcData?.employees ?? []).map((e: any) => e.id as string)

    // No yahwehcare emails should appear in yahwehpc results
    const leaked = pcEmails.filter(e => careEmails.includes(e))
    expect(leaked).toHaveLength(0)

    // No yahwehcare IDs should appear in yahwehpc results
    const leakedIds = pcIds.filter(id => careIds.includes(id))
    expect(leakedIds).toHaveLength(0)

    await ctxPc.close()
  })

  test('yahwehpc session gets 404/403 reading a yahwehcare employee by ID', async ({ browser }) => {
    // Get a real yahwehcare employee ID
    const ctxCare = await browser.newContext()
    const pageCare = await ctxCare.newPage()
    const loginCare = await loginYahwehcare(pageCare)
    if (!loginCare.ok) {
      await ctxCare.close()
      test.skip(true, `yahwehcare login unavailable (${loginCare.status})`)
      return
    }
    const { data: careData } = await apiCall(pageCare, 'GET', '/api/tenant/employees?limit=1')
    const careEmpId: string | undefined = careData?.employees?.[0]?.id
    await ctxCare.close()

    if (!careEmpId) {
      test.skip(true, 'No yahwehcare employees found — skipping direct-ID isolation test')
      return
    }

    // Try to read that ID from a yahwehpc session
    const ctxPc = await browser.newContext()
    const pagePc = await ctxPc.newPage()
    const loginPc = await loginYahwehpc(pagePc)
    if (!loginPc.ok) {
      await ctxPc.close()
      test.skip(true, `yahwehpc login unavailable (${loginPc.status})`)
      return
    }

    const { status } = await apiCall(pagePc, 'GET', `/api/tenant/employees/${careEmpId}`)
    // Must never return 200 — the record belongs to a different tenant
    expect([403, 404]).toContain(status)

    await ctxPc.close()
  })

  test('yahwehpc session cannot see yahwehcare leave records', async ({ browser }) => {
    const ctxCare = await browser.newContext()
    const pageCare = await ctxCare.newPage()
    const loginCare = await loginYahwehcare(pageCare)
    if (!loginCare.ok) { await ctxCare.close(); test.skip(); return }

    const { data: careData } = await apiCall(pageCare, 'GET', '/api/tenant/leave?limit=50')
    const careIds: string[] = (careData?.requests ?? careData?.leaves ?? []).map((r: any) => r.id)
    await ctxCare.close()

    const ctxPc = await browser.newContext()
    const pagePc = await ctxPc.newPage()
    const loginPc = await loginYahwehpc(pagePc)
    if (!loginPc.ok) { await ctxPc.close(); test.skip(); return }

    const { data: pcData } = await apiCall(pagePc, 'GET', '/api/tenant/leave?limit=50')
    const pcIds: string[] = (pcData?.requests ?? pcData?.leaves ?? []).map((r: any) => r.id)

    const leaked = pcIds.filter(id => careIds.includes(id))
    expect(leaked).toHaveLength(0)

    await ctxPc.close()
  })

  test('yahwehpc session cannot see yahwehcare payroll runs', async ({ browser }) => {
    const ctxCare = await browser.newContext()
    const pageCare = await ctxCare.newPage()
    const loginCare = await loginYahwehcare(pageCare)
    if (!loginCare.ok) { await ctxCare.close(); test.skip(); return }

    const { data: careData } = await apiCall(
      pageCare, 'GET', '/api/tenant/payroll-finance/runs?limit=50'
    )
    const careIds: string[] = (careData?.runs ?? []).map((r: any) => r.id)
    await ctxCare.close()

    const ctxPc = await browser.newContext()
    const pagePc = await ctxPc.newPage()
    const loginPc = await loginYahwehpc(pagePc)
    if (!loginPc.ok) { await ctxPc.close(); test.skip(); return }

    const { data: pcData } = await apiCall(
      pagePc, 'GET', '/api/tenant/payroll-finance/runs?limit=50'
    )
    const pcIds: string[] = (pcData?.runs ?? []).map((r: any) => r.id)

    const leaked = pcIds.filter(id => careIds.includes(id))
    expect(leaked).toHaveLength(0)

    await ctxPc.close()
  })

  test('unauthenticated request to tenant API returns 401', async ({ page }) => {
    // No login — raw fetch with no session cookie
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/tenant/employees', {
        method: 'GET',
        credentials: 'include',
      })
      return { status: res.status }
    })
    expect(result.status).toBe(401)
  })
})
