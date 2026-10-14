import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import path from "node:path";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
  __pglite?: PGlite;
  __db?: any;
};

export function isLocalPglite() {
  const url = process.env.DATABASE_URL;
  return (
    !url ||
    url === "local" ||
    url.startsWith("pglite://") ||
    url.includes("localhost:5432") ||
    url.includes("user:pass@host")
  );
}

export function getSql() {
  if (globalForDb.__sql) return globalForDb.__sql;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || isLocalPglite()) {
    throw new Error("Using local embedded PGlite engine");
  }
  const client = postgres(connectionString, { max: 4, idle_timeout: 20, prepare: false });
  globalForDb.__sql = client;
  return client;
}

function getDb() {
  if (globalForDb.__db) return globalForDb.__db;

  if (isLocalPglite()) {
    const dataDir = path.join(process.cwd(), "data", "pgdata");
    const client = new PGlite(dataDir);
    globalForDb.__pglite = client;
    globalForDb.__db = drizzlePglite(client, { schema });
    return globalForDb.__db;
  }

  globalForDb.__db = drizzlePostgres(getSql(), { schema });
  return globalForDb.__db;
}

type Db = any;

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
    if (globalForDb.__pglite) await globalForDb.__pglite.close();
  },
};

export { schema };
