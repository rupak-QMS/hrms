# Yahweh HRMS — Admin Guide

## 1. Overview

Yahweh HRMS is a multi-tenant SaaS HR management platform built for Australian care and disability service providers. Three user tiers exist:

| Tier | Role | Access |
|------|------|--------|
| Platform | `super_admin` | Manages all tenants; accesses `/super-admin` routes and the Super Admin portal. |
| Tenant admin | `director`, `hr_officer` | Full access within their own tenant. |
| Tenant user | All other roles | Scoped access per the role-permission matrix in `docs/architecture.md`. |

---

## 2. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Supabase connection string (pooled). |
| `SUPABASE_URL` | ✅ | Project REST URL. |
| `SUPABASE_ANON_KEY` | ✅ | Public anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Server only.** Never expose in client. |
| `NEXTAUTH_SECRET` | ✅ | JWT signing secret (32+ chars). |
| `RESEND_API_KEY` | ✅ | Transactional email (Resend.com). |
| `NEXT_PUBLIC_APP_URL` | ✅ | Canonical app URL (e.g. `https://app.yahwehhrms.com.au`). |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚠️ | Sentry project DSN (client-side). |
| `SENTRY_DSN` | ⚠️ | Sentry project DSN (server-side). |
| `SENTRY_ORG` | ⚠️ | Sentry org slug. |
| `SENTRY_PROJECT` | ⚠️ | Sentry project slug. |
| `SENTRY_AUTH_TOKEN` | ⚠️ | Used by CI to upload source maps. |
| `NEXT_PUBLIC_APP_ENV` | optional | `production` / `staging` / `development`. |
| `XERO_CLIENT_ID` | optional | Xero OAuth integration. |
| `XERO_CLIENT_SECRET` | optional | Xero OAuth integration. |
| `MYOB_CLIENT_ID` | optional | MYOB integration. |
| `MYOB_CLIENT_SECRET` | optional | MYOB integration. |

---

## 3. Onboarding a new tenant

1. Log in to the Super Admin portal (`/super-admin`).
2. Go to **Clients → New Client** and fill in:
   - Company name, slug (URL-safe, e.g. `yahwehcare`), plan, logo URL.
3. Enable feature modules: tick the modules this tenant has subscribed to.
4. Create the first `director` user under **Clients → [tenant] → Users → Invite**.
5. The director sets up their own team (HR officers, team leaders, employees).
6. Configure tenant settings under **Settings**:
   - Fiscal year start, default work week, public holidays calendar.
   - Payroll settings: pay frequency, super fund BSB/account for ABA export.
   - Branding: primary colour, logo, border radius.

---

## 4. Module management

Modules are toggled per tenant in `/super-admin/clients/:id/modules`. Each module maps to a sidebar route. Disabled modules are hidden from the sidebar and their API routes return 403.

Core modules (always enabled): Dashboard, Employees, Leave, Payroll, Compliance, Documents, Audit Logs.

---

## 5. CSV employee import

**Template** (download from Employees → Import → "Download sample CSV"):

```
employee_number,first_name,last_name,email,employment_type,start_date
EMP001,Jane,Smith,jane@example.com,full_time,2026-01-15
```

**Steps:**
1. Go to **Employee Management → Import**.
2. Upload CSV → click **Validate & Preview** — see per-row validation results.
3. Review errors (duplicate numbers, invalid fields, bad dates). Fix in CSV if needed.
4. Click **Import N employees** to commit.

**Valid `employment_type` values:** `full_time`, `part_time`, `casual`, `contractor`, `volunteer`.

**Date formats accepted:** `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`.

---

## 6. Payroll run

1. **Payroll → New Run** — select pay period and frequency.
2. Click **Process** — calculates PAYG, super, Medicare levy for all active employees.
3. Review the payslip breakdown. Correct any salary or hours anomalies on employee profiles.
4. Click **Finalise** — locks the run and publishes payslips to employee self-service.
5. Click **Export ABA** — download the bank file for upload to your financial institution.
6. Click **Mark Paid** — records the payment date on the run.

---

## 7. Compliance screening

Employees' NDIS worker screening, police checks, and Working With Children checks are tracked under **Compliance**. Expiry alerts fire 60 days before expiry via email and the in-app notification bell.

---

## 8. Integrations

### Xero
Connect under **Settings → Integrations → Xero**. OAuth 2.0 flow. Once connected, payroll runs can be exported as journal entries.

### MYOB
Same flow under **Settings → Integrations → MYOB**.

### Sentry
Set the four Sentry env vars and redeploy. All server-side errors are tagged with the tenant slug via `x-tenant-slug` header. View errors filtered by tenant in the Sentry dashboard.

---

## 9. Impersonation

Super admins can impersonate any tenant user via **Super Admin → Clients → [tenant] → Users → Impersonate**. An audit log event is written for every impersonation session. The impersonation session expires after 30 minutes or on logout.

---

## 10. Backups and recovery

Supabase provides automated daily backups with point-in-time recovery for Pro/Team plans. No additional configuration is required. Recovery is performed via the Supabase dashboard or support request.

---

## 11. CI/CD pipeline

```
Push → GitHub Actions
  ├─ lint + typecheck
  ├─ unit tests (Vitest)
  ├─ Playwright E2E (staging URL)
  ├─ Deploy to Vercel (preview per PR, production on main)
  └─ Upload source maps to Sentry
```

Environment secrets required in GitHub Actions: `VERCEL_TOKEN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
