import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined
  db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

function createPool() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error("DATABASE_URL is not set")
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[DB] Creating new PostgreSQL Pool (pg driver)")
  }

  return new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    statement_timeout: 30000,
  })
}

export function getDb() {
  if (!globalForDb.pool) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[DB] Initializing global DB connection")
    }
    globalForDb.pool = createPool()
    globalForDb.db = drizzle(globalForDb.pool, { schema })
  }

  return globalForDb.db!
}

export type Db = ReturnType<typeof getDb>
