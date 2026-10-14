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
  await client.query(`${exists ? "alter" : "create"} role ${name} with login password ${pw} ${rls} nosuperuser nocreatedb nocreaterole`);
}
await client.query(`
  grant usage on schema public to app_user, worker_user;
  grant select, insert, update, delete on all tables in schema public to app_user, worker_user;
  grant usage, select on all sequences in schema public to app_user, worker_user;
  grant execute on all functions in schema public to app_user, worker_user;
  revoke all on schema_migrations from app_user, worker_user;
  revoke update, delete on audit_log from app_user;
  revoke select, update, delete on pilot_signups from app_user;
`);
console.log(`migrations complete (${isTest ? "psych_test" : "psych"})`);
await client.end();
