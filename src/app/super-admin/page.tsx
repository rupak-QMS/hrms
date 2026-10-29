import Link from 'next/link'
import { db } from '@/lib/db'
import { tenants, users, tenantModules, auditLogs } from '@/lib/db/schema'
import { eq, count, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const ACCENT = '#7c3aed'

async function getPlatformData() {
  try {
    const [allTenants, totalUsersResult, activeUsersResult, enabledModulesResult, recentLogs] =
      await Promise.all([
        db.select().from(tenants),
        db.select({ count: count() }).from(users),
        db.select({ count: count() }).from(users).where(eq(users.isActive, true)),
        db.select({ count: count() }).from(tenantModules).where(eq(tenantModules.isEnabled, true)),
        db.select({ id: auditLogs.id, action: auditLogs.action, resource: auditLogs.resource, createdAt: auditLogs.createdAt, tenantId: auditLogs.tenantId })
          .from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(6),
      ])
    const tenantMap = Object.fromEntries(allTenants.map((t) => [t.id, t.name]))
    const recentLogsWithName = recentLogs.map((l) => ({ ...l, tenantName: l.tenantId ? tenantMap[l.tenantId] ?? null : null }))
    const activeTenants = allTenants.filter((t) => t.isActive)
    const prices: Record<string, number> = { starter: 57, professional: 120, enterprise: 217 }
    const mrr = activeTenants.reduce((sum, t) => sum + (prices[t.tier] ?? 0), 0)
    const clientsWithStatus = allTenants.slice(0, 5).map((c) => {
      const themed = c.primaryColor && c.primaryColor !== '#1a4fff'
      const score  = [c.isActive, themed, Boolean(c.slug)].filter(Boolean).length
      return { ...c, onboardingScore: score, onboardingTotal: 3 }
    })
    return {
      totalClients: allTenants.length, activeClients: activeTenants.length,
      enterprise: allTenants.filter((t) => t.tier === 'enterprise').length,
      professional: allTenants.filter((t) => t.tier === 'professional').length,
      starter: allTenants.filter((t) => t.tier === 'starter').length,
      totalUsers: Number(totalUsersResult[0]?.count ?? 0),
      activeUsers: Number(activeUsersResult[0]?.count ?? 0),
      enabledModules: Number(enabledModulesResult[0]?.count ?? 0),
      mrr, recentLogs: recentLogsWithName, clients: clientsWithStatus,
    }
  } catch (err) {
    console.error('[SuperAdminDashboard] DB error:', err)
    return { totalClients: 0, activeClients: 0, enterprise: 0, professional: 0, starter: 0, totalUsers: 0, activeUsers: 0, enabledModules: 0, mrr: 0, recentLogs: [], clients: [], dbError: true }
  }
}

const ACTION_DOT: Record<string, string> = {
  login: '#3b82f6', create: '#22c55e', update: '#eab308', delete: '#ef4444', export: '#a855f7',
}
function actionDot(action: string): string {
  const key = Object.keys(ACTION_DOT).find((k) => action.toLowerCase().includes(k))
  return key ? ACTION_DOT[key] : '#64748b'
}

export default async function SuperAdminDashboard() {
  const d = await getPlatformData()
  return (
    <div className="space-y-6">
      {d.dbError && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-amber-800 dark:text-amber-300 text-sm">
          ⚠️ Database temporarily unavailable — stats below may be incomplete. Please refresh the page.
        </div>
      )}
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Platform Dashboard</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Manage all client tenants and platform settings</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Clients"   value={d.totalClients}   sub={`${d.activeClients} active`}  accent="#7c3aed" />
        <StatCard label="Platform Users"  value={d.totalUsers}     sub={`${d.activeUsers} active`}    accent="#3b82f6" />
        <StatCard label="Active Modules"  value={d.enabledModules} sub="across all tenants"           accent="#8b5cf6" />
        <StatCard label="Monthly Revenue" value={`$${d.mrr}`}      sub="AUD / month"                 accent="#22c55e" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <TierCard tier="Enterprise"   count={d.enterprise}   accent="#a855f7" />
        <TierCard tier="Professional" count={d.professional} accent="#3b82f6" />
        <TierCard tier="Starter"      count={d.starter}      accent="#64748b" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div>
            <p className="section-label mb-3">Quick Actions</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { label: 'Add Client',    href: '/super-admin/clients/new',   desc: 'Onboard a new organisation' },
                { label: 'Clients',       href: '/super-admin/clients',       desc: 'View, edit or deactivate' },
                { label: 'Billing',       href: '/super-admin/billing',       desc: 'Subscriptions & revenue' },
                { label: 'Modules',       href: '/super-admin/modules',       desc: 'Cross-tenant module usage' },
                { label: 'Audit Logs',    href: '/super-admin/audit-logs',    desc: 'Platform-wide event log' },
                { label: 'Announcements', href: '/super-admin/announcements', desc: 'Broadcast to tenants' },
                { label: 'Migrations',    href: '/super-admin/migrations',    desc: 'Apply pending schema changes' },
                { label: 'System Health', href: '/super-admin/system',        desc: 'DB status & infra checks' },
                { label: 'Admins',        href: '/super-admin/admins',        desc: 'Super admin accounts' },
                { label: 'Settings',      href: '/super-admin/settings',      desc: 'Email, security, maintenance' },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="group card-premium block p-3.5 transition-all duration-150 hover:border-purple-500/30">
                  <p className="text-[13px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors leading-tight">{a.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{a.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {d.clients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Client Setup Status</p>
                <Link href="/super-admin/clients" className="text-[11px] text-purple-500 dark:text-purple-400/70 hover:text-purple-600 dark:hover:text-purple-300 transition-colors">View all →</Link>
              </div>
              <div className="card-premium overflow-hidden">
                {d.clients.map((c: any, i: number) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                    style={i < d.clients.length - 1 ? { borderBottom: '1px solid hsl(var(--border))' } : {}}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: `linear-gradient(135deg, ${c.primaryColor || ACCENT}, ${c.primaryColor || ACCENT}99)` }}>
                      {c.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground/80 font-medium truncate">{c.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {[{ label: 'Active', done: c.isActive }, { label: 'Themed', done: c.primaryColor !== '#1a4fff' }, { label: 'Slug', done: Boolean(c.slug) }].map((step) => (
                          <span key={step.label} className={`text-[10px] px-1.5 py-0.5 rounded ${step.done ? 'badge-green' : 'badge-gray'}`}>
                            {step.done ? '✓ ' : '○ '}{step.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] text-muted-foreground">{c.onboardingScore}/{c.onboardingTotal}</p>
                      <div className="w-14 rounded-full h-1 mt-1 bg-border">
                        <div className="h-1 rounded-full" style={{ width: `${(c.onboardingScore / c.onboardingTotal) * 100}%`, background: ACCENT }} />
                      </div>
                    </div>
                    <Link href={`/super-admin/clients/${c.id}`} className="text-[12px] text-muted-foreground hover:text-purple-500 transition-colors shrink-0">→</Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Recent Activity</p>
            <Link href="/super-admin/audit-logs" className="text-[11px] text-purple-500 dark:text-purple-400/70 hover:text-purple-600 dark:hover:text-purple-300 transition-colors">View all →</Link>
          </div>
          <div className="card-premium overflow-hidden">
            {d.recentLogs.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-[12px] text-muted-foreground">No audit events yet</p>
              </div>
            ) : d.recentLogs.map((log: any, i: number) => (
              <div key={log.id} className="px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                style={i < d.recentLogs.length - 1 ? { borderBottom: '1px solid hsl(var(--border))' } : {}}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: actionDot(log.action) }} />
                  <span className="text-[12px] font-semibold text-foreground/70">{log.action}</span>
                  <span className="text-[12px] text-muted-foreground truncate flex-1">{log.resource}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 pl-3.5">
                  {log.tenantName ?? 'Platform'} · {new Date(log.createdAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent: string }) {
  return (
    <div className="card-premium p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}18, transparent 70%)` }} />
      <p className="text-[11px] text-muted-foreground uppercase tracking-[0.1em] mb-2">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  )
}

function TierCard({ tier, count, accent }: { tier: string; count: number; accent: string }) {
  return (
    <div className="card-premium p-4" style={{ borderColor: `${accent}25` }}>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>{count}</p>
      <p className="text-[13px] text-muted-foreground mt-1 font-medium">{tier}</p>
    </div>
  )
}
