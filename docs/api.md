# Yahweh HRMS — API Reference

> **Base URL:** All tenant-scoped endpoints are prefixed `/api/tenant/`.  
> **Auth:** Every request requires a valid session cookie (set by `POST /api/auth/login`).  
> **Multi-tenancy:** The active tenant is resolved from the session; never pass `tenant_id` in the body.  
> **Permissions:** Each route enforces a named permission (e.g. `employees:read`). A 403 response means the caller's role does not hold that permission.

---

## Authentication  `/api/auth/`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Authenticate with email + password. Returns session cookie. |
| POST | `/api/auth/logout` | Invalidate the current session. |
| GET  | `/api/auth/me` | Return the current user's profile, role, and tenant info. |
| POST | `/api/auth/forgot-password` | Send a password-reset email. |
| POST | `/api/auth/reset-password` | Consume a reset token and set a new password. |
| POST | `/api/auth/totp/setup` | Generate a TOTP secret for MFA enrolment. |
| POST | `/api/auth/totp/challenge` | Verify a TOTP code during login. |
| POST | `/api/auth/totp/disable` | Disable TOTP for the current user. |
| GET  | `/api/auth/totp/status` | Return MFA enrolment state. |

---

## Employees  `/api/tenant/employees/`

Required permission: `employees:read` (GET) / `employees:write` (mutating).

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/employees` | List employees. Supports `search`, `status`, `type`, `department`, `page`, `limit`. |
| POST   | `/employees` | Create a single employee record. |
| GET    | `/employees/:id` | Get employee detail. |
| PATCH  | `/employees/:id` | Update employee fields. |
| DELETE | `/employees/:id` | Soft-delete employee (`deleted_at` set). |
| PATCH  | `/employees/:id/status` | Activate or deactivate. Body: `{ isActive: bool }`. |
| GET    | `/employees/:id/notes` | List notes for an employee. |
| POST   | `/employees/:id/notes` | Add a note. |
| DELETE | `/employees/:id/notes/:noteId` | Delete a note. |
| GET    | `/employees/:id/emergency-contacts` | List emergency contacts. |
| POST   | `/employees/import` | Bulk import via CSV multipart upload. Returns `{ imported, skipped, errors[] }`. |
| POST   | `/employees/import?dryRun=true` | Validate CSV without inserting. Returns per-row preview. |
| GET    | `/employees/export` | Download full employee list as CSV. Supports same filters as list. |
| GET    | `/employees/headcount-trend` | Monthly headcount change over the last 12 months. |
| GET    | `/employees/compliance-score` | Aggregate compliance score across the tenant. |
| GET    | `/employees/probation-alerts` | Employees whose probation ends in the next 30 days. |
| GET    | `/employees/screening-count` | Count of employees by screening status. |
| GET    | `/employees/screening-expiry` | Employees with screenings expiring in the next 60 days. |

---

## Leave  `/api/tenant/leave/`

Required permission: `leave:read` / `leave:write`. Employees see only their own records.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/leave` | List leave requests. Params: `status`, `leaveType`, `from`, `to`, `employeeId`. |
| POST   | `/leave` | Submit a leave request. |
| PATCH  | `/leave/:id` | Approve, deny, or cancel. Body: `{ action: 'approve'|'deny'|'cancel', comment? }`. |
| GET    | `/leave/balance` | Current user's leave balance. |
| GET    | `/leave/balances` | All employee balances (HR+ only). |
| GET    | `/leave/calendar` | Leave events for a date range. Params: `from`, `to`. |
| GET    | `/leave/types` | List configured leave types. |
| GET    | `/leave/export` | Download leave requests as CSV. Supports same filters as list. |

---

## Payroll  `/api/tenant/payroll-finance/`

Required permission: `payroll:read` / `payroll:write`.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/payroll-finance/runs` | List payroll runs for the tenant. |
| POST   | `/payroll-finance/runs` | Create a new payroll run (status: `draft`). |
| GET    | `/payroll-finance/runs/:id` | Get run detail with all entries. |
| POST   | `/payroll-finance/runs/:id/process` | Calculate gross/net pay for all employees in the run. |
| POST   | `/payroll-finance/runs/:id/finalise` | Lock the run and publish payslips. |
| GET    | `/payroll-finance/runs/:id/payslips` | List payslips for a run. |
| GET    | `/payroll-finance/runs/:id/export-aba` | Download ABA bank file for this run. |
| GET    | `/payroll-finance/runs/:id/entries` | List individual pay entries. |

**AU compliance notes:**  
- PAYG withholding follows ATO Schedule 1 (weekly equivalent method).  
- Super guarantee is calculated at 11.5% of OTE (2024–25 rate).  
- Medicare levy is 2.0% of taxable income.  
- Salary sacrifice reduces pre-tax income before PAYG and Medicare are applied.

---

## Compliance & Screening  `/api/tenant/compliance/`

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/compliance/tracking` | Compliance items per employee with status breakdown. |
| GET    | `/compliance/screening` | NDIS + police check screening status. |
| POST   | `/compliance/lock` | Lock compliance period. |

---

## Approvals  `/api/tenant/approvals`

Required permission: resolved per workflow type.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/approvals` | List approval requests. Params: `status`, `type`. |
| POST   | `/approvals` | Create an approval request. Body: `{ type, entityId, entityType, steps[] }`. |
| PATCH  | `/approvals/:id` | Advance, approve, or reject a step. Body: `{ action, comment? }`. |

---

## Timesheets  `/api/tenant/timesheets/`

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/timesheets` | List timesheets. Supports `status`, `employeeId`, `from`, `to`. |
| POST   | `/timesheets/clock-in` | Record clock-in for the current user. |
| POST   | `/timesheets/clock-out` | Record clock-out. |
| PATCH  | `/timesheets/bulk-approve` | Approve multiple timesheets. Body: `{ ids: string[] }`. |

---

## Documents  `/api/tenant/documents`

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/documents` | List documents. Params: `employeeId`, `category`, `status`. |
| POST   | `/documents` | Upload a document (multipart). |
| GET    | `/documents/expiry-count` | Count of documents expiring in the next 30/60/90 days. |

---

## Organisation  `/api/tenant/`

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/branches` | List or create branches. |
| PATCH/DELETE | `/branches/:id` | Update or delete a branch. |
| GET/POST | `/departments` | List or create departments. |
| PATCH/DELETE | `/departments/:id` | Update or delete a department. |
| GET/POST | `/positions` | List or create positions. |
| PATCH/DELETE | `/positions/:id` | Update or delete a position. |
| GET | `/org-chart` | Return the full reporting hierarchy as a tree. |

---

## Participants (NDIS)  `/api/tenant/participants/`

Required permission: `participant_mgmt:read`.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/participants` | List NDIS participants. |
| POST   | `/participants` | Create a participant. |
| GET/PATCH | `/participants/:id` | Get or update a participant. |
| GET/POST | `/participants/:id/support-plans` | List or create support plans. |
| GET/POST | `/participants/:id/goals` | List or create goals. |
| GET/POST | `/participants/:id/notes` | List or create notes. |
| GET/POST | `/participants/:id/contacts` | List or create contacts. |

---

## Settings  `/api/tenant/settings`

Required permission: `settings:read` / `settings:write`.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/settings` | Return all per-tenant configuration. |
| PATCH  | `/settings` | Update configuration fields. |
| GET    | `/config` | Return public branding and feature flags (no auth required for login page use). |

---

## Search  `/api/tenant/search`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search?q=<term>` | Full-text search across employees, documents, and participants. Min 2 chars. Returns up to 5 results per entity type. Role-restricted: `employee`/`contractor` roles cannot search other employees. |

---

## Audit Logs  `/api/tenant/audit-log`

Required permission: `audit_logs:read`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit-log` | List audit events. Params: `actor`, `entity`, `action`, `from`, `to`, `page`, `limit`. |
| GET | `/audit-logs` | Alias for `/audit-log`. |

---

## Super Admin  `/api/super-admin/`

All endpoints require `super_admin` role.

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/super-admin/clients` | List all tenants. |
| POST   | `/super-admin/clients` | Onboard a new tenant. |
| GET/PATCH | `/super-admin/clients/:id` | Get or update a tenant. |
| POST   | `/super-admin/clients/:id/modules` | Enable or disable feature modules. |
| POST   | `/super-admin/impersonate` | Start an impersonation session for a tenant user. |
| GET    | `/super-admin/stats` | Platform-wide usage statistics. |
| GET    | `/super-admin/health` | System health check (DB connectivity, queue depth). |

---

## Common response shapes

### Error
```json
{ "error": "Human-readable message", "detail": "Optional technical detail" }
```

### Paginated list
```json
{ "data": [...], "total": 120, "page": 1, "limit": 25 }
```

### Import result
```json
{ "ok": true, "dryRun": false, "imported": 47, "skipped": 3, "errors": ["Row 5: ..."], "total": 50, "preview": [...] }
```
