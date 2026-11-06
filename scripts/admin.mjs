// Adds (or removes) an admin who can approve therapists on the /admin page.
//   node scripts/admin.mjs add you@example.com
//   node scripts/admin.mjs remove you@example.com
//   node scripts/admin.mjs signup on|off   (on: new therapists are approved without review)
//   node scripts/admin.mjs costs [days]    (measured AI cost per session and per Arch question)
// Uses MIGRATION_DATABASE_URL (locally from .env; for the pilot, scripts/pilot.mjs admin sets it).
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();

// List prices in $ per million tokens: [model, input, output, cache read]. Writing to
// the cache costs 1.25x input. Bedrock EU is assumed 10% higher (check before relying on it).
const PRICES = [["opus-5-5", 4, 20, 0.2], ["sonnet-5-5", 2, 10, 0.1], ["haiku-5-5", 0.1, 0.5, 0.01], ["opus-5", 5, 25, 0.5], ["opus-4-8", 5, 25, 0.5]];
const EUR_PER_USD = 0.9;

function dollars(r) {
  const price = PRICES.find(([m]) => r.model_id.includes(m));
  if (!price) return null;
  const [, input, output, cacheRead] = price;
  const usd = (r.input_tokens * input + r.output_tokens * output + r.cache_write_tokens * input * 1.25 + r.cache_read_tokens * cacheRead) / 1e6;
  return r.provider === "bedrock" ? usd * 1.1 : usd;
}

async function costs(days) {
  const { rows } = await client.query(
    `select therapist_id, session_id, step, provider, model_id, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens
       from llm_usage where at > now() - make_interval(days => $1)`, [days]);
  const unpriced = new Set(rows.filter((r) => dollars(r) === null).map((r) => r.model_id));
  const priced = rows.filter((r) => dollars(r) !== null);
  const eur = (usd) => `€${(usd * EUR_PER_USD).toFixed(3)}`;
  const sum = (list) => list.reduce((total, r) => total + dollars(r), 0);
  console.log(`AI use, last ${days} days (at $1 = €${EUR_PER_USD}): ${eur(sum(priced))} over ${rows.length} rows`);
  if (!priced.length) return;

  const steps = [...new Set(priced.map((r) => r.step))].sort();
  console.log("\nStep               calls  avg in  avg out  avg cost");
  for (const step of steps) {
    const list = priced.filter((r) => r.step === step);
    const avg = (key) => String(Math.round(list.reduce((n, r) => n + r[key], 0) / list.length));
    const allIn = (r) => r.input_tokens + r.cache_write_tokens + r.cache_read_tokens;
    const avgIn = String(Math.round(list.reduce((n, r) => n + allIn(r), 0) / list.length));
    console.log(`${step.padEnd(18)} ${String(list.length).padStart(5)}  ${avgIn.padStart(6)}  ${avg("output_tokens").padStart(7)}  ${eur(sum(list) / list.length)}`);
  }

  const AFTER_SESSION = ["clean_transcript", "draft_note", "reflect", "update_timeline"];
  const sessions = new Map();
  for (const r of priced) {
    if (r.session_id && AFTER_SESSION.includes(r.step)) sessions.set(r.session_id, (sessions.get(r.session_id) ?? 0) + dollars(r));
  }
  if (sessions.size) {
    const values = [...sessions.values()].sort((a, b) => a - b);
    const total = values.reduce((a, b) => a + b, 0);
    console.log(`\nPer session (${values.length}): average ${eur(total / values.length)}, lowest ${eur(values[0])}, highest ${eur(values.at(-1))}`);
  }
  const therapists = new Map();
  for (const r of priced) {
    if (r.therapist_id) therapists.set(r.therapist_id, (therapists.get(r.therapist_id) ?? 0) + dollars(r));
  }
  if (therapists.size) {
    const values = [...therapists.values()];
    console.log(`Per therapist (${values.length}): average ${eur(values.reduce((a, b) => a + b, 0) / values.length)}, highest ${eur(Math.max(...values))}`);
  }
  if (unpriced.size) console.log(`\nNot counted, no price set for: ${[...unpriced].join(", ")}`);
}

// How much therapists changed the AI's notes before approving (counts only, migration 0025).
async function noteEdits(days) {
  const { rows: [edits] } = await client.query(
    `select count(*)::int as n, avg(edit_share) as avg, max(edit_share) as max,
            count(*) filter (where edit_share > 0.3)::int as heavy
       from notes where edit_share is not null and approved_at > now() - make_interval(days => $1)`, [days]);
  if (edits.n) {
    const pct = (x) => `${Math.round(x * 100)}%`;
    console.log(`\nApproved notes (${edits.n}): on average ${pct(edits.avg)} of words changed before approval, most ${pct(edits.max)}; ${edits.heavy} changed by over 30%`);
  }
}

const [action, email] = process.argv.slice(2);
const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
if (action === "signup" && ["on", "off"].includes(email)) {
  await client.connect();
  await client.query("update access_settings set auto_approve = $1", [email === "on"]);
  console.log(email === "on" ? "open sign-up: new therapists are approved automatically" : "sign-up needs admin approval again");
  await client.end();
  process.exit(0);
}
if (action === "costs") {
  await client.connect();
  await costs(Number(email) || 30);
  await noteEdits(Number(email) || 30);
  await client.end();
  process.exit(0);
}
if (!["add", "remove"].includes(action) || !email?.includes("@")) {
  console.error("usage: node scripts/admin.mjs add|remove <email>  |  signup on|off  |  costs [days]");
  process.exit(1);
}
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
