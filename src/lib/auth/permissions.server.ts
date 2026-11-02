/**
 * Server-only DB-backed permission helpers.
 * Import ONLY from server components / API routes — never from 'use client' files.
 */
import 'server-only'
import { getRolePermissions, type Permission, type UserRole } from './permissions'

/** Simple in-process cache: role → Set<permission key> */
const _dbCache = new Map<string, Set<string>>()
let _cacheLoadedAt = 0
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

export async function getRolePermissionsFromDB(role: string): Promise<Set<string>> {
  const now = Date.now()
  if (_dbCache.has(role) && now - _cacheLoadedAt < CACHE_TTL_MS) {
    return _dbCache.get(role)!
  }

  try {
    const { db } = await import('@/lib/db')
    const { permissions: permsTable, rolePermissions: rpTable } = await import('@/lib/db/schema')
    const { eq } = await import('drizzle-orm')

    const rows = await db
      .select({ key: permsTable.key })
      .from(rpTable)
      .innerJoin(permsTable, eq(rpTable.permissionId, permsTable.id))
      .where(eq(rpTable.role, role))

    const set = new Set(rows.map(r => r.key))
    _dbCache.set(role, set)
    _cacheLoadedAt = now
    return set
  } catch {
    return new Set(getRolePermissions(role))
  }
}

export async function hasPermissionAsync(role: string, permission: Permission): Promise<boolean> {
  const perms = await getRolePermissionsFromDB(role)
  return perms.has(permission)
}

export function invalidatePermissionCache(): void {
  _dbCache.clear()
  _cacheLoadedAt = 0
}
