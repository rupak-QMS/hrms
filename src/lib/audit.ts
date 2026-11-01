/**
 * writeAudit — fire-and-forget audit log helper.
 *
 * Inserts a row into hrms_audit_logs without blocking the caller.
 * Failures are logged to stderr but never propagate.
 *
 * Usage (inside an API route, after a successful write):
 *
 *   writeAudit(req, session, {
 *     action:     'employee.create',
 *     resource:   'employee',
 *     resourceId: newEmployee.id,
 *     newValues:  { firstName, lastName, email },
 *   })
 *
 * oldValues + newValues are stored as JSONB. Strip sensitive fields
 * (passwords, tokens) before passing them in.
 */
import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema'

type AuditSession = { tenantId: string; sub?: string }

type AuditOptions = {
  action:      string          // e.g. 'employee.create'
  resource:    string          // e.g. 'employee'
  resourceId?: string | null   // uuid of the affected row
  oldValues?:  Record<string, unknown> | null
  newValues?:  Record<string, unknown> | null
}

/**
 * Non-blocking: call after every successful write and never await.
 * The function returns a Promise that you can await if you need to
 * guarantee the log row exists before responding, but in most routes
 * fire-and-forget is fine.
 */
export function writeAudit(
  req: NextRequest,
  session: AuditSession,
  opts: AuditOptions,
): Promise<void> {
  const ipAddress =
    req.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers?.get('x-real-ip') ??
    null
  const userAgent = req.headers?.get('user-agent') ?? null

  return db
    .insert(auditLogs)
    .values({
      tenantId:   session.tenantId,
      userId:     session.sub ?? null,
      action:     opts.action,
      resource:   opts.resource,
      resourceId: opts.resourceId ?? null,
      oldValues:  opts.oldValues  ?? null,
      newValues:  opts.newValues  ?? null,
      ipAddress,
      userAgent,
    })
    .then(() => undefined)
    .catch(err => {
      // Never let audit failures surface to the caller
      console.error('[audit]', opts.action, err?.message ?? err)
    })
}
