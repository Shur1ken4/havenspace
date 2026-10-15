import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { admin, appRole, asUser, makeTherapist } from "./db";

let su: pg.Client, app: pg.Client;
let alice: string, bob: string, aliceClient: string;

beforeAll(async () => {
  su = admin(); app = appRole();
  await su.connect(); await app.connect();
  alice = await makeTherapist(su);
  bob = await makeTherapist(su);
  aliceClient = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Client A') returning id", [alice])).rows[0].id;
});
afterAll(async () => { await su.end(); await app.end(); });

describe("row-level security", () => {
  it("a therapist sees only their own clients", async () => {
    const mine = await asUser(app, alice, async () => (await app.query("select id from clients")).rows);
    const theirs = await asUser(app, bob, async () => (await app.query("select id from clients")).rows);
    expect(mine.map((r) => r.id)).toContain(aliceClient);
    expect(theirs).toHaveLength(0);
  });

  it("nothing is visible without a signed-in user", async () => {
    const rows = (await app.query("select id from clients")).rows;
    expect(rows).toHaveLength(0);
  });

  it("a therapist cannot write rows for someone else", async () => {
    await expect(asUser(app, bob, () => app.query("insert into clients (therapist_id, pseudonym) values ($1, 'X')", [alice])))
      .rejects.toThrow(/row-level security/);
  });

  it("a therapist cannot change or delete another therapist's rows", async () => {
    const updated = await asUser(app, bob, async () => (await app.query("update clients set pseudonym = 'hacked' where id = $1", [aliceClient])).rowCount);
    const deleted = await asUser(app, bob, async () => (await app.query("delete from clients where id = $1", [aliceClient])).rowCount);
    expect(updated).toBe(0);
    expect(deleted).toBe(0);
  });

  it("the audit log is append-only for the app", async () => {
    await asUser(app, alice, () => app.query("insert into audit_log (therapist_id, actor, action, entity_type) values ($1, $1, 'test', 'x')", [alice]));
    await expect(asUser(app, alice, () => app.query("delete from audit_log"))).rejects.toThrow(/permission denied/);
    await expect(asUser(app, alice, () => app.query("update audit_log set action = 'x'"))).rejects.toThrow(/permission denied/);
  });

  it("the app can add to the sign-up list but never read it", async () => {
    await app.query("insert into pilot_signups (email, profession) values ('a@example.test', 'counsellor')");
    await expect(app.query("select * from pilot_signups")).rejects.toThrow(/permission denied/);
  });
});

describe("consent gate", () => {
  let client: string;
  beforeAll(async () => {
    client = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Client B') returning id", [alice])).rows[0].id;
  });

  it("blocks a recorded session without consent", async () => {
    await expect(asUser(app, alice, () => app.query(
      "insert into sessions (therapist_id, client_id, capture_mode) values ($1, $2, 'in_person')", [alice, client],
    ))).rejects.toThrow(/consent_required/);
  });

  it("allows a written recap without consent (nothing is recorded)", async () => {
    const r = await asUser(app, alice, () => app.query(
      "insert into sessions (therapist_id, client_id, capture_mode) values ($1, $2, 'recap') returning id", [alice, client],
    ));
    expect(r.rows).toHaveLength(1);
  });

  it("allows recording once consent is recorded, and blocks new audio after withdrawal", async () => {
    await asUser(app, alice, () => app.query(
      "insert into consents (therapist_id, client_id, consent_version, method) values ($1, $2, 'v1', 'verbal_in_session')", [alice, client],
    ));
    const sid = (await asUser(app, alice, () => app.query(
      "insert into sessions (therapist_id, client_id, capture_mode) values ($1, $2, 'online_call') returning id", [alice, client],
    ))).rows[0].id;
    const chunk = (seq: number) => asUser(app, alice, () => app.query(
      "insert into audio_chunks (therapist_id, session_id, track, seq, path, bytes, mime) values ($1, $2, 'mic', $3, 'x', 1, 'audio/webm')",
      [alice, sid, seq],
    ));
    await chunk(0);
    await asUser(app, alice, () => app.query("update consents set withdrawn_at = now() where client_id = $1", [client]));
    await expect(chunk(1)).rejects.toThrow(/consent_required/);
  });

  it("accepts dictation audio only for recaps", async () => {
    const recap = (await asUser(app, alice, () => app.query(
      "insert into sessions (therapist_id, client_id, capture_mode) values ($1, $2, 'recap') returning id", [alice, client],
    ))).rows[0].id;
    const ok = await asUser(app, alice, () => app.query(
      "insert into audio_chunks (therapist_id, session_id, track, seq, path, bytes, mime) values ($1, $2, 'dictation', 0, 'x', 1, 'audio/webm') returning id",
      [alice, recap],
    ));
    expect(ok.rows).toHaveLength(1);
    await expect(asUser(app, alice, () => app.query(
      "insert into audio_chunks (therapist_id, session_id, track, seq, path, bytes, mime) values ($1, $2, 'mic', 0, 'x', 1, 'audio/webm')",
      [alice, recap],
    ))).rejects.toThrow(/consent_required/);
  });
});

describe("live research mode", () => {
  let sid: string;
  beforeAll(async () => {
    const client = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Client L') returning id", [alice])).rows[0].id;
    await su.query("insert into consents (therapist_id, client_id, consent_version, method) values ($1, $2, 'v1', 'verbal_in_session')", [alice, client]);
    sid = (await su.query("insert into sessions (therapist_id, client_id, capture_mode) values ($1, $2, 'online_call') returning id", [alice, client])).rows[0].id;
  });
  const liveClip = (seq: number) => asUser(app, alice, () => app.query(
    "insert into audio_chunks (therapist_id, session_id, track, seq, path, bytes, mime) values ($1, $2, 'live_mic', $3, 'x', 1, 'audio/webm')",
    [alice, sid, seq],
  ));

  it("refuses live clips unless live research was switched on for the session", async () => {
    await expect(liveClip(0)).rejects.toThrow(/live_not_enabled/);
    await asUser(app, alice, () => app.query("update sessions set live_research = true where id = $1", [sid]));
    await liveClip(0);
  });

  it("keeps live lines and suggestions private to their therapist", async () => {
    await su.query("insert into live_lines (therapist_id, session_id, seq, speaker, offset_ms, text) values ($1, $2, 0, 'client', 0, 'x')", [alice, sid]);
    await su.query(`insert into live_insights (therapist_id, session_id, upto_line, offset_ms, content, model_id, prompt_version)
                    values ($1, $2, 1, 0, '{}', 'demo', 'v')`, [alice, sid]);
    const mine = await asUser(app, alice, () => app.query("select count(*)::int as n from live_lines where session_id = $1", [sid]));
    expect(mine.rows[0].n).toBe(1);
    for (const table of ["live_lines", "live_insights"]) {
      const theirs = await asUser(app, bob, () => app.query(`select count(*)::int as n from ${table}`));
      expect(theirs.rows[0].n).toBe(0);
    }
  });
});

describe("approved notes", () => {
  it("cannot be edited after approval", async () => {
    const c = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Client C') returning id", [alice])).rows[0].id;
    const s = (await su.query("insert into sessions (therapist_id, client_id, capture_mode, status) values ($1, $2, 'recap', 'ready') returning id", [alice, c])).rows[0].id;
    await su.query("insert into notes (therapist_id, session_id, format, content_json, status, approved_at) values ($1, $2, 'SOAP', '{\"sections\":[]}', 'approved', now())", [alice, s]);
    await expect(asUser(app, alice, () => app.query("update notes set content_json = '{\"sections\":[{\"key\":\"x\",\"text\":\"y\"}]}' where session_id = $1", [s])))
      .rejects.toThrow(/note_locked/);
  });
});

describe("account deletion", () => {
  it("removes every row belonging to the therapist", async () => {
    const t = await makeTherapist(su);
    const c = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Z') returning id", [t])).rows[0].id;
    await su.query("insert into consents (therapist_id, client_id, consent_version, method) values ($1, $2, 'v1', 'signed_form')", [t, c]);
    await su.query("insert into sessions (therapist_id, client_id, capture_mode) values ($1, $2, 'recap')", [t, c]);
    await su.query('delete from "user" where id = $1', [t]);
    for (const table of ["therapists", "clients", "consents", "sessions"]) {
      const col = table === "therapists" ? "id" : "therapist_id";
      const { rows } = await su.query(`select count(*)::int as n from ${table} where ${col} = $1`, [t]);
      expect(rows[0].n, table).toBe(0);
    }
  });
});
