/**
 * Optimistic locking helpers.
 *
 * Usage:
 *   const conflict = await checkVersion(db, table, id, tenantId, clientVersion)
 *   if (conflict) return conflict   // returns NextResponse 409
 *
 * The UPDATE caller is responsible for incrementing `version` in its SET clause.
 */
import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'

export interface VersionedTable {
  id:       PgColumn
  tenantId: PgColumn
  version:  PgColumn
}

export async function checkVersion(
  db: NodePgDatabase<any>,
  table: PgTable & VersionedTable,
  id: string,
  tenantId: string,
  clientVersion: number | undefined,
): Promise<NextResponse | null> {
  if (clientVersion === undefined) return null  // caller omitted version → skip check

  const [row] = await db
    .select({ version: table.version })
    .from(table)
    .where(and(eq(table.id as any, id), eq(table.tenantId as any, tenantId)))

  if (!row) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  if (row.version !== clientVersion) {
    return NextResponse.json(
      { error: 'Conflict: record was modified by another user', currentVersion: row.version },
      { status: 409 },
    )
  }
  return null
}
