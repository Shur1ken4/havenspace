import "server-only";
import { Pool, type PoolClient } from "pg";

// One pool per server process. The app role (app_user) has row-level security
// enforced, so every query that touches therapist data must run inside
// withUser(), which tells Postgres who is signed in for that transaction.
const globalForPool = globalThis as unknown as { __pgPool?: Pool };

export const pool =
  globalForPool.__pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") globalForPool.__pgPool = pool;

export type Db = PoolClient;

export async function withUser<T>(userId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.user_id', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Postgres raised one of our named business errors (e.g. consent_required). */
export function isDbError(err: unknown, message: string): boolean {
  return typeof err === "object" && err !== null && (err as { message?: string }).message === message;
}
