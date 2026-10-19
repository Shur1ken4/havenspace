// Applies db/migrations/*.sql in order, then (re)creates the two app logins
// and their permissions. Safe to run repeatedly.
//   node scripts/migrate.mjs          -> main database
//   node scripts/migrate.mjs --test   -> psych_test (wiped first)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { ROOT, loadEnv } from "./env.mjs";

loadEnv();
const isTest = process.argv.includes("--test");
let url = process.env.MIGRATION_DATABASE_URL;
if (isTest) url = url.replace(/\/[^/]+$/, "/psych_test");

const client = new pg.Client({ connectionString: url });
await client.connect();

if (isTest) {
  await client.query("drop schema public cascade; create schema public;");
}

await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
const dir = path.join(ROOT, "db", "migrations");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  process.stdout.write(`applying ${file} ... `);
  await client.query("begin");
  try {
    await client.query(readFileSync(path.join(dir, file), "utf8"));
    await client.query("insert into schema_migrations(name) values ($1)", [file]);
    await client.query("commit");
    console.log("ok");
  } catch (err) {
    await client.query("rollback");
    console.error(`failed\n${err.message}`);
    process.exit(1);
  }
}

// Roles: app_user is subject to row-level security; worker_user bypasses it
// because it processes every therapist's jobs.
const roles = [
  ["app_user", process.env.APP_DB_PASSWORD, "nobypassrls"],
  ["worker_user", process.env.WORKER_DB_PASSWORD, "bypassrls"],
];
for (const [name, password, rls] of roles) {
  if (!password) throw new Error(`Missing password for ${name} in .env`);
  const exists = (await client.query("select 1 from pg_roles where rolname = $1", [name])).rowCount;
  const pw = client.escapeLiteral(password);
  const sql = (attrs) => `${exists ? "alter" : "create"} role ${name} with login password ${pw} ${attrs} nosuperuser nocreatedb nocreaterole`;
  try {
    await client.query(sql(rls));
  } catch (err) {
    // Managed providers may refuse BYPASSRLS; the worker then relies on the
    // explicit worker_all policies (0008_worker_policies.sql).
    if (rls !== "bypassrls") throw err;
    await client.query(sql(""));
    console.log("note: provider refused BYPASSRLS for worker_user; using worker policies instead");
  }
}
// Our SECURITY DEFINER functions (access requests, client invites) run as the
// migration role and rely on it skipping row-level security.
const { rows: [owner] } = await client.query("select rolsuper or rolbypassrls as ok from pg_roles where rolname = current_user");
if (!owner.ok) throw new Error("the migration role must be a superuser or have BYPASSRLS (Neon's owner role does)");
// Worker policies (see 0008) need the role to exist; (re)create them now.
for (const { tablename } of (await client.query(
  "select tablename from pg_tables where schemaname = 'public' and rowsecurity",
)).rows) {
  await client.query(`drop policy if exists worker_all on "${tablename}"`);
  if (!["pilot_signups"].includes(tablename)) {
    await client.query(`create policy worker_all on "${tablename}" to worker_user using (true) with check (true)`);
  }
}
await client.query(`
  grant usage on schema public to app_user, worker_user;
  grant select, insert, update, delete on all tables in schema public to app_user, worker_user;
  grant usage, select on all sequences in schema public to app_user, worker_user;
  grant execute on all functions in schema public to app_user, worker_user;
  revoke all on schema_migrations from app_user, worker_user;
  revoke update, delete on audit_log from app_user;
  revoke update, delete on pilot_signups from app_user; -- read only by admins (row-level security)
  revoke insert, update, delete on admins from app_user;  -- admins are managed with scripts/pilot.mjs
  revoke insert, update, delete on client_accounts from app_user; -- changed only via redeem/revoke functions
  revoke all on join_attempts from app_user;
`);
console.log(`migrations complete (${isTest ? "psych_test" : "psych"})`);
await client.end();
