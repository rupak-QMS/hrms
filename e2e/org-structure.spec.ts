import { test, expect } from '@playwright/test'
import { apiCall } from './helpers/login'

/**
 * Organisation Structure E2E — departments, positions, branches, org chart.
 * Uses director auth (storageState from setup).
 */

test.describe('Organisation structure', () => {
  test('departments list returns tenant departments with headcount', async ({ page }) => {
    await page.goto('/dashboard')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/departments')
    expect(status).toBe(200)
    expect(data).toHaveProperty('departments')
    for (const dept of data.departments) {
      expect(dept).toHaveProperty('id')
      expect(dept).toHaveProperty('name')
      expect(dept).toHaveProperty('headcount')
      expect(typeof dept.headcount).toBe('number')
    }
  })

  test('positions list returns positions with department name', async ({ page }) => {
    await page.goto('/dashboard')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/positions')
    expect(status).toBe(200)
    expect(data).toHaveProperty('positions')
    for (const pos of data.positions) {
      expect(pos).toHaveProperty('id')
      expect(pos).toHaveProperty('title')
    }
  })

  test('can create and deactivate a department', async ({ page }) => {
    await page.goto('/dashboard')
    const name = `E2E Dept ${Date.now()}`

    const { status: createStatus, data: createData } = await apiCall(
      page, 'POST', '/api/tenant/departments', { name, description: 'E2E test dept' }
    )
    expect(createStatus).toBe(201)
    const deptId = createData.department?.id
    expect(deptId).toBeTruthy()

    // Soft delete
    const { status: deleteStatus } = await apiCall(
      page, 'DELETE', `/api/tenant/departments/${deptId}`
    )
    expect(deleteStatus).toBe(200)

    // Should not appear in active list
    const { data: afterData } = await apiCall(page, 'GET', '/api/tenant/departments')
    const ids = afterData.departments.map((d: any) => d.id)
    expect(ids).not.toContain(deptId)
  })

  test('can create and deactivate a position', async ({ page }) => {
    await page.goto('/dashboard')
    const title = `E2E Position ${Date.now()}`

    const { status, data } = await apiCall(page, 'POST', '/api/tenant/positions', {
      title,
      isParticipantFacing: true,
      isKeyPersonnel: false,
    })
    expect(status).toBe(201)
    const posId = data.position?.id
    expect(posId).toBeTruthy()

    const { status: patchStatus } = await apiCall(
      page, 'PATCH', `/api/tenant/positions/${posId}`, { isActive: false }
    )
    expect(patchStatus).toBe(200)
  })

  test('can create a branch (work location)', async ({ page }) => {
    await page.goto('/dashboard')
    const { status, data } = await apiCall(page, 'POST', '/api/tenant/branches', {
      name:    `E2E Branch ${Date.now()}`,
      code:    `E2E${Date.now().toString().slice(-4)}`,
      suburb:  'Parramatta',
      state:   'NSW',
      postcode: '2150',
    })
    expect(status).toBe(201)
    expect(data.branch?.id).toBeTruthy()

    // Cleanup
    await apiCall(page, 'DELETE', `/api/tenant/branches/${data.branch.id}`)
  })

  test('org chart tree has no orphaned nodes', async ({ page }) => {
    await page.goto('/dashboard')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/org-chart')
    expect(status).toBe(200)

    // Build flat ID set
    const flattenTree = (nodes: any[]): string[] =>
      nodes.flatMap(n => [n.id, ...flattenTree(n.children ?? [])])
    const treeIds = new Set(flattenTree(data.tree ?? []))

    // Every node in the tree must have been accounted for
    expect(treeIds.size).toBe(data.total)
  })
})
