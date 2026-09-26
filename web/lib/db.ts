import { Pool } from "pg";

// Reused across hot-reloads in dev so we don't open a new pool per request.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForDb.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}
