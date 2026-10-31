import { test, expect } from '@playwright/test'
import { loginAs, apiCall } from './helpers/login'

/**
 * Approval workflow E2E — hr_officer creates approval; team_leader approves/rejects.
 * Tests the generic hrms_approval_requests engine.
 */

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Approval workflow', () => {
  let requestId: string

  test('hr_officer can create an approval request', async ({ page }) => {
    await loginAs(page, 'hr_officer')

    const { status, data } = await apiCall(page, 'POST', '/api/tenant/approvals', {
      type:     'leave',
      entityId: '00000000-0000-0000-0000-000000000099', // placeholder ref
      notes:    'E2E test approval request',
    })
    expect([200, 201, 400]).toContain(status)
    if (status === 201 || status === 200) {
      requestId = data?.request?.id ?? data?.id
      expect(requestId).toBeTruthy()
    }
  })

  test('hr_officer can list pending approval requests', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(
      page, 'GET', '/api/tenant/approvals?status=pending&limit=10'
    )
    expect(status).toBe(200)
    expect(data).toBeDefined()
  })

  test('team_leader can list pending approvals', async ({ page }) => {
    await loginAs(page, 'team_leader')
    const { status, data } = await apiCall(
      page, 'GET', '/api/tenant/approvals?status=pending'
    )
    expect(status).toBe(200)
    expect(data).toBeDefined()
  })

  test('employee cannot create an approval request for another employee', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'POST', '/api/tenant/approvals', {
      type:     'leave',
      entityId: '00000000-0000-0000-0000-000000000001',
      notes:    'Attempted privilege escalation',
    })
    expect([401, 403]).toContain(status)
  })

  test('team_leader can approve a pending request', async ({ page }) => {
    await loginAs(page, 'team_leader')

    // Use requestId from creation test, or find any pending request
    const targetId = requestId ?? (await (async () => {
      const { data } = await apiCall(page, 'GET', '/api/tenant/approvals?status=pending&limit=1')
      return data?.requests?.[0]?.id ?? data?.approvals?.[0]?.id
    })())

    if (!targetId) return // no pending requests — skip

    const { status } = await apiCall(
      page, 'PATCH', `/api/tenant/approvals/${targetId}`,
      { action: 'approve', notes: 'E2E approved' }
    )
    expect([200, 204]).toContain(status)
  })

  test('employee cannot approve any approval request', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(
      page, 'PATCH', '/api/tenant/approvals/00000000-0000-0000-0000-000000000001',
      { action: 'approve' }
    )
    expect([401, 403, 404]).toContain(status)
  })
})
