// Links a test client account (client@psych.test) to the demo therapist's
// first client, with sample homework, a next session and diary entries, so the
// client app can be tried in one click at /dev/login. Synthetic data only.
// Run after seed.mjs; safe to re-run.
import { randomBytes } from "node:crypto";
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();
const db = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
await db.connect();
const { rows: [demo] } = await db.query(`select u.id from "user" u where u.email = 'demo@psych.test'`);
if (!demo) { console.log("Run `npm run seed` first."); process.exit(1); }
const { rows: [client] } = await db.query("select id, pseudonym from clients where therapist_id = $1 order by created_at limit 1", [demo.id]);

await db.query(`delete from "user" where email = 'client@psych.test'`);
const uid = randomBytes(16).toString("hex");
await db.query(`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, 'Test Client', 'client@psych.test', true, now(), now())`, [uid]);
await db.query("update client_accounts set revoked_at = now() where client_id = $1 and revoked_at is null", [client.id]);
await db.query("insert into client_accounts (user_id, therapist_id, client_id) values ($1, $2, $3)", [uid, demo.id, client.id]);

await db.query("delete from assignments where client_id = $1", [client.id]);
await db.query(
  `insert into assignments (therapist_id, client_id, title, details, due_on, done_at, client_reply) values
   ($1, $2, 'Notice three calm moments each day', 'Write a word or two about what was happening.', current_date + 5, null, null),
   ($1, $2, 'Try the 4-7-8 breathing before sleep', '', null, null, null),
   ($1, $2, 'Read the leaflet on sleep habits', '', current_date - 2, now() - interval '1 day', 'Done, the part about screens helped.')`,
  [demo.id, client.id],
);
await db.query("delete from appointments where client_id = $1", [client.id]);
await db.query("insert into appointments (therapist_id, client_id, starts_at) values ($1, $2, date_trunc('hour', now()) + interval '3 days 2 hours')", [demo.id, client.id]);
await db.query(
  `insert into mood_entries (therapist_id, client_id, client_user_id, mood, note, shared, created_at) values
   ($1, $2, $3, 3, 'Busy week at work, slept badly.', true, now() - interval '2 days'),
   ($1, $2, $3, 4, 'Walk by the sea helped.', true, now() - interval '1 day'),
   ($1, $2, $3, 2, 'Kept this one for myself.', false, now() - interval '3 hours')`,
  [demo.id, client.id, uid],
);
console.log(`client@psych.test is linked to the demo therapist's "${client.pseudonym}".`);
await db.end();
