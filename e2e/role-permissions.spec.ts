import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Role-permissions matrix', () => {
  test('director can read the permission matrix', async ({ page }) => {
    await loginAs(page, 'director')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/role-permissions')
    expect(status).toBe(200)
    expect(data).toHaveProperty('permissions')
    expect(Array.isArray(data.permissions)).toBe(true)
    expect(data.permissions.length).toBeGreaterThan(0)
  })

  test('permission entries have expected shape', async ({ page }) => {
    await loginAs(page, 'director')
    const { data } = await apiCall(page, 'GET', '/api/tenant/role-permissions')
    const first = data.permissions[0]
    expect(first).toHaveProperty('role')
    expect(first).toHaveProperty('key')
    expect(first).toHaveProperty('module')
    expect(first).toHaveProperty('action')
  })

  test('it_admin can read the permission matrix', async ({ page }) => {
    await loginAs(page, 'it_admin')
    const { status } = await apiCall(page, 'GET', '/api/tenant/role-permissions')
    expect(status).toBe(200)
  })

  test('employee cannot read the permission matrix', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/role-permissions')
    expect([403, 401]).toContain(status)
  })

  test('auditor cannot read the permission matrix', async ({ page }) => {
    await loginAs(page, 'auditor')
    const { status } = await apiCall(page, 'GET', '/api/tenant/role-permissions')
    expect([403, 401]).toContain(status)
  })

  test('matrix covers all 10 expected roles', async ({ page }) => {
    await loginAs(page, 'director')
    const { data } = await apiCall(page, 'GET', '/api/tenant/role-permissions')
    const roles = new Set(data.permissions.map((p: any) => p.role))
    const expectedRoles = [
      'director', 'hr_officer', 'compliance_manager', 'operations_manager',
      'team_leader', 'payroll_officer', 'auditor', 'it_admin', 'employee', 'contractor',
    ]
    expectedRoles.forEach(r => expect(roles).toContain(r))
  })
})
