/**
 * RLS Integration Tests — Yahweh HRMS
 *
 * Verifies Supabase Row Level Security policies enforce:
 *   1. Tenant isolation — users cannot read/write another tenant's data
 *   2. Cross-tenant write prevention
 *
 * Prerequisites (add to .env.local for local run, or CI secrets):
 *   DATABASE_URL — postgres connection string (the same one the app uses)
 *
 * Run: vitest run src/__tests__/rls/rls.integration.test.ts
 * Tests are skipped when DATABASE_URL is absent or points to the vitest stub.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

// Known tenant IDs from seed data
const TENANT_A = 'c1000000-0000-0000-0000-000000000001' // Yahweh Care
const TENANT_B = '00000000-0000-0000-0000-000000000002' // Yahweh Property Care

// Skip when DATABASE_URL is absent or is the vitest stub value
const INTEGRATION = !!(
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('test.neon.tech')
)

let sql: ReturnType<typeof postgres> | null = null
let userA: string | null = null
let userB: string | null = null

beforeAll(async () => {
  if (!INTEGRATION) return
  sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: false }, max: 3 })
  const [rA] = await sql`SELECT id FROM hrms_users WHERE tenant_id = ${TENANT_A} LIMIT 1`
  const [rB] = await sql`SELECT id FROM hrms_users WHERE tenant_id = ${TENANT_B} LIMIT 1`
  userA = rA?.id ?? null
  userB = rB?.id ?? null
})

afterAll(async () => { if (sql) await sql.end() })

/** Run a query impersonating an authenticated HRMS user via RLS JWT claims. */
async function asUser(
  userId: string, tenantId: string, userRole: string,
  query: (tx: any) => Promise<any>
) {
  return sql!.begin(async (tx) => {
    await tx`SELECT set_config('request.jwt.claims',
      ${JSON.stringify({ sub: userId, role: 'authenticated', tenant_id: tenantId, user_role: userRole })},
      true)`
    await tx`SET LOCAL ROLE authenticated`
    const result = await query(tx)
    await tx`RESET ROLE`
    return result
  })
}

// ── Block 1: hrms_employees ──────────────────────────────────────────────────

describe.skipIf(!INTEGRATION)('RLS: hrms_employees', () => {
  it('1.1 User A sees 0 Tenant B employees', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'hr_officer',
      (tx) => tx`SELECT count(*) AS n FROM hrms_employees WHERE tenant_id = ${TENANT_B}`)
    expect(Number(n)).toBe(0)
  })

  it('1.2 User B sees 0 Tenant A employees', async () => {
    const [{ n }] = await asUser(userB!, TENANT_B, 'hr_officer',
      (tx) => tx`SELECT count(*) AS n FROM hrms_employees WHERE tenant_id = ${TENANT_A}`)
    expect(Number(n)).toBe(0)
  })

  it('1.3 User A can read their own tenant employees (>0)', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'hr_officer',
      (tx) => tx`SELECT count(*) AS n FROM hrms_employees WHERE tenant_id = ${TENANT_A}`)
    expect(Number(n)).toBeGreaterThan(0)
  })
})

// ── Block 2: hrms_users ──────────────────────────────────────────────────────

describe.skipIf(!INTEGRATION)('RLS: hrms_users', () => {
  it('2.1 User A sees 0 Tenant B user accounts', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'hr_officer',
      (tx) => tx`SELECT count(*) AS n FROM hrms_users WHERE tenant_id = ${TENANT_B}`)
    expect(Number(n)).toBe(0)
  })

  it('2.2 User A can read their own tenant users (>0)', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'hr_officer',
      (tx) => tx`SELECT count(*) AS n FROM hrms_users WHERE tenant_id = ${TENANT_A}`)
    expect(Number(n)).toBeGreaterThan(0)
  })
})

// ── Block 3: hrms_payroll_runs ───────────────────────────────────────────────

describe.skipIf(!INTEGRATION)('RLS: hrms_payroll_runs', () => {
  it('3.1 Payroll officer A sees 0 Tenant B payroll runs', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'payroll_officer',
      (tx) => tx`SELECT count(*) AS n FROM hrms_payroll_runs WHERE tenant_id = ${TENANT_B}`)
    expect(Number(n)).toBe(0)
  })
})

// ── Block 4: hrms_leave_requests ─────────────────────────────────────────────

describe.skipIf(!INTEGRATION)('RLS: hrms_leave_requests', () => {
  it('4.1 User A sees 0 Tenant B leave requests', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'hr_officer',
      (tx) => tx`SELECT count(*) AS n FROM hrms_leave_requests WHERE tenant_id = ${TENANT_B}`)
    expect(Number(n)).toBe(0)
  })
})

// ── Block 5: hrms_audit_logs ──────────────────────────────────────────────────

describe.skipIf(!INTEGRATION)('RLS: hrms_audit_logs', () => {
  it('5.1 Auditor A sees 0 Tenant B audit log entries', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'auditor',
      (tx) => tx`SELECT count(*) AS n FROM hrms_audit_logs WHERE tenant_id = ${TENANT_B}`)
    expect(Number(n)).toBe(0)
  })
})

// ── Block 6: hrms_tenants ────────────────────────────────────────────────────

describe.skipIf(!INTEGRATION)('RLS: hrms_tenants', () => {
  it('6.1 Employee A cannot see Tenant B in hrms_tenants', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'employee',
      (tx) => tx`SELECT count(*) AS n FROM hrms_tenants WHERE id = ${TENANT_B}`)
    expect(Number(n)).toBe(0)
  })

  it('6.2 Employee A can see their own tenant row', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'employee',
      (tx) => tx`SELECT count(*) AS n FROM hrms_tenants WHERE id = ${TENANT_A}`)
    expect(Number(n)).toBe(1)
  })
})

// ── Block 7: cross-tenant write prevention ───────────────────────────────────

describe.skipIf(!INTEGRATION)('RLS: cross-tenant write prevention', () => {
  it('7.1 User A cannot INSERT an hrms_user into Tenant B', async () => {
    await expect(
      asUser(userA!, TENANT_A, 'hr_officer', (tx) =>
        tx`INSERT INTO hrms_users (id, tenant_id, email, role, is_active)
           VALUES (gen_random_uuid(), ${TENANT_B}, 'rls_test_intruder@test.invalid', 'employee', false)`)
    ).rejects.toThrow()
  })

  it('7.2 User A UPDATE on Tenant B employees affects 0 rows', async () => {
    const rows = await asUser(userA!, TENANT_A, 'hr_officer', (tx) =>
      tx`UPDATE hrms_employees SET is_active = false WHERE tenant_id = ${TENANT_B} RETURNING id`)
    expect(rows.length).toBe(0)
  })
})

// ── Block 8: hrms_approval_requests ─────────────────────────────────────────

describe.skipIf(!INTEGRATION)('RLS: hrms_approval_requests', () => {
  it('8.1 HR Officer A sees 0 Tenant B approval requests', async () => {
    const [{ n }] = await asUser(userA!, TENANT_A, 'hr_officer',
      (tx) => tx`SELECT count(*) AS n FROM hrms_approval_requests WHERE tenant_id = ${TENANT_B}`)
    expect(Number(n)).toBe(0)
  })
})

// ── Block 9: service_role bypasses RLS (expected) ───────────────────────────

describe.skipIf(!INTEGRATION)('RLS: service_role bypass (expected)', () => {
  it('9.1 Direct DB connection sees employees across all tenants (≥2)', async () => {
    const [{ n }] = await sql!`SELECT COUNT(DISTINCT tenant_id) AS n FROM hrms_employees`
    expect(Number(n)).toBeGreaterThanOrEqual(2)
  })
})
