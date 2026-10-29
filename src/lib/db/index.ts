import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || ''

// In development, Next.js HMR re-evaluates this module on every hot reload,
// which would create a new postgres client (and new connections) each time,
// quickly exhausting the 15-connection session pooler limit.
// globalThis caching ensures only ONE client/db instance exists per process.
const globalForDb = global as unknown as {
  __pgClient: ReturnType<typeof postgres> | undefined
  __db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

if (!globalForDb.__pgClient) {
  globalForDb.__pgClient = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 30,
  })
}

if (!globalForDb.__db) {
  globalForDb.__db = drizzle(globalForDb.__pgClient!, { schema })
}

export const sql = globalForDb.__pgClient!
export const db = globalForDb.__db!
