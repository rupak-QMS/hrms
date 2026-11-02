import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { permissions, rolePermissions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { apiGuard } from '@/lib/auth/apiGuard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/tenant/role-permissions
 * Returns the full permission matrix from DB (all roles → permission keys).
 * Permission: roles:read
 */
export async function GET(_req: NextRequest) {
  try {
    const guard = await apiGuard('roles:read')
    if (guard.error) return guard.error

    const rows = await db
      .select({
        role: rolePermissions.role,
        key:  permissions.key,
        module: permissions.module,
        action: permissions.action,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .orderBy(rolePermissions.role, permissions.key)

    // Group by role
    const matrix: Record<string, string[]> = {}
    for (const row of rows) {
      if (!matrix[row.role]) matrix[row.role] = []
      matrix[row.role].push(row.key)
    }

    return NextResponse.json({ matrix, total: rows.length })
  } catch (err) {
    console.error('[role-permissions GET]', err)
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }
}

/**
 * POST /api/tenant/role-permissions
 * Grant a permission to a role.
 * Body: { role: string, permissionKey: string }
 * Permission: roles:write (director / it_admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await apiGuard('roles:write')
    if (guard.error) return guard.error
    const { session } = guard

    const { role, permissionKey } = await req.json()
    if (!role || !permissionKey) {
      return NextResponse.json({ error: 'role and permissionKey are required' }, { status: 400 })
    }

    const [perm] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, permissionKey))
      .limit(1)

    if (!perm) {
      return NextResponse.json({ error: `Unknown permission key: ${permissionKey}` }, { status: 404 })
    }

    const [grant] = await db
      .insert(rolePermissions)
      .values({
        role,
        permissionId: perm.id,
        grantedBy: session.email ?? session.sub,
      })
      .onConflictDoNothing()
      .returning()

    return NextResponse.json({ grant: grant ?? { role, permissionKey, note: 'already exists' } }, { status: 201 })
  } catch (err) {
    console.error('[role-permissions POST]', err)
    return NextResponse.json({ error: 'Failed to grant permission' }, { status: 500 })
  }
}

/**
 * DELETE /api/tenant/role-permissions
 * Revoke a permission from a role.
 * Body: { role: string, permissionKey: string }
 * Permission: roles:write
 */
export async function DELETE(req: NextRequest) {
  try {
    const guard = await apiGuard('roles:write')
    if (guard.error) return guard.error

    const { role, permissionKey } = await req.json()
    if (!role || !permissionKey) {
      return NextResponse.json({ error: 'role and permissionKey are required' }, { status: 400 })
    }

    const [perm] = await db
      .select({ id: permissions.id })
      .from(permissions)
      .where(eq(permissions.key, permissionKey))
      .limit(1)

    if (!perm) {
      return NextResponse.json({ error: `Unknown permission key: ${permissionKey}` }, { status: 404 })
    }

    await db
      .delete(rolePermissions)
      .where(
        eq(rolePermissions.role, role)
      )

    return NextResponse.json({ success: true, role, permissionKey })
  } catch (err) {
    console.error('[role-permissions DELETE]', err)
    return NextResponse.json({ error: 'Failed to revoke permission' }, { status: 500 })
  }
}
