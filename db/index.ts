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

  console.log("[DB] Creating new PostgreSQL Pool (pg driver)")

  // pg (node-postgres) идеально работает с Supabase Connection Pooler
  return new Pool({
    connectionString: url,
    max: 5,                      // Максимум 5 соединений в пуле
    idleTimeoutMillis: 20000,    // Закрывать простаивающие через 20 сек
    connectionTimeoutMillis: 10000, // Таймаут на новое подключение 10 сек
  })
}

export function getDb() {
  if (!globalForDb.pool) {
    console.log("[DB] Initializing global DB connection")
    globalForDb.pool = createPool()
    globalForDb.db = drizzle(globalForDb.pool, { schema })
  }
  
  return globalForDb.db!
}

export type Db = ReturnType<typeof getDb>