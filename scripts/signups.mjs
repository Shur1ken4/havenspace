// Saves demo requests and waiting-list sign-ups to .data/signups.csv.
// The web app can only add to this list, never read it; this admin script can.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { ROOT, loadEnv } from "./env.mjs";

loadEnv();
const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  "select created_at, interest, name, email, profession, practice_size, language from pilot_signups order by created_at desc",
);
await client.end();
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = ["date,type,name,email,profession,works,language", ...rows.map((r) =>
  [r.created_at.toISOString().slice(0, 16).replace("T", " "), r.interest, r.name, r.email, r.profession, r.practice_size, r.language].map(esc).join(","))].join("\n");
mkdirSync(path.join(ROOT, ".data"), { recursive: true });
const file = path.join(ROOT, ".data", "signups.csv");
writeFileSync(file, csv + "\n");
console.log(`${rows.length} sign-ups (${rows.filter((r) => r.interest === "demo").length} demo requests) saved to ${file}`);
