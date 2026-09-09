import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazily connected so `next build` (which imports every route module) does not
 * need DATABASE_URL - only a request that actually touches the database does.
 * On Vercel, use your provider's POOLED connection string.
 */
const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
  __db?: ReturnType<typeof drizzle<typeof schema>>;
};

export function getSql() {
  if (globalForDb.__sql) return globalForDb.__sql;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add a Postgres connection string (Neon, Supabase, Vercel Postgres...) to .env.local or the Vercel project env.",
    );
  }
  const client = postgres(connectionString, { max: 1, idle_timeout: 20, prepare: false });
  globalForDb.__sql = client;
  return client;
}

function getDb() {
  if (!globalForDb.__db) globalForDb.__db = drizzle(getSql(), { schema });
  return globalForDb.__db;
}

type Db = ReturnType<typeof getDb>;

/** Proxy so `db.select()` connects on first real use, not at import time. */
export const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    const target = getDb() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === "function" ? value.bind(target) : value;
  },
});

/** Closes the pool - for scripts only. */
export const sql = {
  end: async () => {
    if (globalForDb.__sql) await globalForDb.__sql.end();
  },
};

export { schema };
