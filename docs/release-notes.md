# Yahweh HRMS — Release Notes

---

## v0.2.0 — 2026-10-31

### New features
- **Bulk import validation preview** — Employee CSV import now validates all rows before committing. A two-step modal shows a per-row status table (valid / will-skip) and lists issues. Use `POST /employees/import?dryRun=true` programmatically.
- **Server-side CSV export** — `GET /employees/export` and `GET /leave/export` return full dataset CSVs with server-enforced permission checks, bypassing client pagination limits.
- **Sentry error tracking** — Client, server, and edge errors are captured and tagged with the tenant slug. Session replays are sampled at 10%. Source maps are uploaded automatically on deploy.
- **Architecture documentation** — `docs/architecture.md` covers deployment topology, ERD, role-permission matrix, AU payroll compliance calculations, and security controls.

### Improvements
- Row Level Security enabled and verified on all 98 `hrms_*` tables. Automated RLS test suite added.
- Playwright E2E test suite (8 spec files, 40+ tests across all roles) added to CI.
- Australian payroll compliance: PAYG withholding (ATO Schedule 1), Medicare levy 2%, Super SG 11.5%, leave loading 17.5% and accrual — all confirmed in `/lib/payroll/calculator.ts`.
- Full payroll run lifecycle (draft → process → finalise → ABA export → mark paid) wired end-to-end.
- Organisation module (branches, departments, positions, org chart) added to sidebar.

### Bug fixes
- Fixed `status: 'finalised'` typo in payroll finalise route that prevented status update.
- Removed `resendApiKey` from `hrms_tenants.settings` JSONB (was leaking SMTP credentials in tenant config responses).

---

## v0.1.0 — 2026-10-01 (initial release)

### Features
- Multi-tenant SaaS architecture with full tenant isolation.
- 11 roles with permission-based access control (`apiGuard`, `hasPermission`, UI gates).
- Employee management: CRUD, photo upload, emergency contacts, notes.
- Leave management: request, approve/deny, balance tracking, calendar view.
- Payroll: draft → process → finalise → ABA → mark paid lifecycle.
- Compliance tracking: NDIS screening, police checks, Working With Children.
- Documents: upload, categorise, expiry tracking.
- Audit log: all mutations recorded with actor, action, before/after JSONB.
- Approval workflow engine: sequential/parallel steps, delegation.
- Notifications: in-app bell, email queue.
- Self-service portal: leave, payslips, profile, documents, announcements.
- Global ⌘K search across employees, documents, and participants.
- Light/dark theme with system preference detection.
- Responsive layout (mobile → desktop).
- Xero and MYOB integration stubs.
- NDIS modules: participants, incidents, behaviour plans, medication/health, audits.
- Timesheet management: clock-in/out, bulk approval.
- Roster shifts: templates, swap requests, availability.
- Vercel deployment (3 deployments: superadmin, yahwehcare, yahwehpc).
