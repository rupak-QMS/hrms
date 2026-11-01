/**
 * emailHelper.ts — centralised tenant email context and send helper.
 *
 * Every email send in the system should:
 *  1. Call getTenantEmailCtx(tenantId) to get org name, logo, colors, from address, and notification flags
 *  2. Check ctx.notify.<eventKey> before sending (respects tenant toggle settings)
 *  3. Call fireEmail(ctx, { to, ...template }) — fire-and-forget
 */

import { db } from '@/lib/db'
import { tenants, users, emailQueue } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { sendEmail } from './resend'
import type { EmailPayload } from './resend'

// ─── Types ───────────────────────────────────────────────────────────────────

export type TenantEmailCtx = {
  orgName:      string
  logoUrl:      string | null
  primaryColor: string
  fromName:     string
  fromAddress:  string | null   // null → use RESEND_FROM env default
  loginUrl:     string
  notify: {
    emailWelcome:       boolean
    emailPayroll:       boolean
    emailCompliance:    boolean
    emailOnboarding:    boolean
    emailPerformance:   boolean
    emailContracts:     boolean
    emailTraining:      boolean
    emailGrievance:     boolean
    emailSeparation:    boolean
    emailWhs:           boolean
    emailRecruitment:   boolean
    emailRecognition:   boolean
    emailRoleChange:    boolean
    emailDocExpiry:     boolean
  }
}

// ─── Context fetcher ─────────────────────────────────────────────────────────

export async function getTenantEmailCtx(tenantId: string): Promise<TenantEmailCtx> {
  const [tenant] = await db
    .select({
      name:         tenants.name,
      logoUrl:      tenants.logoUrl,
      primaryColor: tenants.primaryColor,
      settings:     tenants.settings,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))

  const s      = (tenant?.settings    ?? {}) as Record<string, any>
  const email  = (s.email             ?? {}) as Record<string, string>
  const notif  = (s.notifications     ?? {}) as Record<string, boolean>
  const loginUrl = process.env.APP_URL ?? `https://${process.env.VERCEL_URL ?? 'hrms.app'}`

  // Build from address — "Yahweh Care HR <hr@yahwehcare.com.au>" or null (use Resend default)
  const fromAddress = email.fromEmail
    ? `${email.fromName ?? tenant?.name ?? 'HRMS'} <${email.fromEmail}>`
    : null

  const flag = (key: string, def = true) => notif[key] ?? def

  return {
    orgName:      tenant?.name       ?? 'Your Organisation',
    logoUrl:      tenant?.logoUrl    ?? null,
    primaryColor: tenant?.primaryColor ?? '#1a4fff',
    fromName:     email.fromName     ?? tenant?.name ?? 'HRMS',
    fromAddress,
    loginUrl,
    notify: {
      emailWelcome:       flag('emailWelcome'),
      emailPayroll:       flag('emailPayroll'),
      emailCompliance:    flag('emailCompliance'),
      emailOnboarding:    flag('emailOnboarding'),
      emailPerformance:   flag('emailPerformance'),
      emailContracts:     flag('emailContracts'),
      emailTraining:      flag('emailTraining'),
      emailGrievance:     flag('emailGrievance'),
      emailSeparation:    flag('emailSeparation'),
      emailWhs:           flag('emailWhs'),
      emailRecruitment:   flag('emailRecruitment'),
      emailRecognition:   flag('emailRecognition'),
      emailRoleChange:    flag('emailRoleChange'),
      emailDocExpiry:     flag('emailDocExpiry'),
    },
  }
}

// ─── Role-based recipient helper ─────────────────────────────────────────────

export async function getTenantRoleEmails(tenantId: string, roles: string[]): Promise<string[]> {
  const rows = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.isActive, true)))
  return rows.filter(r => roles.includes(r.role)).map(r => r.email)
}

// ─── Fire-and-forget send ─────────────────────────────────────────────────────

/**
 * Queues an email in hrms_email_queue for durable delivery, then fires immediately.
 * The queue record tracks delivery status and supports retry.
 * Never throws, never blocks the API response.
 */
export function fireEmail(
  ctx: TenantEmailCtx,
  payload: Omit<EmailPayload, 'from'> & { from?: string; tenantId?: string },
): void {
  const from = payload.from ?? ctx.fromAddress ?? undefined
  const tenantId = payload.tenantId ?? null

  // Persist to queue first, then send
  ;(async () => {
    let queueId: string | undefined
    try {
      const [row] = await db
        .insert(emailQueue)
        .values({
          tenantId:  tenantId as any,
          to:        Array.isArray(payload.to) ? payload.to.join(',') : payload.to,
          from:      from ?? null,
          subject:   payload.subject,
          html:      payload.html,
          status:    'pending',
          attempts:  0,
        })
        .returning({ id: emailQueue.id })
      queueId = row?.id
    } catch (err) {
      console.error('[email queue insert]', err)
    }

    try {
      await sendEmail({ ...payload, from })
      if (queueId) {
        await db
          .update(emailQueue)
          .set({ status: 'sent', sentAt: new Date(), attempts: 1 })
          .where(eq(emailQueue.id, queueId!))
      }
    } catch (err) {
      console.error('[email]', err)
      if (queueId) {
        await db
          .update(emailQueue)
          .set({ status: 'failed', lastError: String(err), attempts: 1 })
          .where(eq(emailQueue.id, queueId!))
          .catch(() => {})
      }
    }
  })()
}

// ─── Platform (super-admin) context ──────────────────────────────────────────

export type PlatformEmailCtx = {
  loginUrl: string
}

export function getPlatformEmailCtx(): PlatformEmailCtx {
  return {
    loginUrl: process.env.APP_URL ?? `https://${process.env.VERCEL_URL ?? 'hrms.app'}`,
  }
}
