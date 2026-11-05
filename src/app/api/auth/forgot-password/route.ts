import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, tenants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { sendEmail } from '@/lib/email/resend'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 *
 * Generates a 1-hour password reset token and sends it by email.
 * Always returns 200 regardless of whether the email exists (prevents user enumeration).
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ ok: true }) // silent
    }

    const normalised = email.toLowerCase().trim()

    // Find user across all tenants (email + tenant scoped via uniqueIndex)
    // We search without tenant scope here since user only knows their email
    const [user] = await db
      .select({
        id:       users.id,
        tenantId: users.tenantId,
        email:    users.email,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.email, normalised))
      .limit(1)

    // Always respond ok to prevent user enumeration
    if (!user || !user.isActive) return NextResponse.json({ ok: true })

    // Generate secure token (32 bytes = 64 hex chars)
    const token   = randomBytes(32).toString('hex')
    const expiry  = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db
      .update(users)
      .set({ passwordResetToken: token, passwordResetExpiry: expiry, updatedAt: new Date() })
      .where(eq(users.id, user.id))

    // Fetch org name for email branding
    const [tenant] = await db
      .select({ name: tenants.name, primaryColor: tenants.primaryColor, logoUrl: tenants.logoUrl })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))

    const appUrl   = process.env.APP_URL ?? req.nextUrl.origin
    const resetUrl = `${appUrl}/reset-password?token=${token}`
    const orgName  = tenant?.name ?? 'HRMS'
    const color    = tenant?.primaryColor ?? '#0E3D52'

    const html = `
<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="background:${color};padding:22px 32px;text-align:center;">
    ${tenant?.logoUrl
      ? `<img src="${tenant.logoUrl}" alt="${orgName}" style="max-height:48px;object-fit:contain;"/>`
      : `<span style="color:#fff;font-size:20px;font-weight:700;">${orgName}</span>`}
  </div>
  <div style="padding:28px 32px;">
    <h2 style="color:#111827;font-size:18px;font-weight:700;margin:0 0 12px;">Reset your password</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 16px;">
      We received a request to reset your password. Click the button below to choose a new one.
      This link expires in <strong>1 hour</strong>.
    </p>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
      <p style="color:#78350f;font-size:13px;margin:0;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
    </div>
    <a href="${resetUrl}" style="display:inline-block;background:${color};color:#fff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
      Reset password →
    </a>
    <p style="color:#9ca3af;font-size:12px;margin-top:20px;word-break:break-all;">
      Or copy this link: ${resetUrl}
    </p>
  </div>
  <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">This email was sent by <strong>${orgName}</strong> via HRMS.</p>
  </div>
</div>`

    await sendEmail({
      to:      normalised,
      subject: `Reset your ${orgName} password — link expires in 1 hour`,
      html,
      text:    `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('forgot-password:', err)
    return NextResponse.json({ ok: true }) // never expose errors
  }
}
