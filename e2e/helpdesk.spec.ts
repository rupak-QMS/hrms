import { test, expect } from 'playwright/test'
import { loginAs, apiCall } from './helpers/login'

/**
 * Helpdesk / Tickets E2E
 * GET  /api/tenant/tickets           — list tickets with SLA stats
 * POST /api/tenant/tickets           — create ticket
 * Requires: helpdesk:read (GET), helpdesk:write (POST)
 *
 * Ticket number format: TKT-YYYYMM-NNNN
 * Required POST fields: title (min 3), description (min 10)
 * Optional: category (it|hr|payroll|facilities|compliance|other), priority (low|medium|high|critical)
 */

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Helpdesk module', () => {
  let ticketId: string

  test('hr_officer can list tickets', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/tickets')
    expect(status).toBe(200)
    expect(data).toHaveProperty('tickets')
    expect(Array.isArray(data.tickets)).toBe(true)
    expect(data).toHaveProperty('stats')
  })

  test('ticket list includes SLA stats shape', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { data } = await apiCall(page, 'GET', '/api/tenant/tickets')
    const stats = data?.stats
    expect(stats).toHaveProperty('totalOpen')
    expect(stats).toHaveProperty('breached')
    expect(stats).toHaveProperty('resolvedToday')
    expect(stats).toHaveProperty('criticalOpen')
  })

  test('hr_officer can create a ticket', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'POST', '/api/tenant/tickets', {
      title:       'E2E_TEST_2026-11-03 IT issue',
      description: 'Printer on level 2 is offline and needs urgent attention.',
      category:    'it',
      priority:    'high',
    })
    expect(status).toBe(201)
    expect(data.ticket).toHaveProperty('id')
    expect(data.ticket).toHaveProperty('ticketNumber')
    expect(data.ticket.ticketNumber).toMatch(/^TKT-\d{6}-\d{4}$/)
    ticketId = data.ticket.id
  })

  test('POST without title returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'POST', '/api/tenant/tickets', {
      description: 'Missing title field',
    })
    expect(status).toBe(400)
  })

  test('POST with title too short returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'POST', '/api/tenant/tickets', {
      title:       'Hi',
      description: 'Title is only 2 chars, below the minimum of 3.',
    })
    expect(status).toBe(400)
  })

  test('POST with description too short returns 400', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status } = await apiCall(page, 'POST', '/api/tenant/tickets', {
      title:       'Valid title here',
      description: 'Too short',
    })
    expect(status).toBe(400)
  })

  test('tickets can be filtered by status', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/tickets?status=open')
    expect(status).toBe(200)
    data.tickets.forEach((t: any) => expect(t.status).toBe('open'))
  })

  test('tickets can be filtered by priority', async ({ page }) => {
    await loginAs(page, 'hr_officer')
    const { status, data } = await apiCall(page, 'GET', '/api/tenant/tickets?priority=high')
    expect(status).toBe(200)
    data.tickets.forEach((t: any) => expect(t.priority).toBe('high'))
  })

  test('employee can create a ticket (self-service)', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status, data } = await apiCall(page, 'POST', '/api/tenant/tickets', {
      title:       'E2E_TEST_2026-11-03 Employee HR query',
      description: 'I have a question about my leave entitlement for this year.',
      category:    'hr',
      priority:    'low',
    })
    expect(status).toBe(201)
    expect(data.ticket).toHaveProperty('id')
  })

  test('employee can list tickets', async ({ page }) => {
    await loginAs(page, 'employee')
    const { status } = await apiCall(page, 'GET', '/api/tenant/tickets')
    expect(status).toBe(200)
  })

  test('auditor cannot access helpdesk', async ({ page }) => {
    await loginAs(page, 'auditor')
    const { status } = await apiCall(page, 'GET', '/api/tenant/tickets')
    expect([403, 401]).toContain(status)
  })

  test('contractor cannot access helpdesk', async ({ page }) => {
    await loginAs(page, 'contractor')
    const { status } = await apiCall(page, 'GET', '/api/tenant/tickets')
    expect([403, 401]).toContain(status)
  })
})
