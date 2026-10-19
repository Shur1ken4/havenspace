// Adds (or removes) an admin who can approve therapists on the /admin page.
//   node scripts/admin.mjs add you@example.com
//   node scripts/admin.mjs remove you@example.com
// Uses MIGRATION_DATABASE_URL (locally from .env; for the pilot, scripts/pilot.mjs admin sets it).
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();
const [action, email] = process.argv.slice(2);
if (!["add", "remove"].includes(action) || !email?.includes("@")) {
  console.error("usage: node scripts/admin.mjs add|remove <email>");
  process.exit(1);
}
const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
await client.connect();
const e = email.trim().toLowerCase();
if (action === "add") {
  await client.query("insert into admins (email) values ($1) on conflict do nothing", [e]);
  // An admin who has already signed up is approved straight away.
  await client.query(`update therapists set access_status = 'approved', access_decided_at = now()
                       where id in (select id from "user" where lower(email) = $1)`, [e]);
} else {
  await client.query("delete from admins where email = $1", [e]);
}
console.log(`${action === "add" ? "added" : "removed"} admin`);
await client.end();
