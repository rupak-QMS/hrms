'use client'
/**
 * usePermissions — client-side permission checks based on the current user's role.
 *
 * The role is fetched ONCE and cached in a module-level promise so that
 * multiple PermissionGate / usePermissions instances on the same page
 * share a single /api/auth/me call instead of firing one per component.
 */
import { useState, useEffect } from 'react'
import { hasPermission, ROLE_LABELS, type Permission, type UserRole } from '@/lib/auth/permissions'

type UsePermissionsReturn = {
  role:    string | null
  label:   string
  loading: boolean
  can:     (permission: Permission) => boolean
  canAny:  (...permissions: Permission[]) => boolean
  canAll:  (...permissions: Permission[]) => boolean
}

// ── Module-level singleton so every component shares one fetch ────────────────
let _rolePromise: Promise<string | null> | null = null

function fetchRole(): Promise<string | null> {
  if (!_rolePromise) {
    _rolePromise = fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => d ? (d.userRole ?? d.role ?? null) : null)
      .catch(() => null)
  }
  return _rolePromise
}

// Allow clearing the cache (e.g. after login/logout)
export function clearRoleCache() {
  _rolePromise = null
}

export function usePermissions(): UsePermissionsReturn {
  const [role, setRole]       = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchRole().then(r => {
      if (!cancelled) { setRole(r); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [])

  return {
    role,
    label:   role ? (ROLE_LABELS[role as UserRole] ?? role) : '',
    loading,
    can:     (perm)    => !loading && !!role && hasPermission(role, perm),
    canAny:  (...perms) => !loading && !!role && perms.some(p => hasPermission(role, p)),
    canAll:  (...perms) => !loading && !!role && perms.every(p => hasPermission(role, p)),
  }
}
