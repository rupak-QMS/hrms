/**
 * Email templates — branded HTML emails for all HRMS scenarios.
 *
 * Every template:
 *  - Accepts logoUrl (shown as <img> when present, otherwise org name text)
 *  - Uses primaryColor for the header background
 *  - Has a clear subject line specifying the exact reason for the email
 *  - Returns { subject, html, text }
 *
 * Tenant templates:  accept logoUrl + primaryColor from tenant settings
 * Platform templates: super-admin side; use HRMS platform header
 */

type TemplateResult = { subject: string; html: string; text: string }

// ─── Layout helpers ──────────────────────────────────────────────────────────

function hdr(primaryColor: string, orgName: string, logoUrl: string | null) {
  const inner = logoUrl
    ? `<img src="${logoUrl}" alt="${orgName}" style="max-height:52px;max-width:220px;object-fit:contain;display:block;margin:0 auto;" />`
    : `<span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">${orgName}</span>`
  return `<div style="background:${primaryColor};padding:22px 32px;text-align:center;">${inner}</div>`
}

function platformHdr() {
  return `<div style="background:#111827;padding:22px 32px;text-align:center;"><span style="color:#ffffff;font-size:20px;font-weight:700;">HRMS Platform</span></div>`
}

function ftr(orgName: string) {
  return `<div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;"><p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">This email was sent by <strong>${orgName}</strong> via HRMS.<br>If you did not expect this email, you can safely ignore it.</p></div>`
}

function platformFtr() {
  return `<div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;"><p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">This message was sent from the <strong>HRMS Platform</strong> by Yahweh Care Pty Ltd.</p></div>`
}

const WRAP = (inner: string) =>
  `<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">${inner}</div>`

const BD = (c: string) => `<div style="padding:28px 32px;">${c}</div>`
const H2 = (t: string) => `<h2 style="color:#111827;font-size:18px;font-weight:700;margin:0 0 12px;line-height:1.3;">${t}</h2>`
const P  = (t: string, sm = false) => `<p style="color:#4b5563;font-size:${sm ? '13' : '15'}px;margin:0 0 16px;line-height:1.6;">${t}</p>`
const CTA = (label: string, url: string, color: string) =>
  `<a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:12px 26px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${label} →</a>`

const BOX = (inner: string, bg = '#f3f4f6', border = '#e5e7eb', color = '#374151') =>
  `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:14px 16px;margin-bottom:20px;"><p style="color:${color};font-size:14px;margin:0;line-height:1.6;">${inner}</p></div>`

const fmt = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fd  = (d: string) => { try { return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return d } }

// ─────────────────────────────────────────────────────────────────────────────
// TENANT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/** 1. New user welcome — role invitation */
export function welcomeEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  role: string; loginUrl: string; tempPassword?: string
}): TemplateResult {
  const subject = `Welcome to ${opts.orgName} — Your HR portal account has been created`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2(`Welcome, ${opts.recipientName}! 👋`) +
      P(`Your <strong>${opts.orgName}</strong> HR portal account has been set up with the role <strong>${opts.role}</strong>. You can now log in and access all features available to your role.`) +
      (opts.tempPassword ? BOX(`<strong>Temporary Password</strong><br><span style="font-family:monospace;font-size:16px;letter-spacing:1px;">${opts.tempPassword}</span><br><small style="color:#6b7280;">Change this immediately after first login.</small>`, '#f0fdf4', '#bbf7d0', '#166534') : '') +
      CTA('Sign in to your portal', opts.loginUrl, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Welcome to ${opts.orgName}!\n\nYour account (${opts.role}) is ready.\n${opts.tempPassword ? `Temporary password: ${opts.tempPassword}\nChange this on first login.\n` : ''}\nSign in: ${opts.loginUrl}`
  return { subject, html, text }
}

/** 2. Payslip ready */
export function payslipReadyEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  periodStart: string; periodEnd: string; grossPay: number; netPay: number; superAmount: number; loginUrl: string
}): TemplateResult {
  const subject = `Your payslip is ready for ${fd(opts.periodStart)} – ${fd(opts.periodEnd)} — ${opts.orgName}`
  const rows = [
    ['Net Pay (take-home)', `<strong style="color:#16a34a;font-size:16px;">${fmt(opts.netPay)}</strong>`],
    ['Gross Pay', fmt(opts.grossPay)],
    ['Employer Super (11.5%)', `<span style="color:#0E3D52;">${fmt(opts.superAmount)}</span>`],
  ].map(([l, v]) => `<tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:10px 0;color:#6b7280;font-size:14px;">${l}</td><td style="padding:10px 0;text-align:right;">${v}</td></tr>`).join('')
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Your payslip is ready 💰') +
      P(`Hi ${opts.recipientName}, your pay run for <strong>${fd(opts.periodStart)}</strong> to <strong>${fd(opts.periodEnd)}</strong> has been processed.`) +
      `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${rows}</table>` +
      CTA('View your payslip', `${opts.loginUrl}/tenant/payroll`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Your payslip is ready.\nPeriod: ${opts.periodStart} to ${opts.periodEnd}\nGross: ${fmt(opts.grossPay)} | Net: ${fmt(opts.netPay)} | Super: ${fmt(opts.superAmount)}\nView: ${opts.loginUrl}/tenant/payroll`
  return { subject, html, text }
}

/** 3. Document expiring soon */
export function documentExpiryEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  documentName: string; expiryDate: string; daysLeft: number; loginUrl: string
}): TemplateResult {
  const subject = `Action required: "${opts.documentName}" expires in ${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'} — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Compliance document expiring soon ⚠️') +
      P(`Hi ${opts.recipientName}, your compliance document requires renewal before it expires. Expired documents may affect your ability to perform certain duties.`) +
      BOX(`<strong>${opts.documentName}</strong><br>Expires: <strong>${opts.expiryDate}</strong> — <strong>${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'} remaining</strong>`, '#fefce8', '#fde68a', '#78350f') +
      CTA('Renew compliance document', `${opts.loginUrl}/tenant/compliance`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `"${opts.documentName}" expires in ${opts.daysLeft} day(s) on ${opts.expiryDate}.\nRenew: ${opts.loginUrl}/tenant/compliance`
  return { subject, html, text }
}

/** 4. Document already expired */
export function documentExpiredEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  documentName: string; expiredDate: string; loginUrl: string
}): TemplateResult {
  const subject = `URGENT: "${opts.documentName}" expired on ${opts.expiredDate} — immediate action required — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Compliance document has expired 🚨') +
      P(`Hi ${opts.recipientName}, the following compliance document on your profile has <strong>already expired</strong>. You may be unable to perform certain duties until it is renewed.`) +
      BOX(`<strong>${opts.documentName}</strong><br>Expired: <strong>${opts.expiredDate}</strong>`, '#fef2f2', '#fecaca', '#991b1b') +
      CTA('Renew immediately', `${opts.loginUrl}/tenant/compliance`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `URGENT: "${opts.documentName}" expired on ${opts.expiredDate}.\nRenew immediately: ${opts.loginUrl}/tenant/compliance`
  return { subject, html, text }
}

/** 5. Onboarding welcome — new employee */
export function onboardingWelcomeEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  startDate: string; taskCount: number; loginUrl: string
}): TemplateResult {
  const subject = `Welcome to ${opts.orgName} — Your onboarding checklist is ready`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2(`We're excited to have you, ${opts.recipientName}! 🎉`) +
      P(`Welcome to <strong>${opts.orgName}</strong>. Your start date is <strong>${fd(opts.startDate)}</strong> and your onboarding journey begins now.`) +
      BOX(`You have <strong>${opts.taskCount} onboarding task${opts.taskCount === 1 ? '' : 's'}</strong> waiting. Complete these before your start date to hit the ground running.`, '#eff6ff', '#bfdbfe', '#1e40af') +
      CTA('View your onboarding tasks', `${opts.loginUrl}/tenant/onboarding`, opts.primaryColor) +
      P('Questions before your start date? Contact your HR team directly.', true)
    ) +
    ftr(opts.orgName)
  )
  const text = `Welcome to ${opts.orgName}!\nStart date: ${opts.startDate}\nYou have ${opts.taskCount} onboarding task(s) waiting.\nView: ${opts.loginUrl}/tenant/onboarding`
  return { subject, html, text }
}

/** 6. Performance review scheduled */
export function performanceReviewScheduledEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  reviewType: string; scheduledDate: string; reviewerName?: string; loginUrl: string
}): TemplateResult {
  const subject = `${opts.reviewType} performance review scheduled for ${fd(opts.scheduledDate)} — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Performance review scheduled 📋') +
      P(`Hi ${opts.recipientName}, a <strong>${opts.reviewType}</strong> performance review has been scheduled for you.`) +
      BOX(`<strong>Review Date:</strong> ${fd(opts.scheduledDate)}${opts.reviewerName ? `<br><strong>Reviewer:</strong> ${opts.reviewerName}` : ''}<br><strong>Type:</strong> ${opts.reviewType}`, '#f0fdf4', '#bbf7d0', '#166534') +
      P('Prepare by reflecting on your goals, achievements, and challenges over the review period.') +
      CTA('View review details', `${opts.loginUrl}/tenant/performance`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Performance review scheduled.\nDate: ${opts.scheduledDate}\nType: ${opts.reviewType}${opts.reviewerName ? `\nReviewer: ${opts.reviewerName}` : ''}\nView: ${opts.loginUrl}/tenant/performance`
  return { subject, html, text }
}

/** 7. Performance review completed */
export function performanceReviewCompletedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  reviewType: string; overallRating?: string; loginUrl: string
}): TemplateResult {
  const subject = `Your ${opts.reviewType} performance review results are now available — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Performance review completed ✅') +
      P(`Hi ${opts.recipientName}, your <strong>${opts.reviewType}</strong> performance review has been completed. Your feedback and development plan are now available.`) +
      (opts.overallRating ? BOX(`<strong>Overall Rating:</strong> ${opts.overallRating}`, '#f0fdf4', '#bbf7d0', '#166534') : '') +
      CTA('View your review outcomes', `${opts.loginUrl}/tenant/performance`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Your ${opts.reviewType} performance review is complete.${opts.overallRating ? `\nOverall Rating: ${opts.overallRating}` : ''}\nView: ${opts.loginUrl}/tenant/performance`
  return { subject, html, text }
}

/** 8. Contract sent for signature */
export function contractSentEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  contractType: string; loginUrl: string
}): TemplateResult {
  const subject = `Your ${opts.contractType} contract is ready to sign — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Your employment contract is ready to sign ✍️') +
      P(`Hi ${opts.recipientName}, your <strong>${opts.contractType}</strong> contract has been prepared and is ready for your signature.`) +
      BOX('Please review the contract carefully before signing. Contact HR if you have any questions about the terms.', '#eff6ff', '#bfdbfe', '#1e40af') +
      CTA('Review and sign your contract', `${opts.loginUrl}/tenant/contracts`, opts.primaryColor) +
      P('Your signature is required before your employment can commence.', true)
    ) +
    ftr(opts.orgName)
  )
  const text = `Your ${opts.contractType} contract is ready to sign.\nReview and sign: ${opts.loginUrl}/tenant/contracts`
  return { subject, html, text }
}

/** 9. Contract signed — notification to HR */
export function contractSignedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  employeeName: string; contractType: string; signedAt: string; loginUrl: string
}): TemplateResult {
  const subject = `Contract signed: ${opts.employeeName} signed their ${opts.contractType} — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Employment contract signed ✅') +
      P(`Hi ${opts.recipientName}, <strong>${opts.employeeName}</strong> has signed their <strong>${opts.contractType}</strong> contract.`) +
      BOX(`<strong>Employee:</strong> ${opts.employeeName}<br><strong>Contract Type:</strong> ${opts.contractType}<br><strong>Signed:</strong> ${fd(opts.signedAt)}`, '#f0fdf4', '#bbf7d0', '#166534') +
      CTA('View signed contract', `${opts.loginUrl}/tenant/contracts`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `${opts.employeeName} signed their ${opts.contractType} contract on ${opts.signedAt}.\nView: ${opts.loginUrl}/tenant/contracts`
  return { subject, html, text }
}

/** 10. Training course assigned */
export function trainingAssignedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  courseTitle: string; isMandatory: boolean; dueDate?: string; loginUrl: string
}): TemplateResult {
  const subject = `${opts.isMandatory ? '[Mandatory] ' : ''}New training assigned: "${opts.courseTitle}" — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2(`Training assigned: ${opts.courseTitle} 📚`) +
      P(`Hi ${opts.recipientName}, you have been assigned a ${opts.isMandatory ? '<strong>mandatory</strong>' : 'new'} training course.`) +
      BOX(`<strong>Course:</strong> ${opts.courseTitle}${opts.dueDate ? `<br><strong>Due Date:</strong> ${fd(opts.dueDate)}` : ''}<br><strong>Type:</strong> ${opts.isMandatory ? 'Mandatory ⚠️' : 'Optional'}`, opts.isMandatory ? '#fefce8' : '#eff6ff', opts.isMandatory ? '#fde68a' : '#bfdbfe', opts.isMandatory ? '#78350f' : '#1e40af') +
      CTA('Start training now', `${opts.loginUrl}/tenant/training`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Training assigned: "${opts.courseTitle}"${opts.isMandatory ? ' (MANDATORY)' : ''}${opts.dueDate ? `\nDue: ${opts.dueDate}` : ''}\nStart: ${opts.loginUrl}/tenant/training`
  return { subject, html, text }
}

/** 11. Training completed */
export function trainingCompletedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  courseTitle: string; score?: number; completedAt: string; loginUrl: string
}): TemplateResult {
  const subject = `Training certificate earned: "${opts.courseTitle}" — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2(`Well done, ${opts.recipientName}! 🎓`) +
      P(`You have successfully completed <strong>"${opts.courseTitle}"</strong>. A completion record has been added to your training profile.`) +
      BOX(`<strong>Course:</strong> ${opts.courseTitle}${opts.score != null ? `<br><strong>Score:</strong> ${opts.score}%` : ''}<br><strong>Completed:</strong> ${fd(opts.completedAt)}`, '#f0fdf4', '#bbf7d0', '#166534') +
      CTA('View your training record', `${opts.loginUrl}/tenant/training`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Training completed: "${opts.courseTitle}"${opts.score != null ? ` (${opts.score}%)` : ''}\nCompleted: ${opts.completedAt}\nView: ${opts.loginUrl}/tenant/training`
  return { subject, html, text }
}

/** 12. Training certification expiring */
export function trainingExpiringEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  courseTitle: string; expiryDate: string; daysLeft: number; loginUrl: string
}): TemplateResult {
  const subject = `Training certificate expiring in ${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'}: "${opts.courseTitle}" — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Training certificate expiring soon ⚠️') +
      P(`Hi ${opts.recipientName}, your certificate for <strong>"${opts.courseTitle}"</strong> is due to expire. Please retake this training to maintain your certification.`) +
      BOX(`<strong>Course:</strong> ${opts.courseTitle}<br><strong>Expires:</strong> ${opts.expiryDate} (${opts.daysLeft} day${opts.daysLeft === 1 ? '' : 's'} remaining)`, '#fefce8', '#fde68a', '#78350f') +
      CTA('Retake training', `${opts.loginUrl}/tenant/training`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Training cert expiring in ${opts.daysLeft} day(s): "${opts.courseTitle}"\nExpiry: ${opts.expiryDate}\nRetake: ${opts.loginUrl}/tenant/training`
  return { subject, html, text }
}

/** 13. Grievance submitted — confirmation to lodger */
export function grievanceSubmittedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  referenceId: string; grievanceType: string; isAnonymous: boolean; loginUrl: string
}): TemplateResult {
  const subject = `Your grievance has been received — Reference ${opts.referenceId} — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Grievance received 📩') +
      P(`Hi ${opts.recipientName}, we have received your ${opts.isAnonymous ? 'anonymous ' : ''}grievance. It has been logged and will be reviewed by HR.`) +
      BOX(`<strong>Reference:</strong> ${opts.referenceId}<br><strong>Type:</strong> ${opts.grievanceType}<br><strong>Status:</strong> Under review`, '#eff6ff', '#bfdbfe', '#1e40af') +
      P('Your concern is taken seriously and will be handled confidentially. You will be notified when there is an update or resolution.') +
      (opts.isAnonymous ? '' : CTA('View grievance status', `${opts.loginUrl}/tenant/grievances`, opts.primaryColor))
    ) +
    ftr(opts.orgName)
  )
  const text = `Grievance received.\nReference: ${opts.referenceId}\nType: ${opts.grievanceType}\nStatus: Under review`
  return { subject, html, text }
}

/** 14. Grievance alert — to HR/managers */
export function grievanceAlertEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  referenceId: string; grievanceType: string; riskRating: string; loginUrl: string
}): TemplateResult {
  const isHigh = ['high', 'critical'].includes(opts.riskRating.toLowerCase())
  const subject = `[${opts.riskRating.toUpperCase()} RISK] New grievance lodged: ${opts.grievanceType} — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2(`New grievance — ${opts.riskRating.toUpperCase()} risk 🚨`) +
      P(`Hi ${opts.recipientName}, a new grievance has been lodged and requires your review and assignment.`) +
      BOX(`<strong>Reference:</strong> ${opts.referenceId}<br><strong>Type:</strong> ${opts.grievanceType}<br><strong>Risk Rating:</strong> ${opts.riskRating.toUpperCase()}`, isHigh ? '#fef2f2' : '#fefce8', isHigh ? '#fecaca' : '#fde68a', isHigh ? '#991b1b' : '#78350f') +
      CTA('Review grievance', `${opts.loginUrl}/tenant/grievances`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `NEW GRIEVANCE — ${opts.riskRating.toUpperCase()} RISK\nRef: ${opts.referenceId}\nType: ${opts.grievanceType}\nReview: ${opts.loginUrl}/tenant/grievances`
  return { subject, html, text }
}

/** 15. Grievance resolved */
export function grievanceResolvedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  referenceId: string; outcome: string; loginUrl: string
}): TemplateResult {
  const subject = `Your grievance (ref: ${opts.referenceId}) has been resolved — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Grievance resolved ✅') +
      P(`Hi ${opts.recipientName}, your grievance (reference <strong>${opts.referenceId}</strong>) has been reviewed and resolved.`) +
      BOX(`<strong>Reference:</strong> ${opts.referenceId}<br><strong>Status:</strong> Resolved<br><strong>Outcome:</strong> ${opts.outcome}`, '#f0fdf4', '#bbf7d0', '#166534') +
      P('If you believe this was not adequately addressed, please contact HR directly or lodge a new grievance.') +
      CTA('View outcome details', `${opts.loginUrl}/tenant/grievances`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Your grievance (ref: ${opts.referenceId}) has been resolved.\nOutcome: ${opts.outcome}\nView: ${opts.loginUrl}/tenant/grievances`
  return { subject, html, text }
}

/** 16. Separation/exit initiated */
export function separationInitiatedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  separationType: string; lastWorkingDay: string; loginUrl: string
}): TemplateResult {
  const subject = `Exit process initiated — Last working day: ${fd(opts.lastWorkingDay)} — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Exit process has been initiated') +
      P(`Hi ${opts.recipientName}, your exit process (${opts.separationType}) has been formally initiated. HR will guide you through the remaining steps.`) +
      BOX(`<strong>Separation Type:</strong> ${opts.separationType}<br><strong>Last Working Day:</strong> ${fd(opts.lastWorkingDay)}<br><strong>Status:</strong> Exit checklist in progress`, '#f0fdf4', '#bbf7d0', '#166534') +
      P('Please ensure all company assets are returned, access is handed over, and your exit interview is completed before your last working day.') +
      CTA('View your exit checklist', `${opts.loginUrl}/tenant/separation`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Exit process initiated.\nType: ${opts.separationType}\nLast Working Day: ${opts.lastWorkingDay}\nChecklist: ${opts.loginUrl}/tenant/separation`
  return { subject, html, text }
}

/** 17. WHS incident reported — alert to managers */
export function whsIncidentReportedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  incidentType: string; severity: string; location: string; occurredAt: string
  reportedByName: string; loginUrl: string
}): TemplateResult {
  const isUrgent = ['critical', 'high'].includes(opts.severity.toLowerCase())
  const subject = `${isUrgent ? '[URGENT] ' : ''}WHS Incident reported — ${opts.severity.toUpperCase()} severity — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2(`WHS Incident reported — ${opts.severity.toUpperCase()} severity 🦺`) +
      P(`Hi ${opts.recipientName}, a workplace health and safety incident has been reported and requires your attention.`) +
      BOX(`<strong>Type:</strong> ${opts.incidentType}<br><strong>Severity:</strong> ${opts.severity.toUpperCase()}<br><strong>Location:</strong> ${opts.location}<br><strong>Occurred:</strong> ${fd(opts.occurredAt)}<br><strong>Reported by:</strong> ${opts.reportedByName}`, isUrgent ? '#fef2f2' : '#fefce8', isUrgent ? '#fecaca' : '#fde68a', isUrgent ? '#991b1b' : '#78350f') +
      P('Please review the incident, initiate corrective actions, and ensure all required notifications to WorkSafe are completed within the required timeframe.') +
      CTA('Review WHS incident', `${opts.loginUrl}/tenant/whs`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `WHS INCIDENT — ${opts.severity.toUpperCase()}\nType: ${opts.incidentType}\nLocation: ${opts.location}\nOccurred: ${opts.occurredAt}\nReported by: ${opts.reportedByName}\nReview: ${opts.loginUrl}/tenant/whs`
  return { subject, html, text }
}

/** 18. Recruitment application stage update */
export function recruitmentStageEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  jobTitle: string; stage: string; message?: string; loginUrl: string
}): TemplateResult {
  const labels: Record<string, string> = {
    applied: 'Your application has been received',
    shortlisted: 'You have been shortlisted',
    interview: 'You have been invited to interview',
    offer: 'You have received a job offer',
    rejected: 'Your application was unsuccessful',
  }
  const stageLabel = labels[opts.stage] ?? `Application status: ${opts.stage}`
  const subject = `${stageLabel} — ${opts.jobTitle} at ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2(`${stageLabel} 📋`) +
      P(`Hi ${opts.recipientName}, here is an update on your application for <strong>${opts.jobTitle}</strong> at <strong>${opts.orgName}</strong>.`) +
      BOX(`<strong>Position:</strong> ${opts.jobTitle}<br><strong>Status:</strong> ${opts.stage.charAt(0).toUpperCase() + opts.stage.slice(1)}`, '#eff6ff', '#bfdbfe', '#1e40af') +
      (opts.message ? P(opts.message) : '') +
      (opts.stage !== 'rejected' ? CTA('View your application', `${opts.loginUrl}/tenant/recruitment`, opts.primaryColor) : '') +
      P('Thank you for your interest in joining the team.', true)
    ) +
    ftr(opts.orgName)
  )
  const text = `Application update: ${opts.jobTitle} at ${opts.orgName}\nStatus: ${opts.stage}${opts.message ? `\n${opts.message}` : ''}`
  return { subject, html, text }
}

/** 19. Recognition award */
export function recognitionAwardEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  awardType: string; reason?: string; nominatorName?: string; loginUrl: string
}): TemplateResult {
  const subject = `You've been recognised: ${opts.awardType} award — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2("You've been recognised! 🌟") +
      P(`Congratulations, ${opts.recipientName}! You have received a <strong>${opts.awardType}</strong> recognition from ${opts.orgName}.`) +
      BOX(`<strong>Award:</strong> ${opts.awardType}${opts.nominatorName ? `<br><strong>Nominated by:</strong> ${opts.nominatorName}` : ''}${opts.reason ? `<br><strong>Reason:</strong> ${opts.reason}` : ''}`, '#fdf4ff', '#e9d5ff', '#6b21a8') +
      P('Your hard work and dedication is appreciated. Keep up the great work!') +
      CTA('View recognition wall', `${opts.loginUrl}/tenant/recognition`, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `You've been recognised with a ${opts.awardType}!${opts.reason ? `\nReason: ${opts.reason}` : ''}${opts.nominatorName ? `\nBy: ${opts.nominatorName}` : ''}\nView: ${opts.loginUrl}/tenant/recognition`
  return { subject, html, text }
}

/** 20. Account suspended */
export function accountSuspendedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
}): TemplateResult {
  const subject = `Your ${opts.orgName} HR portal access has been suspended`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Your account has been suspended') +
      P(`Hi ${opts.recipientName}, your access to the <strong>${opts.orgName}</strong> HR portal has been temporarily suspended.`) +
      BOX('If you believe this is an error, or have questions about your access, contact your HR team or manager directly.', '#fef2f2', '#fecaca', '#991b1b')
    ) +
    ftr(opts.orgName)
  )
  const text = `Your ${opts.orgName} HR portal account has been suspended. Contact HR if you believe this is an error.`
  return { subject, html, text }
}

/** 21. Account reactivated */
export function accountReactivatedEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string; loginUrl: string
}): TemplateResult {
  const subject = `Your ${opts.orgName} HR portal access has been restored`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2('Your account has been reactivated ✅') +
      P(`Hi ${opts.recipientName}, your access to the <strong>${opts.orgName}</strong> HR portal has been restored. You can now log in normally.`) +
      CTA('Sign in to your portal', opts.loginUrl, opts.primaryColor)
    ) +
    ftr(opts.orgName)
  )
  const text = `Your ${opts.orgName} HR portal account has been reactivated.\nSign in: ${opts.loginUrl}`
  return { subject, html, text }
}

/** 22. Generic notification (catch-all) */
export function genericNotificationEmail(opts: {
  recipientName: string; orgName: string; logoUrl: string | null; primaryColor: string
  title: string; message: string; ctaLabel?: string; ctaUrl?: string
}): TemplateResult {
  const subject = `${opts.title} — ${opts.orgName}`
  const html = WRAP(
    hdr(opts.primaryColor, opts.orgName, opts.logoUrl) +
    BD(
      H2(opts.title) +
      P(`Hi ${opts.recipientName},`) +
      P(opts.message) +
      (opts.ctaUrl ? CTA(opts.ctaLabel ?? 'View in portal', opts.ctaUrl, opts.primaryColor) : '')
    ) +
    ftr(opts.orgName)
  )
  const text = `${opts.title}\n\nHi ${opts.recipientName},\n\n${opts.message}${opts.ctaUrl ? `\n\n${opts.ctaLabel ?? 'View'}: ${opts.ctaUrl}` : ''}`
  return { subject, html, text }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN / PLATFORM TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/** 23. New tenant onboarded — to tenant admin */
export function newTenantOnboardedEmail(opts: {
  recipientName: string; orgName: string; tier: string
  loginUrl: string; adminEmail: string; tempPassword?: string
}): TemplateResult {
  const subject = `Welcome to HRMS — Your ${opts.orgName} portal is live`
  const tier = opts.tier.charAt(0).toUpperCase() + opts.tier.slice(1)
  const html = WRAP(
    platformHdr() +
    BD(
      H2(`Your HRMS portal is live, ${opts.recipientName}! 🚀`) +
      P(`Welcome! Your organisation <strong>${opts.orgName}</strong> has been set up on the <strong>${tier}</strong> plan. Your HR management portal is now active and ready to use.`) +
      BOX(`<strong>Organisation:</strong> ${opts.orgName}<br><strong>Plan:</strong> ${tier}<br><strong>Admin Email:</strong> ${opts.adminEmail}${opts.tempPassword ? `<br><strong>Temporary Password:</strong> <span style="font-family:monospace;">${opts.tempPassword}</span>` : ''}`, '#eff6ff', '#bfdbfe', '#1e40af') +
      (opts.tempPassword ? P('<strong>Important:</strong> Change this temporary password immediately after your first login.', true) : '') +
      CTA('Access your portal', opts.loginUrl, '#0E3D52') +
      P('Need help getting started? Contact HRMS support.', true)
    ) +
    platformFtr()
  )
  const text = `Welcome to HRMS!\n${opts.orgName} (${tier} plan) is now active.\nAdmin: ${opts.adminEmail}${opts.tempPassword ? `\nTemp password: ${opts.tempPassword}` : ''}\nAccess: ${opts.loginUrl}`
  return { subject, html, text }
}

/** 24. Tenant suspended */
export function tenantSuspendedEmail(opts: {
  recipientName: string; orgName: string; loginUrl: string
}): TemplateResult {
  const subject = `${opts.orgName} HRMS portal access has been suspended`
  const html = WRAP(
    platformHdr() +
    BD(
      H2('Your HRMS portal has been suspended') +
      P(`Hi ${opts.recipientName}, the HRMS portal for <strong>${opts.orgName}</strong> has been temporarily suspended by the platform administrator.`) +
      BOX('All user access has been disabled. Your data is safe. To restore access, contact HRMS support.', '#fef2f2', '#fecaca', '#991b1b')
    ) +
    platformFtr()
  )
  const text = `Your ${opts.orgName} HRMS portal has been suspended. Contact HRMS support to restore access.`
  return { subject, html, text }
}

/** 25. Tenant reactivated */
export function tenantReactivatedEmail(opts: {
  recipientName: string; orgName: string; loginUrl: string
}): TemplateResult {
  const subject = `${opts.orgName} HRMS portal has been reactivated`
  const html = WRAP(
    platformHdr() +
    BD(
      H2('Your HRMS portal has been reactivated ✅') +
      P(`Hi ${opts.recipientName}, the HRMS portal for <strong>${opts.orgName}</strong> has been reactivated. All users can now log in.`) +
      CTA('Access your portal', opts.loginUrl, '#0E3D52')
    ) +
    platformFtr()
  )
  const text = `Your ${opts.orgName} HRMS portal has been reactivated.\nAccess: ${opts.loginUrl}`
  return { subject, html, text }
}

/** 26. Tenant plan changed */
export function tenantTierChangedEmail(opts: {
  recipientName: string; orgName: string; oldTier: string; newTier: string; loginUrl: string
}): TemplateResult {
  const tiers  = ['starter', 'professional', 'enterprise']
  const isUp   = tiers.indexOf(opts.newTier) > tiers.indexOf(opts.oldTier)
  const oldT   = opts.oldTier.charAt(0).toUpperCase() + opts.oldTier.slice(1)
  const newT   = opts.newTier.charAt(0).toUpperCase() + opts.newTier.slice(1)
  const subject = `Your HRMS plan has been ${isUp ? 'upgraded' : 'changed'} to ${newT} — ${opts.orgName}`
  const html = WRAP(
    platformHdr() +
    BD(
      H2(`Plan ${isUp ? 'upgraded' : 'changed'}: ${oldT} → ${newT} ${isUp ? '🎉' : '📋'}`) +
      P(`Hi ${opts.recipientName}, your <strong>${opts.orgName}</strong> HRMS subscription has been ${isUp ? 'upgraded' : 'changed'}.`) +
      BOX(`<strong>Previous Plan:</strong> ${oldT}<br><strong>New Plan:</strong> ${newT}`, isUp ? '#f0fdf4' : '#eff6ff', isUp ? '#bbf7d0' : '#bfdbfe', isUp ? '#166534' : '#1e40af') +
      P(isUp ? 'Your new modules are now available. Log in to explore additional features.' : 'Your module access has been updated to reflect the new plan.') +
      CTA('View your portal', opts.loginUrl, '#0E3D52')
    ) +
    platformFtr()
  )
  const text = `HRMS plan changed: ${opts.oldTier} -> ${opts.newTier}\nAccess: ${opts.loginUrl}`
  return { subject, html, text }
}

/** 27. New super admin invited */
export function superAdminInviteEmail(opts: {
  recipientName: string; adminEmail: string; tempPassword: string; loginUrl: string
}): TemplateResult {
  const subject = `You have been invited as an HRMS Super Admin`
  const html = WRAP(
    platformHdr() +
    BD(
      H2('You have been added as an HRMS Super Admin 🔑') +
      P(`Hi ${opts.recipientName}, you have been granted Super Admin access to the HRMS platform. You can now manage all tenants, users, modules, and system settings.`) +
      BOX(`<strong>Email:</strong> ${opts.adminEmail}<br><strong>Temporary Password:</strong> <span style="font-family:monospace;font-size:15px;">${opts.tempPassword}</span>`, '#eff6ff', '#bfdbfe', '#1e40af') +
      P('<strong>Important:</strong> This is a highly privileged account. Change your password immediately after first login and enable two-factor authentication.', true) +
      CTA('Sign in to Super Admin', opts.loginUrl, '#0E3D52')
    ) +
    platformFtr()
  )
  const text = `You've been invited as HRMS Super Admin.\nEmail: ${opts.adminEmail}\nTemp password: ${opts.tempPassword}\nSign in: ${opts.loginUrl}`
  return { subject, html, text }
}
