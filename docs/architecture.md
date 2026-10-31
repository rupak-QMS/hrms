# Yahweh HRMS — Architecture Document

**Version:** 1.0  
**Date:** 2026-10-31  
**Project:** Yahweh HRMS (multi-tenant SaaS HRMS for Yahweh Care & Yahweh Property Care)

---

## 1. System Overview

Yahweh HRMS is a multi-tenant SaaS human resource management system designed for NDIS-registered disability-care providers in Australia. Two live tenants share the platform: **Yahweh Care** (disability services) and **Yahweh Property Care** (maintenance/facilities arm). A third **super-admin** portal manages tenant provisioning.

### Deployment topology

```
┌──────────────────────────────────────────────────────────────────┐
│ Vercel (Edge Network)                                            │
│                                                                  │
│  superadmin-hrmsapp.vercel.app   ─── Super-admin portal         │
│  yahwehcare-hrmsapp.vercel.app   ─── Tenant: Yahweh Care        │
│  yahwehpc-hrmsapp.vercel.app     ─── Tenant: Yahweh Property Care│
└──────────────────┬───────────────────────────────────────────────┘
                   │ HTTPS (server actions / route handlers)
┌──────────────────▼───────────────────────────────────────────────┐
│ Supabase (PostgreSQL + Auth + Storage + RLS)                     │
│  Project: ukmosenqkuczgbirmrgn                                   │
│  Region:  ap-southeast-2 (Sydney)                                │
│                                                                  │
│  • 98 hrms_* tables — all tenant-scoped with RLS                 │
│  • Supabase Auth (JWT) — session tokens carry tenant_id claim    │
│  • Supabase Storage — tenant-prefixed buckets                    │
└──────────────────────────────────────────────────────────────────┘
```

### Technology stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React 18, TypeScript) |
| Styling | Tailwind CSS + shadcn/ui |
| ORM | Drizzle ORM 0.45 (type-safe, no runtime reflection) |
| Database | PostgreSQL 15 via Supabase (managed) |
| Auth | Supabase Auth — JWT with custom claims (`tenant_id`, `user_role`) |
| Row-level security | Supabase RLS — 98 tables, all policies tenant-scoped |
| Rate limiting | Upstash Redis — 10 auth requests / 60 s per IP |
| Deployment | Vercel (3 projects: superadmin, yahwehcare, yahwehpc) |
| CI | GitHub Actions — typecheck, lint, build, Playwright E2E |
| Package manager | npm |

---

## 2. Multi-Tenancy Model

Every business table carries a `tenant_id uuid not null` column referencing `hrms_tenants`. Tenant identity is **resolved server-side** from the authenticated user's `hrms_users.tenant_id`; it is never accepted from client input.

### Tenant isolation guarantees

1. **Application layer** — `apiGuard()` resolves the calling user's tenant from the session and scopes every query with `WHERE tenant_id = $1`.
2. **Database layer** — Row Level Security enforces the same constraint at the PostgreSQL engine level. RLS is enabled on all 98 `hrms_*` tables. Policies use `current_setting('request.jwt.claims')::jsonb->>'tenant_id'` to scope every `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
3. **Cross-tenant write prevention** — An attempt to `INSERT` a row with a different `tenant_id` raises `new_row_violates_row_level_security_policy`. An `UPDATE` targeting a different tenant's rows silently affects 0 rows.

---

## 3. Identity & Authentication Model

```
hrms_tenants          hrms_users            hrms_employees
─────────────         ──────────────         ──────────────
id (PK)          1──* id (PK)          1──1 id (PK)
name                  tenant_id (FK)        tenant_id (FK)
slug                  email                 user_id (FK)
tier                  password_hash         employee_number
                      role (enum)           first_name / last_name
                      is_active             department_id
                      totp_secret           position_id
                      totp_enabled          manager_id (self-ref)
                                            annual_salary
                                            compliance_status
                                            ndis_worker
```

- Login produces a JWT stored as an HTTP-only session cookie.
- Middleware (`src/middleware.ts`) validates the session on every request and short-circuits with 401 for unauthenticated access to `/api/tenant/*` and protected pages.
- The `user_role` JWT claim is read by both the application permission check (`apiGuard`) and PostgreSQL RLS policies.

---

## 4. Entity–Relationship Diagram (Core Tables)

```
hrms_tenants
  │ id PK
  │ name, slug, tier, settings JSONB
  │
  ├──◇ hrms_tenant_modules (module_id, is_enabled)
  │
  ├──◇ hrms_users
  │       id PK · tenant_id FK · email · role · password_hash
  │       totp_secret · is_active
  │       │
  │       └──◇ hrms_employees
  │               id PK · tenant_id FK · user_id FK
  │               employee_number · first_name · last_name
  │               employment_type · annual_salary · hourly_rate
  │               compliance_status · ndis_worker
  │               department_id FK · position_id FK
  │               branch_id FK · manager_id FK (self-ref)
  │               │
  │               ├──◇ hrms_emergency_contacts
  │               ├──◇ hrms_leave_requests
  │               │       id · employee_id FK · leave_type_id FK
  │               │       start_date · end_date · status
  │               ├──◇ hrms_payroll_entries (in payroll runs)
  │               └──◇ hrms_audit_logs (actor_id)
  │
  ├──◇ hrms_departments
  │       id · tenant_id FK · name · head_id FK → employees
  │
  ├──◇ hrms_positions
  │       id · tenant_id FK · title · is_active
  │
  ├──◇ hrms_branches
  │       id · tenant_id FK · name · code · address · state
  │
  ├──◇ hrms_leave_types
  │       id · tenant_id FK · name · accrual_rate · max_carry_forward
  │
  ├──◇ hrms_payroll_runs
  │       id · tenant_id FK · name · frequency
  │       period_start · period_end · status · total_gross
  │       │
  │       └──◇ hrms_payroll_entries
  │               employee_id FK · gross_pay · tax_withheld
  │               super_contribution · net_pay
  │
  ├──◇ hrms_approval_requests
  │       id · tenant_id FK · type · entity_id
  │       requested_by FK → users · status · notes
  │       │
  │       └──◇ hrms_approval_steps
  │               approver_id FK → users · action · acted_at
  │
  └──◇ hrms_audit_logs
          id · tenant_id FK · actor_id FK → users
          action · entity · entity_id
          before JSONB · after JSONB · created_at
```

---

## 5. Application Layer Structure

```
src/
├── app/
│   ├── (auth)/               # Login, password reset — public
│   ├── tenant/               # Tenant-scoped UI pages
│   │   ├── layout.tsx        # Sidebar + permission-filtered nav
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── leave/
│   │   ├── payroll-finance/
│   │   ├── compliance/
│   │   ├── organisation/     # Branches, departments, positions
│   │   ├── training/
│   │   └── …
│   ├── api/
│   │   ├── auth/             # Login, logout, password reset
│   │   ├── tenant/           # All tenant-scoped REST handlers
│   │   │   ├── employees/
│   │   │   ├── leave/
│   │   │   ├── payroll-finance/runs/
│   │   │   ├── approvals/
│   │   │   ├── audit-log/
│   │   │   ├── departments/
│   │   │   ├── positions/
│   │   │   ├── branches/
│   │   │   ├── documents/
│   │   │   ├── training/
│   │   │   ├── users/
│   │   │   └── settings/
│   │   └── super-admin/      # Tenant provisioning (super_admin role only)
│   └── super-admin/          # Super-admin UI
│
├── lib/
│   ├── auth/
│   │   ├── permissions.ts    # ROLE_PERMISSIONS matrix + apiGuard()
│   │   └── session.ts        # JWT decode / session helpers
│   ├── db/
│   │   ├── schema.ts         # Drizzle ORM table definitions
│   │   └── index.ts          # Drizzle client (postgres npm driver)
│   └── payroll/
│       └── calculator.ts     # PAYG, super SG 11.5%, Medicare 2%
│
├── middleware.ts             # Auth guard on all /api/tenant/* + tenant pages
└── __tests__/
    ├── …                     # Vitest unit + integration tests
    └── rls/
        └── rls.integration.test.ts
```

### Request lifecycle (every tenant API route)

```
Request
  → middleware.ts          validates session cookie → 401 if missing
  → apiGuard(permission)   resolves user + tenant from session
                           checks ROLE_PERMISSIONS[role].includes(permission)
                           → 403 if denied
  → Zod validation         → 422 with field errors if invalid
  → Drizzle query          WHERE tenant_id = resolvedTenantId (never from client)
  → Response               typed JSON
```

---

## 6. Payroll — Australian Compliance

The payroll calculator (`src/lib/payroll/calculator.ts`) implements:

| Calculation | Rule |
|-------------|------|
| PAYG withholding | ATO Tax Schedule 1 (2024–25 tax year, Scale 2) |
| Medicare levy | 2.0% of gross (no low-income threshold applied for simplicity) |
| Super SG | 11.5% of ordinary time earnings (OTE) |
| Leave accrual loading | 17.5% (annual leave loading on payout) |

Output per employee per run: `gross_pay`, `tax_withheld`, `medicare_levy`, `super_contribution`, `net_pay`. ABA file export is available for bulk bank payment.

---

## 7. Role–Permission Matrix

Permissions follow the pattern `module:action` where action is `read`, `write`, `delete`, or `approve`.

| Permission | director | hr_officer | compliance_mgr | ops_manager | team_leader | payroll_officer | auditor | employee | contractor | it_admin |
|------------|:--------:|:----------:|:--------------:|:-----------:|:-----------:|:---------------:|:-------:|:--------:|:----------:|:--------:|
| employees:read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | own | own | ✅ |
| employees:write | ✅ | ✅ | — | — | — | — | — | — | — | — |
| employees:delete | ✅ | — | — | — | — | — | — | — | — | — |
| payroll:read | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — | — |
| payroll:write | ✅ | ✅ | — | ✅ | — | ✅ | — | — | — | — |
| leave:read | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | own | — | — |
| leave:write | ✅ | ✅ | — | — | — | — | — | ✅ | — | — |
| leave:approve | ✅ | ✅ | — | ✅ | ✅ | — | — | — | — | — |
| compliance:read | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | — |
| compliance:write | ✅ | ✅ | ✅ | — | — | — | — | — | — | — |
| audit_logs:read | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | — |
| timesheets:approve | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | — | — | — |
| ndis_audits:read | ✅ | ✅ | ✅ | — | — | — | ✅ | — | — | — |
| ndis_audits:write | ✅ | ✅ | ✅ | — | — | — | — | — | — | — |
| settings:read | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ |
| settings:write | ✅ | — | — | — | — | — | — | — | — | ✅ |
| analytics:read | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — | — |
| roles:write | ✅ | — | — | — | — | — | — | — | — | — |

> **Source of truth:** `src/lib/auth/permissions.ts` → `ROLE_PERMISSIONS` constant.  
> `own` = route enforces ownership filter; role gets `:read`/`:write` but only for their own record.

---

## 8. Security Controls

| Control | Implementation |
|---------|---------------|
| Authentication | HTTP-only session cookie; JWT signed by Supabase Auth |
| TOTP (2FA) | `hrms_users.totp_secret` + `totp_enabled` — opt-in per user |
| Rate limiting | Upstash Redis — 10 login attempts / 60 s per IP |
| RLS | All 98 `hrms_*` tables — tenant isolation enforced at DB engine |
| Service role key | Server-only; never exposed to browser bundle |
| Secrets | All credentials in environment variables / Vercel secrets |
| Password storage | Supabase Auth bcrypt hash (never stored in `hrms_users` plaintext) |
| File uploads | Supabase Storage with tenant-prefixed paths and Storage RLS policies |
| CORS | Next.js default (same-origin); API routes do not set permissive CORS headers |

---

## 9. Testing Strategy

| Level | Tooling | Coverage |
|-------|---------|----------|
| Unit | Vitest | Business rules: payroll calc (PAYG, super, Medicare), leave accrual, permission checks — 575 tests pass |
| RLS integration | Vitest + `postgres` npm (direct DB) | 9 describe blocks, 14 tests — tenant isolation on 7 key tables; cross-tenant write prevention |
| RLS SQL | Supabase SQL Editor (`database/rls-tests/rls_policies.sql`) | 10 checks with PASS/FAIL output |
| E2E | Playwright (Chromium) | 8 spec files: auth, employees, leave, payroll, RBAC, org structure, compliance, approvals |
| CI | GitHub Actions | Build + typecheck + lint + E2E against staging on every push to `main` / `develop` |

---

## 10. Environment Variables

| Variable | Where used |
|----------|-----------|
| `DATABASE_URL` | Drizzle ORM — direct Postgres connection (server only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client (browser — public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (browser — public anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only — seed scripts, admin operations |
| `JWT_SECRET` | Session signing |
| `UPSTASH_REDIS_REST_URL` | Rate limiter |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiter |
| `NEXT_PUBLIC_TENANT_SLUG` | Per-Vercel-project tenant identifier |
| `E2E_BASE_URL` | Playwright CI — staging URL |
| `E2E_TEST_PASSWORD` | Playwright CI — shared test password |
