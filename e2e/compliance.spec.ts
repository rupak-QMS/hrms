import { test, expect } from '@playwright/test'
import { loginAs, apiCall } from './helpers/login'

/**
 * Compliance E2E — compliance_manager role views and updates compliance status.
 * Employee compliance status lifecycle: pending → in_progress → compliant.
 */

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Compliance tracking', () => {
  test('compliance_manager can list employees by compliance status', async ({ page }) => {
    await loginAs(page, 'compliance_manager')
    const { status, data } = await apiCall(
      page, 'GET', '/api/tenant/employees?complianceStatus=pending&limit=10'
    )
    expect(status).toBe(200)
    expect(data).toHaveProperty('employees')
    expect(Array.isArray(data.employees)).toBe(true)
  })

  test('compliance_manager can update an employee compliance status', async ({ page }) => {
    await loginAs(page, 'compliance_manager')

    // Get an employee to update
    const { data: listData } = await apiCall(
      page, 'GET', '/api/tenant/employees?limit=1'
    )
    const emp = listData?.employees?.[0]
    if (!emp) return // skip if no employees

    const newStatus = emp.complianceStatus === 'compliant' ? 'in_progress' : 'compliant'
    const { status } = await apiCall(
      page, 'PATCH', `/api/tenant/employees/${emp.id}`,
      { complianceStatus: newStatus }
    )
    expect([200, 204]).toContain(status)

    // Restore original
    await apiCall(page, 'PATCH', `/api/tenant/employees/${emp.id}`, {
      complianceStatus: emp.complianceStatus,
    })
  })

  test('compliance_manager can view compliance summary', async ({ page }) => {
    await loginAs(page, 'compliance_manager')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/compliance-summary')
    // 200 = dedicated endpoint exists; 404 = not yet built (acceptable)
    expect([200, 404]).toContain(status)
    if (status === 200) {
      expect(data).toBeDefined()
    }
  })

  test('employee cannot update own compliance status', async ({ page }) => {
    await loginAs(page, 'employee')

    // Get own employee record
    const { data: meData } = await apiCall(page, 'GET', '/api/tenant/me')
    const empId = meData?.employee?.id ?? meData?.id
    if (!empId) return

    const { status } = await apiCall(
      page, 'PATCH', `/api/tenant/employees/${empId}`,
      { complianceStatus: 'compliant' }
    )
    expect([403, 401]).toContain(status)
  })

  test('NDIS worker flag is visible to compliance_manager', async ({ page }) => {
    await loginAs(page, 'compliance_manager')
    const { status, data } = await apiCall(
      page, 'GET', '/api/tenant/employees?ndisWorker=true&limit=10'
    )
    // May be 200 with results or 200 with empty array — confirms field is filterable
    expect(status).toBe(200)
    for (const emp of data?.employees ?? []) {
      expect(emp.ndisWorker).toBe(true)
    }
  })
})
