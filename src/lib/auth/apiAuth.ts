/**
 * apiAuth — lightweight session helper for admin-only routes.
 * Returns the current session or null (no permission check).
 * For permission-guarded routes, use apiGuard() instead.
 */
export { getSession as apiAuth } from '@/lib/auth/session'
