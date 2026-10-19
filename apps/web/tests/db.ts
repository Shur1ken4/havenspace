// Test helpers: talk to the psych_test database (reset by `node scripts/migrate.mjs --test`).
import pg from "pg";
import { randomBytes } from "node:crypto";
import { loadEnv } from "../../../scripts/env.mjs";

loadEnv();
const toTest = (url: string) => url.replace(/\/[^/]+$/, "/psych_test");
export const admin = () => new pg.Client({ connectionString: toTest(process.env.MIGRATION_DATABASE_URL!) });
export const appRole = () => new pg.Client({ connectionString: toTest(process.env.DATABASE_URL!) });

/** Creates a therapist (auth user + profile) and returns its id. */
export async function makeTherapist(db: pg.Client): Promise<string> {
  const id = randomBytes(12).toString("hex");
  await db.query(`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, 't', $2, true, now(), now())`, [id, `${id}@example.test`]);
  await db.query("insert into therapists (id, onboarding_completed_at, access_status) values ($1, now(), 'approved')", [id]);
  return id;
}

/** Creates a plain signed-up user with no therapist profile (e.g. a client before joining). */
export async function makeUser(db: pg.Client): Promise<string> {
  const id = randomBytes(12).toString("hex");
  await db.query(`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, 'c', $2, true, now(), now())`, [id, `${id}@example.test`]);
  return id;
}

/** Runs queries as the web app would: app role, signed in as `userId`. */
export async function asUser<T>(db: pg.Client, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  await db.query("select set_config('app.user_id', $1, true)", [userId]);
  try {
    const out = await fn();
    await db.query("commit");
    return out;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}
