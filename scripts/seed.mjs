// Creates a demo therapist with synthetic clients and role-play sessions
// (from evals/sessions/*.json) so the app can be explored straight away.
// Sign in as demo@psych.test — the sign-in link appears on /dev/mailbox.
// Synthetic data only. Safe to re-run: it replaces the demo account.
import { readdirSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import pg from "pg";
import { ROOT, loadEnv } from "./env.mjs";

loadEnv();
const EMAIL = "demo@psych.test";
const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
await client.connect();

await client.query('delete from "user" where email = $1', [EMAIL]);
const uid = randomBytes(16).toString("hex");
await client.query(
  `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ($1, 'Demo Therapist', $2, true, now(), now())`,
  [uid, EMAIL],
);
await client.query(
  `insert into therapists (id, display_name, profession, accreditation_stage, modalities, note_format, language, onboarding_completed_at)
   values ($1, 'Demo', 'counsellor', 'pre_accredited', '{cbt,mi,person_centred,solution_focused}', 'SOAP', 'en', now())`,
  [uid],
);

const dir = path.join(ROOT, "evals", "sessions");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
let day = files.length;
for (const file of files) {
  const s = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  const { rows: [c] } = await client.query(
    "insert into clients (therapist_id, pseudonym) values ($1, $2) returning id", [uid, s.client_label],
  );
  await client.query(
    "insert into consents (therapist_id, client_id, consent_version, method, given_at) values ($1, $2, '2026-10-v1', 'verbal_in_session', now() - interval '30 days')",
    [uid, c.id],
  );
  // A role-play session that has already been "recorded and transcribed".
  const minutes = Math.max(10, Math.round(s.segments.length * 1.6));
  const { rows: [sess] } = await client.query(
    `insert into sessions (therapist_id, client_id, capture_mode, status, stage, started_at, ended_at, duration_seconds, language, audio_deleted_at)
     values ($1, $2, 'in_person', 'processing', 'writing_note', now() - ($3 || ' days')::interval, now() - ($3 || ' days')::interval + ($4 || ' minutes')::interval, $5, 'en', now())
     returning id`,
    [uid, c.id, String(day--), String(minutes), minutes * 60],
  );
  let t = 0;
  for (const seg of s.segments) {
    const dur = Math.max(2000, seg.text.split(/\s+/).length * 380);
    await client.query(
      "insert into transcript_segments (therapist_id, session_id, idx, speaker, start_ms, end_ms, text) values ($1, $2, $3, $4, $5, $6, $7)",
      [uid, sess.id, seg.idx, seg.speaker, t, t + dur, seg.text],
    );
    t += dur + 800;
  }
  // The worker drafts the note, reflection and timeline for each.
  await client.query("insert into jobs (therapist_id, session_id, kind) values ($1, $2, 'regenerate')", [uid, sess.id]);
  console.log(`seeded ${s.client_label}: ${s.title}`);
}
console.log(`\nDemo account: ${EMAIL}. Start the worker (npm run worker) to draft notes and reflections.`);
await client.end();
