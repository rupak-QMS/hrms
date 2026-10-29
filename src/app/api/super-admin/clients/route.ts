import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { tenants, tenantModules, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSession } from '@/lib/auth/session'
import { sendEmail } from '@/lib/email/resend'
import { newTenantOnboardedEmail } from '@/lib/email/templates'

const ALL_MODULES = [
  { id: 1,  name: 'Enterprise Dashboard' },
  { id: 2,  name: 'Employee Master Profiles' },
  { id: 3,  name: 'RBAC & Custom Authentication' },
  { id: 4,  name: 'Audit Logging' },
  { id: 5,  name: 'Document Management System' },
  { id: 6,  name: 'Pre-Employment Screening' },
  { id: 7,  name: 'Compliance Lock System' },
  { id: 8,  name: 'Ongoing Compliance Tracking' },
  { id: 9,  name: 'Onboarding & Induction' },
  { id: 10, name: 'Training Management & LMS' },
  { id: 11, name: 'Competency Management' },
  { id: 12, name: 'Supervision Management' },
  { id: 13, name: 'Workforce Planning & Role Design' },
  { id: 14, name: 'Recruitment & Applicant Tracking' },
  { id: 15, name: 'Employment Contracting & E-Sign' },
  { id: 16, name: 'Probation & Performance Management' },
  { id: 17, name: 'WHS & Injury Management' },
  { id: 18, name: 'Grievance & Investigation Management' },
  { id: 19, name: 'Separation & Exit Management' },
  { id: 20, name: 'Reporting & Analytics' },
  { id: 21, name: 'Employee Experience & Benefits' },
  { id: 22, name: 'Recognition & Rewards' },
  { id: 23, name: 'Referral Program' },
  { id: 24, name: 'Diversity, Equity & Inclusion' },
  { id: 25, name: 'Employee Voice & Engagement' },
  { id: 26, name: 'Asset & Equipment Register' },
  { id: 27, name: 'Rostering & Attendance Integration' },
  { id: 28, name: 'Payroll & Award Compliance Integration' },
  { id: 29, name: 'Leave Management' },
  { id: 30, name: 'Public Holidays' },
]

const STARTER_MODULES    = [1,2,3,4,5,6,7,8,9]
const PRO_MODULES        = [...STARTER_MODULES, 10,11,12,13,14,15,16,17,18,19]
const ENTERPRISE_MODULES = ALL_MODULES.map(m => m.id)

function getDefaultModules(tier: string): number[] {
  if (tier === 'professional') return PRO_MODULES
  if (tier === 'enterprise')   return ENTERPRISE_MODULES
  return STARTER_MODULES
}

// GET /api/super-admin/clients — list all tenants
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const clients = await db.select().from(tenants).orderBy(tenants.createdAt)
    return NextResponse.json({ clients })
  } catch (error) {
    console.error('GET /api/super-admin/clients error:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

// POST /api/super-admin/clients — create new tenant
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'super_admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const {
      name, slug, tier = 'starter', primaryColor, logoUrl,
      enabledModules, adminEmail, adminPassword,
      settings: incomingSettings,
    } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
    }

    const settingsPayload = {
      theme: {
        primaryColor: primaryColor || '#1a4fff',
        logoUrl:      logoUrl || null,
        fontFamily:   'Inter',
        borderRadius: '0.5rem',
      },
      ...(incomingSettings ?? {}),
    }

    const [tenant] = await db.insert(tenants).values({
      name,
      slug:         slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      tier,
      primaryColor: primaryColor || '#1a4fff',
      logoUrl,
      settings:     settingsPayload,
      isActive:     true,
    }).returning()

    const modulesToEnable = enabledModules ?? getDefaultModules(tier)
    const moduleRows = ALL_MODULES.map(m => ({
      tenantId: tenant.id,
      moduleId: m.id,
      moduleName: m.name,
      isEnabled: modulesToEnable.includes(m.id),
    }))

    await db.insert(tenantModules).values(moduleRows)

    let adminUser = null
    if (adminEmail && adminPassword) {
      if (adminPassword.length < 8) {
        return NextResponse.json({ error: 'Admin password must be at least 8 characters' }, { status: 400 })
      }
      const passwordHash = await bcrypt.hash(adminPassword, 12)
      const [u] = await db.insert(users).values({
        tenantId:     tenant.id,
        email:        adminEmail.toLowerCase().trim(),
        passwordHash,
        role:         'director',
        isActive:     true,
      }).returning({ id: users.id, email: users.email, role: users.role })
      adminUser = u
    }

    let deploymentUrl = body.deploymentUrl ?? null
    const vercelToken  = process.env.VERCEL_API_TOKEN
    const vercelTeamId = process.env.VERCEL_TEAM_ID

    if (vercelToken && !deploymentUrl) {
      try {
        const projectName = `${tenant.slug}-hrmsapp`

        const createRes = await fetch(
          `https://api.vercel.com/v10/projects${vercelTeamId ? `?teamId=${vercelTeamId}` : ''}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name:      projectName,
              framework: 'nextjs',
              gitRepository: { type: 'github', repo: 'hrmssubhankar/hrms' },
            }),
          },
        )
        const project = await createRes.json()

        if (project.id) {
          const envVars = [
            { key: 'NEXT_PUBLIC_TENANT_SLUG', value: tenant.slug,   target: ['production'] },
            { key: 'DATABASE_URL',            value: process.env.DATABASE_URL ?? '', target: ['production'] },
            { key: 'JWT_SECRET',              value: process.env.JWT_SECRET   ?? '', target: ['production'] },
            { key: 'APP_URL',                 value: `https://${projectName}.vercel.app`, target: ['production'] },
            { key: 'NEXT_PUBLIC_APP_URL',     value: `https://${projectName}.vercel.app`, target: ['production'] },
            { key: 'BLOB_READ_WRITE_TOKEN',   value: process.env.BLOB_READ_WRITE_TOKEN ?? '', target: ['production'] },
          ]

          await fetch(
            `https://api.vercel.com/v10/projects/${project.id}/env${vercelTeamId ? `?teamId=${vercelTeamId}` : ''}`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(envVars),
            },
          )

          await fetch(
            `https://api.vercel.com/v13/deployments${vercelTeamId ? `?teamId=${vercelTeamId}` : ''}`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: projectName, project: project.id, target: 'production' }),
            },
          )

          deploymentUrl = `https://${projectName}.vercel.app`

          await db.update(tenants)
            .set({ settings: { ...settingsPayload, deploymentUrl, vercelProjectId: project.id } })
            .where(eq(tenants.id, tenant.id))
        }
      } catch (vercelErr) {
        console.error('Vercel auto-create error (non-fatal):', vercelErr)
      }
    } else if (deploymentUrl) {
      await db.update(tenants)
        .set({ settings: { ...settingsPayload, deploymentUrl } })
        .where(eq(tenants.id, tenant.id))
    }

    if (adminEmail && adminUser) {
      const loginUrl = deploymentUrl ?? `https://${tenant.slug}-hrmsapp.vercel.app`
      const tmpl = newTenantOnboardedEmail({
        recipientName: adminEmail.split('@')[0],
        orgName:       name,
        tier,
        loginUrl:      `${loginUrl}/login`,
        adminEmail,
        tempPassword:  adminPassword,
      })
      sendEmail({ to: adminEmail, ...tmpl }).catch(console.error)
    }

    return NextResponse.json({ tenant, adminUser, deploymentUrl }, { status: 201 })
  } catch (error: any) {
    if (error?.message?.includes('unique')) {
      return NextResponse.json({ error: 'A client with this slug already exists' }, { status: 409 })
    }
    console.error('POST /api/super-admin/clients error:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }
}
