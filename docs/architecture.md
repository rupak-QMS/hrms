# Yahweh HRMS — Architecture Documentation

**Version:** 1.0  
**Updated:** 2026-10-29  
**Maintained by:** Development Team

---

## 1. System Overview

Yahweh HRMS is a **multi-tenant SaaS** Human Resource Management System built for Australian NDIS care providers. It supports multiple organisations (tenants) on a single deployment, with complete data isolation between tenants enforced at both the application layer and the database layer via PostgreSQL Row Level Security.

### Primary tenants (production)
| Slug | Organisation |
|---|---|
| `yahwehcare` | Yahweh Care Pty Ltd |
| `yahwehpc` | Yahweh Property Care Pty Ltd |

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | ^15.3.4 |
| Language | TypeScript | ^5.7.3 |
| UI | Tailwind CSS | ^3.4.17 |
| Database | PostgreSQL (Supabase) | 15 |
| ORM | Drizzle ORM | ^0.45.2 |
| Auth | Custom JWT (jose) + Supabase Auth | jose ^5.10.0 |
| File storage | Supabase Storage / Vercel Blob | — |
| Deployment | Vercel (per-tenant subdomains) | — |
| E2E tests | Playwright | 1.64.1 |
| Unit tests | Vitest | ^2.0.0 |

### Supabase project
- **Project ref:** `ukmosenqkuczgbirmrgn`
- **Region:** ap-southeast-2 (Sydney)
- **SQL Editor:** `https://supabase.com/dashboard/project/ukmosenqkuczgbirmrgn/sql/new`

---

## 3. Repository Structure

```
YahwehHrms/
├── src/
│   ├── app/
│   │   ├── (auth)/              # Login, forgot-password, 2FA pages
│   │   ├── (app)/               # Authenticated app shell
│   │   │   └── [module]/        # One folder per HRMS module
│   │   └── api/
│   │       ├── auth/            # Login, logout, refresh, 2FA endpoints
│   │       └── tenant/          # All tenant-scoped API routes
│   │           ├── employees/
│   │           ├── payroll-finance/
│   │           ├── leave/
│   │           ├── audit-log/
│   │           ├── departments/
│   │           ├── positions/
│   │           ├── branches/
│   │           └── ... (40+ modules)
│   ├── lib/
│   │   ├── auth/                # JWT helpers, session, apiGuard()
│   │   ├── db/
│   │   │   └── schema.ts        # Drizzle schema (single source of truth)
│   │   └── payroll/
│   │       └── calculator.ts    # AU payroll calculation engine
│   └── components/              # Shared React components
├── database/
│   └── migrations/              # 0001–0059 ordered SQL migrations
├── e2e/                         # Playwright test suite
│   ├── setup/auth.setup.ts
│   ├── helpers/login.ts
│   ├── auth.spec.ts
│   ├── rbac.spec.ts
│   ├── employees.spec.ts
│   ├── leave.spec.ts
│   ├── payroll.spec.ts
│   └── org-structure.spec.ts
└── middleware.ts                # Tenant resolution + auth gate
```

---

## 4. Multi-Tenancy

### Tenant resolution
Every authenticated request carries a JWT containing `tenant_id` and `user_id`. The middleware (`middleware.ts`) validates the token, resolves the tenant from the subdomain or the JWT claim, and injects `X-Tenant-Id` and `X-User-Id` headers for downstream handlers.

Tenants **cannot** be supplied by the client — the server always reads `tenant_id` from the verified JWT. Client-supplied `tenantId` fields are rejected.

### Data isolation — three layers
1. **Application layer:** Every Drizzle query includes `eq(table.tenantId, session.tenantId)` in its WHERE clause.
2. **Row Level Security:** RLS is enabled on every table. Policies call the `current_tenant_id()` SECURITY DEFINER function which reads the tenant from the Supabase JWT claim.
3. **API guard:** `apiGuard(permission)` in every route handler verifies the session and permission before any DB access.

---

## 5. Authentication & Authorisation

### Auth flow
```
POST /api/auth/login
  → bcrypt verify password
  → check 2FA (TOTP if enabled)
  → issue access token (15 min) + refresh token (7 days, httpOnly cookie)
  → return { accessToken, user }

POST /api/auth/refresh
  → verify refresh token from httpOnly cookie
  → issue new access token

POST /api/auth/logout
  → invalidate refresh token in DB
  → clear cookie
```

### apiGuard helper
```typescript
// Every route handler starts with:
const { session, error } = await apiGuard(request, 'leave:write')
if (error) return error  // 401 or 403 Response
// session.userId, session.tenantId, session.role are safe to use
```

### Roles (11 roles)
`super_admin` · `director` · `hr_officer` · `compliance_manager` · `operations_manager` · `team_leader` · `payroll_officer` · `employee` · `contractor` · `auditor` · `it_admin`

---

## 6. Database Schema (Entity Map)

All tables are prefixed `hrms_`. Every business table carries `tenant_id uuid NOT NULL` and a composite unique/foreign key that anchors records to their tenant.

### Core identity
| Table | Purpose |
|---|---|
| `hrms_tenants` | Organisation records; `settings` JSONB for per-tenant config |
| `hrms_tenant_modules` | Feature flag toggles per tenant |
| `hrms_users` | Auth identity; `role`, `is_active`, `totp_secret`, `password_hash` |
| `hrms_employees` | HR profile linked 1:1 to a user; employment details |
| `hrms_emergency_contacts` | Emergency contacts per employee |

### Org structure
| Table | Purpose |
|---|---|
| `hrms_branches` | Physical work locations / sites |
| `hrms_departments` | Org chart departments with parent hierarchy |
| `hrms_positions` | Job positions; NDIS flags (`is_participant_facing`, `is_risk_assessed`, `is_whs_sensitive`, `is_key_personnel`) |

### Compliance & workforce
| Table | Purpose |
|---|---|
| `hrms_documents` | Employee document register |
| `hrms_screening_records` | Police checks, NDIS worker checks, WWC |
| `hrms_compliance_tracking` | Per-employee compliance item status |
| `hrms_compliance_lock_exceptions` | Audit-trail exceptions to compliance locks |
| `hrms_onboarding_records` | Onboarding checklist progress |
| `hrms_courses` | Training course library |
| `hrms_training_records` | Completed training per employee |
| `hrms_competencies` | Competency framework |
| `hrms_competency_assessments` | Per-employee competency ratings |
| `hrms_supervision_records` | Clinical/line supervision sessions |

### Recruitment & lifecycle
| Table | Purpose |
|---|---|
| `hrms_job_requisitions` | Open positions |
| `hrms_candidates` | Applicant pool |
| `hrms_applications` | Applications linking candidates → requisitions |
| `hrms_contracts` | Employment contracts |
| `hrms_offer_letter_templates` | Letter templates |
| `hrms_offer_letters` | Generated offer letters |
| `hrms_offer_letter_events` | Offer lifecycle events |
| `hrms_separation_records` | Resignation/termination records |
| `hrms_separation_events` | Separation milestones |
| `hrms_promotion_requests` | Promotion requests |
| `hrms_promotion_events` | Promotion history |

### Performance & engagement
| Table | Purpose |
|---|---|
| `hrms_performance_reviews` | Review cycles (probation, KPI, PIP, annual) |
| `hrms_performance_goals` | Goals/OKRs per review |
| `hrms_salary_reviews` | Salary review records |
| `hrms_surveys` / `hrms_survey_responses` | Engagement surveys |
| `hrms_recognitions` | Peer/manager recognition |
| `hrms_referrals` | Employee referral tracking |
| `hrms_employee_experience` | Experience log entries |

### Leave & time
| Table | Purpose |
|---|---|
| `hrms_leave_requests` | Leave applications with approval chain |
| `hrms_leave_balances` | Current balance per type per employee |
| `hrms_public_holidays` | Public holiday calendar per state |
| `hrms_roster_shifts` | Rostered shifts |
| `hrms_toil_balances` / `hrms_toil_entries` | TOIL accrual and usage |

### Payroll & finance
| Table | Purpose |
|---|---|
| `hrms_payroll_runs` | Pay run header (draft → processing → finalised) |
| `hrms_payroll_run_entries` | Per-employee pay calculation in a run |
| `hrms_payroll_records` | Finalised payroll history (immutable) |
| `hrms_expense_claims` | Expense reimbursements |
| `hrms_super_funds` | Employee super fund details |
| `hrms_super_contributions` | Super contribution records |

### Workplace & safety
| Table | Purpose |
|---|---|
| `hrms_whs_incidents` | WHS incident reports |
| `hrms_grievances` | Workplace grievance cases |
| `hrms_assets` / `hrms_asset_assignments` | Asset register and assignments |

### NDIS-specific
| Table | Purpose |
|---|---|
| `hrms_participants` | NDIS participants |
| `hrms_participant_goals` | NDIS participant goal plans |
| `hrms_ndis_audits` | NDIS quality audit records |
| `hrms_ndis_audit_actions` | Actions arising from audits |
| `hrms_ndis_incidents` | NDIS incident notifications |
| `hrms_ndis_incident_actions` | Incident follow-up actions |

### ESS & platform
| Table | Purpose |
|---|---|
| `hrms_ess_announcements` | Employee Self-Service announcements |
| `hrms_ess_quick_links` | Configurable ESS quick links |
| `hrms_ess_onboarding` | New-hire ESS onboarding tasks |
| `hrms_platform_announcements` | Super-admin broadcast messages |
| `hrms_saved_reports` | Saved report configurations |

### Audit & CRM
| Table | Purpose |
|---|---|
| `hrms_audit_logs` | Immutable audit trail (written by DB triggers + API) |
| `hrms_crm_leads` / `hrms_crm_contacts` | CRM lead management |
| `hrms_crm_accounts` / `hrms_crm_deals` | CRM account and opportunity pipeline |
| `hrms_crm_activities` | CRM activity log |

---

## 7. Audit Trail

The audit system operates at two levels:

### Database triggers (migration `0058_audit_triggers.sql`)
A PL/pgSQL function `hrms_write_audit_log()` is attached via `AFTER INSERT OR UPDATE OR DELETE` triggers on all sensitive tables. It:
- Reads `tenant_id` and `user_id` from the Supabase JWT (`request.jwt.claims`)
- Strips sensitive fields (`password_hash`, `totp_secret`, `refresh_token`) from logged values
- Uses `EXCEPTION WHEN OTHERS → RAISE WARNING` so trigger failures **never** block the originating transaction

**Tables with triggers:** `hrms_users`, `hrms_employees`, `hrms_tenants`, `hrms_payroll_runs`, `hrms_payroll_records`, `hrms_leave_requests`, `hrms_role_permissions`, `hrms_documents`, `hrms_expense_claims`, `hrms_compliance_records`, `hrms_performance_reviews`

### API audit writes
`POST /api/tenant/audit-log` is called from business-critical write paths for application-level events (e.g. login, role change) that supplements the DB triggers.

---

## 8. Payroll Engine

**File:** `src/lib/payroll/calculator.ts`

Implements Australian payroll compliance for the 2025–26 financial year:

| Component | Rule |
|---|---|
| Superannuation | 11.5% of gross (SGC rate) |
| PAYG withholding | 2024–25 weekly tax tables (scaled to pay frequency) |
| Medicare levy | 2% of taxable income |
| LITO | Low Income Tax Offset applied to withholding |
| Employment types | `full_time`, `part_time`, `casual`, `contract` |

**Pay run lifecycle:**
```
draft → [process] → processing → [finalise] → finalised
                ↓ (on error)
              draft (reset)
```

**ABA export** (`GET /api/tenant/payroll-finance/runs/[runId]/export-aba`): generates a NAB-compatible ABA direct entry file (120-char fixed-width, type-0/1/7 records) using BSB and account number from `hrms_tenants.settings.banking`.

---

## 9. API Route Conventions

All tenant-scoped routes live under `/api/tenant/[resource]`.

### Standard pattern
```typescript
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { session, error } = await apiGuard(request, 'resource:read')
  if (error) return error

  const result = await db.select(...)
    .from(table)
    .where(eq(table.tenantId, session.tenantId))

  return NextResponse.json({ data: result })
}
```

### Next.js 15 dynamic params
```typescript
// Route: /api/tenant/employees/[employeeId]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  const { employeeId } = await params
  // ...
}
```

### Error responses
| Status | Meaning |
|---|---|
| 400 | Validation error (Zod) |
| 401 | No valid session |
| 403 | Insufficient permission |
| 404 | Resource not found or wrong tenant |
| 409 | Unique constraint violation |
| 500 | Unexpected server error |

---

## 10. Role–Permission Matrix

> UI enforcement: sidebar visibility and action buttons  
> API enforcement: `apiGuard(permission)` on every handler  
> DB enforcement: RLS policies

| Permission | super_admin | director | hr_officer | compliance_manager | operations_manager | team_leader | payroll_officer | employee | contractor | auditor | it_admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `employees:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (team) | — | — | — | ✅ | ✅ |
| `employees:write` | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — | — | ✅ |
| `payroll:read` | ✅ | ✅ | — | — | — | — | ✅ | — | — | ✅ | — |
| `payroll:write` | ✅ | ✅ | — | — | — | — | ✅ | — | — | — | — |
| `leave:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (team) | — | ✅ (own) | ✅ (own) | ✅ | — |
| `leave:write` | ✅ | ✅ | ✅ | — | ✅ | ✅ (team) | — | ✅ (own) | ✅ (own) | — | — |
| `leave:approve` | ✅ | ✅ | ✅ | — | ✅ | ✅ (team) | — | — | — | — | — |
| `compliance:read` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| `compliance:write` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — |
| `training:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `training:write` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — |
| `documents:read` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | ✅ (own) | ✅ (own) | ✅ | ✅ |
| `documents:write` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ |
| `audit:read` | ✅ | ✅ | — | — | — | — | — | — | — | ✅ | ✅ |
| `audit:write` | ✅ | — | — | — | — | — | — | — | — | — | — |
| `departments:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | ✅ | ✅ |
| `departments:write` | ✅ | ✅ | ✅ | — | ✅ | — | — | — | — | — | — |
| `users:read` | ✅ | ✅ | ✅ | — | — | — | — | — | — | ✅ | ✅ |
| `users:write` | ✅ | ✅ | ✅ | — | — | — | — | — | — | — | ✅ |
| `ndis:read` | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | ✅ | — |
| `ndis:write` | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — |
| `performance:read` | ✅ | ✅ | ✅ | — | ✅ | ✅ (team) | — | ✅ (own) | — | ✅ | — |
| `performance:write` | ✅ | ✅ | ✅ | — | ✅ | ✅ (team) | — | — | — | — | — |
| `super_admin` scope | ✅ | — | — | — | — | — | — | — | — | — | — |

---

## 11. E2E Test Suite

**Location:** `e2e/`  
**Runner:** `npm run test:e2e`  
**Config:** `playwright.config.ts`

| Spec | Coverage |
|---|---|
| `auth.spec.ts` | Login, wrong-password, unauth redirect, API 401, logout |
| `rbac.spec.ts` | Nav visibility, API enforcement (4 roles), tenant isolation |
| `employees.spec.ts` | List pagination, search, filter, org chart API |
| `leave.spec.ts` | Submit, team-leader list, 403 on approve (employee) |
| `payroll.spec.ts` | Run lifecycle, super rate (11.5%), ABA export guard |
| `org-structure.spec.ts` | Dept/position/branch CRUD + tree integrity |

Workers are set to `1` (serialised) to respect the auth rate limit of 10 logins per 60 seconds.

---

## 12. Deployment

### Environments
| Environment | URL pattern | Branch |
|---|---|---|
| Production | `https://[tenant]-hrmsapp.vercel.app` | `main` |
| Preview | Auto-generated per PR | feature branches |

### Environment variables (`.env.local`)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (pooled) |
| `DIRECT_URL` | Direct Postgres URL for migrations |
| `JWT_SECRET` | HS256 signing key for access tokens |
| `JWT_REFRESH_SECRET` | HS256 signing key for refresh tokens |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server-only, never expose) |
| `RESEND_API_KEY` | Email via Resend (per-tenant override in DB) |

### Running migrations
Migrations must be applied **in order** via the Supabase SQL Editor:
```
0056_rls_policies.sql → 0057_complete_hrms_renames.sql
→ 0058_audit_triggers.sql → 0059_branches.sql
```

---

## 13. Known Issues & Roadmap

| # | Gap | Status |
|---|---|---|
| 1 | RLS enforcement on all tables | ✅ Done (migration 0056) |
| 2 | Audit trail (triggers + API) | ✅ Done (migration 0058) |
| 3 | Payroll: process + finalise + ABA export | ✅ Done |
| 4 | Documents / Training routes with apiGuard | ✅ Done |
| 5 | Departments / Positions / Branches CRUD | ✅ Done (migration 0059) |
| 6 | Org chart API (tree + headcount) | ✅ Done |
| 7 | Leave workflow API (submit / approve / balance) | ✅ Done |
| 8 | Playwright E2E test suite | ✅ Done |
| 9 | Architecture documentation (this file) | ✅ Done |
| 10 | SMTP key cleanup (remove hardcoded Resend key from tenant settings) | ⚠️ Manual: Supabase Table Editor → `hrms_tenants` → clear `settings.smtp.resendApiKey` |
