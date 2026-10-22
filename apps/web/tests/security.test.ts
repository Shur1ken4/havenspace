import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { admin, appRole, asUser, makeTherapist, makeUser } from "./db";

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

  it("the app can add to the sign-up list; only admins can read it", async () => {
    await app.query("insert into pilot_signups (email, profession) values ($1, 'counsellor')", [`${crypto.randomUUID()}@example.test`]);
    expect((await app.query("select * from pilot_signups")).rows).toHaveLength(0);
    expect((await asUser(app, alice, () => app.query("select * from pilot_signups"))).rows).toHaveLength(0);
    await expect(app.query("update pilot_signups set name = 'x'")).rejects.toThrow(/permission denied/);
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

describe("pilot access", () => {
  it("a pending account cannot add clients until an admin approves it", async () => {
    const carol = await makeTherapist(su);
    await su.query("update therapists set access_status = 'pending' where id = $1", [carol]);
    const add = () => asUser(app, carol, () => app.query("insert into clients (therapist_id, pseudonym) values ($1, 'X')", [carol]));
    await expect(add()).rejects.toThrow(/access_pending/);
    // A therapist cannot approve themselves.
    await asUser(app, carol, () => app.query("update therapists set access_status = 'approved' where id = $1", [carol]))
      .catch(() => {});
    expect((await su.query("select access_status from therapists where id = $1", [carol])).rows[0].access_status).toBe("pending");
    // An admin can.
    const adminEmail = (await su.query('select email from "user" where id = $1', [alice])).rows[0].email;
    await su.query("insert into admins (email) values (lower($1))", [adminEmail]);
    const seen = await asUser(app, alice, () => app.query("select id from therapists where id = $1", [carol]));
    expect(seen.rows).toHaveLength(1);
    await asUser(app, alice, () => app.query("update therapists set access_status = 'approved' where id = $1", [carol]));
    await add();
    await su.query("delete from admins");
  });

  it("an account paused after approval cannot upload audio or queue work", async () => {
    const erin = await makeTherapist(su);
    const upload = () => asUser(app, erin, () => app.query(
      "insert into audio_chunks (therapist_id, session_id, track, segment, seq, path, bytes, mime) values ($1, null, 'calibration', 0, 0, 'x', 1, 'audio/webm')", [erin]));
    const queue = () => asUser(app, erin, () => app.query("insert into jobs (therapist_id, kind, payload) values ($1, 'enrol_voice', '{}')", [erin]));
    await upload();
    await queue();
    await su.query("update therapists set access_status = 'declined' where id = $1", [erin]);
    await expect(upload()).rejects.toThrow(/access_pending/);
    await expect(queue()).rejects.toThrow(/access_pending/);
    // The worker is never blocked.
    await su.query("insert into jobs (therapist_id, kind, payload) values ($1, 'enrol_voice', '{}')", [erin]);
  });

  it("an invited email is approved automatically", async () => {
    const dan = await makeTherapist(su);
    await su.query("update therapists set access_status = 'pending' where id = $1", [dan]);
    const email = (await su.query('select email from "user" where id = $1', [dan])).rows[0].email;
    await su.query("insert into access_invites (email) values (lower($1))", [email]);
    const r = await asUser(app, dan, () => app.query("select request_access() as s"));
    expect(r.rows[0].s).toBe("approved");
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

describe("client app", () => {
  const hash = () => `h-${Math.random().toString(36).slice(2)}`;
  const invite = async (therapist: string, client: string, h: string, expires = "now() + interval '7 days'") =>
    asUser(app, therapist, () => app.query(`insert into client_invites (therapist_id, client_id, code_hash, expires_at) values ($1, $2, $3, ${expires})`, [therapist, client, h]));
  const redeem = (user: string, h: string) => asUser(app, user, () => app.query("select redeem_client_invite($1)", [h]));

  it("links a client by a one-time invite and shows them only their own homework", async () => {
    const h = hash();
    await invite(alice, aliceClient, h);
    expect((await app.query("select client_invite_preview($1) as n", [h])).rows[0].n).not.toBeNull();
    const carl = await makeUser(su);
    await redeem(carl, h);
    // Single use.
    await expect(redeem(await makeUser(su), h)).rejects.toThrow(/invite_invalid/);

    const other = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Client Other') returning id", [alice])).rows[0].id;
    await asUser(app, alice, () => app.query(
      "insert into assignments (therapist_id, client_id, title) values ($1, $2, 'Mine'), ($1, $3, 'Not mine')", [alice, aliceClient, other]));
    const seen = await asUser(app, carl, () => app.query("select title from assignments"));
    expect(seen.rows.map((r) => r.title)).toEqual(["Mine"]);
    // Nothing clinical is visible to a client.
    for (const table of ["clients", "sessions", "notes", "transcript_segments", "reflections", "client_timeline_items", "therapists", "consents"]) {
      const { rows } = await asUser(app, carl, () => app.query(`select count(*)::int as n from ${table}`));
      expect(rows[0].n, table).toBe(0);
    }
    // A client cannot write homework, only mark their own done.
    await expect(asUser(app, carl, () => app.query("insert into assignments (therapist_id, client_id, title) values ($1, $2, 'x')", [alice, aliceClient]))).rejects.toThrow();
    const mine = seen.rows.length && (await asUser(app, alice, () => app.query("select id from assignments where title = 'Mine'"))).rows[0].id;
    await asUser(app, carl, () => app.query("select client_update_assignment($1, true, 'Did it')", [mine]));
    expect((await asUser(app, carl, () => app.query("update assignments set title = 'hacked' where id = $1", [mine]))).rowCount).toBe(0);
    const notMine = (await asUser(app, alice, () => app.query("select id from assignments where title = 'Not mine'"))).rows[0].id;
    await expect(asUser(app, carl, () => app.query("select client_update_assignment($1, true, '')", [notMine]))).rejects.toThrow(/not_found/);
  });

  it("shows the therapist only diary entries the client chose to share", async () => {
    const c = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Diary') returning id", [alice])).rows[0].id;
    const h = hash();
    await invite(alice, c, h);
    const dee = await makeUser(su);
    await redeem(dee, h);
    await asUser(app, dee, () => app.query(
      "insert into mood_entries (therapist_id, client_id, client_user_id, mood, note, shared) values ($1, $2, $3, 4, 'shared', true), ($1, $2, $3, 2, 'private', false)", [alice, c, dee]));
    expect((await asUser(app, alice, () => app.query("select note from mood_entries where client_id = $1", [c]))).rows.map((r) => r.note)).toEqual(["shared"]);
    expect((await asUser(app, bob, () => app.query("select note from mood_entries"))).rows).toHaveLength(0);
    // A client cannot file entries under someone else's record.
    await expect(asUser(app, dee, () => app.query(
      "insert into mood_entries (therapist_id, client_id, client_user_id, mood) values ($1, $2, $3, 3)", [alice, aliceClient, dee]))).rejects.toThrow();
    // Disconnected: the client sees nothing any more.
    await asUser(app, alice, () => app.query("select revoke_client_link($1)", [c]));
    await asUser(app, alice, () => app.query("insert into assignments (therapist_id, client_id, title) values ($1, $2, 'After')", [alice, c]));
    expect((await asUser(app, dee, () => app.query("select * from assignments"))).rows).toHaveLength(0);
  });

  it("refuses expired invites, therapist accounts, and links made by hand", async () => {
    const c = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Edge') returning id", [alice])).rows[0].id;
    const old = hash();
    await invite(alice, c, old, "now() - interval '1 minute'");
    await expect(redeem(await makeUser(su), old)).rejects.toThrow(/invite_invalid/);
    const h = hash();
    await invite(alice, c, h);
    await expect(redeem(bob, h)).rejects.toThrow(/therapist_account/);
    // The app cannot write client links directly; only the functions can.
    await expect(asUser(app, alice, () => app.query("insert into client_accounts (user_id, therapist_id, client_id) values ($1, $2, $3)", [bob, alice, c]))).rejects.toThrow(/permission denied/);
    // A pending therapist cannot send invites.
    const pat = await makeTherapist(su);
    const pc = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'P') returning id", [pat])).rows[0].id;
    await su.query("update therapists set access_status = 'pending' where id = $1", [pat]);
    await expect(invite(pat, pc, hash())).rejects.toThrow(/access_pending/);
  });

  it("lets a client delete their own account and diary", async () => {
    const c = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Leaver') returning id", [alice])).rows[0].id;
    const h = hash();
    await invite(alice, c, h);
    const lee = await makeUser(su);
    await redeem(lee, h);
    await asUser(app, lee, () => app.query("insert into mood_entries (therapist_id, client_id, client_user_id, mood) values ($1, $2, $3, 3)", [alice, c, lee]));
    await asUser(app, lee, () => app.query("select leave_client_app()"));
    expect((await su.query('select count(*)::int as n from "user" where id = $1', [lee])).rows[0].n).toBe(0);
    expect((await su.query("select count(*)::int as n from mood_entries where client_user_id = $1", [lee])).rows[0].n).toBe(0);
    expect((await su.query("select count(*)::int as n from clients where id = $1", [c])).rows[0].n).toBe(1);
  });
});

describe("video rooms", () => {
  const link = async (therapist: string, client: string) => {
    const h = `v-${Math.random().toString(36).slice(2)}`;
    await asUser(app, therapist, () => app.query(
      "insert into client_invites (therapist_id, client_id, code_hash, expires_at) values ($1, $2, $3, now() + interval '1 day')", [therapist, client, h]));
    const user = await makeUser(su);
    await asUser(app, user, () => app.query("select redeem_client_invite($1)", [h]));
    return user;
  };

  it("only the therapist and their own linked client can see a room", async () => {
    const client = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Video A') returning id", [alice])).rows[0].id;
    const otherClient = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Video B') returning id", [alice])).rows[0].id;
    const room = (await asUser(app, alice, () => app.query("insert into video_rooms (therapist_id, client_id) values ($1, $2) returning id", [alice, client]))).rows[0].id;
    const dana = await link(alice, client);
    const erin = await link(alice, otherClient);
    const sees = async (u: string) => (await asUser(app, u, () => app.query("select id from video_rooms where id = $1", [room]))).rows.length;
    expect(await sees(alice)).toBe(1);
    expect(await sees(dana)).toBe(1);
    expect(await sees(erin)).toBe(0);
    expect(await sees(bob)).toBe(0);
    // Nobody but the therapist can open rooms, and a client cannot end or change one.
    await expect(asUser(app, dana, () => app.query("insert into video_rooms (therapist_id, client_id) values ($1, $2)", [alice, client]))).rejects.toThrow();
    expect((await asUser(app, dana, () => app.query("update video_rooms set ended_at = now() where id = $1", [room]))).rowCount).toBe(0);
    // Once ended, the client no longer sees it.
    await asUser(app, alice, () => app.query("update video_rooms set ended_at = now() where id = $1", [room]));
    expect(await sees(dana)).toBe(0);
  });

  it("a one-time link works only while the room is open and only with the right code", async () => {
    const client = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Video C') returning id", [alice])).rows[0].id;
    const right = `right-${randomUUID()}`; // unique per run: the test database keeps old rows
    const room = (await asUser(app, alice, () => app.query(
      "insert into video_rooms (therapist_id, client_id, guest_token_hash, guest_expires_at) values ($1, $2, $3, now() + interval '4 hours') returning id",
      [alice, client, right]))).rows[0].id;
    const lookup = async (h: string) => (await app.query("select * from video_guest_room($1)", [h])).rows;
    expect(await lookup(right)).toHaveLength(1);
    expect(Object.keys((await lookup(right))[0]).sort()).toEqual(["room_id", "room_name", "therapist_name"]);
    expect(await lookup("wrong")).toHaveLength(0);
    // Signed-out visitors can't read rooms directly, only through the function.
    expect((await app.query("select id from video_rooms")).rows).toHaveLength(0);
    await asUser(app, alice, () => app.query("update video_rooms set ended_at = now() where id = $1", [room]));
    expect(await lookup(right)).toHaveLength(0);
  });

  it("a paused account cannot open video rooms", async () => {
    const paused = await makeTherapist(su);
    const client = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Video D') returning id", [paused])).rows[0].id;
    await su.query("update therapists set access_status = 'declined' where id = $1", [paused]);
    await expect(asUser(app, paused, () => app.query("insert into video_rooms (therapist_id, client_id) values ($1, $2)", [paused, client]))).rejects.toThrow(/access_pending/);
  });
});

describe("therapy tool results (ADR-21)", () => {
  it("are the therapist's own, only for their own clients, and invisible to client accounts", async () => {
    const mine = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Tools A') returning id", [alice])).rows[0].id;
    const theirs = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Tools B') returning id", [bob])).rows[0].id;
    const save = (therapist: string, client: string) => asUser(app, therapist, () => app.query(
      "insert into tool_results (therapist_id, client_id, kind, content) values ($1, $2, 'scale', '{\"value\":7}') returning id", [therapist, client]));
    const row = (await save(alice, mine)).rows[0].id;
    // Not for someone else's client, and not as someone else.
    await expect(save(alice, theirs)).rejects.toThrow();
    await expect(asUser(app, bob, () => app.query(
      "insert into tool_results (therapist_id, client_id, kind, content) values ($1, $2, 'scale', '{}')", [alice, mine]))).rejects.toThrow();
    const sees = async (u: string) => (await asUser(app, u, () => app.query("select id from tool_results where id = $1", [row]))).rows.length;
    expect(await sees(alice)).toBe(1);
    expect(await sees(bob)).toBe(0);
    // A client who uses the client app doesn't see the therapist's tool results.
    const h = `t-${Math.random().toString(36).slice(2)}`;
    await asUser(app, alice, () => app.query(
      "insert into client_invites (therapist_id, client_id, code_hash, expires_at) values ($1, $2, $3, now() + interval '1 day')", [alice, mine, h]));
    const clientUser = await makeUser(su);
    await asUser(app, clientUser, () => app.query("select redeem_client_invite($1)", [h]));
    expect(await sees(clientUser)).toBe(0);
    // Bob can't delete Alice's result; deleting the client removes it.
    expect((await asUser(app, bob, () => app.query("delete from tool_results where id = $1", [row]))).rowCount).toBe(0);
    await su.query("delete from clients where id = $1", [mine]);
    expect((await su.query("select 1 from tool_results where id = $1", [row])).rows).toHaveLength(0);
  });
});

describe("admin test client (switch between views)", () => {
  it("only admins get one, and only for themselves", async () => {
    const admin = await makeTherapist(su);
    const plain = await makeTherapist(su);
    const email = (await su.query('select email from "user" where id = $1', [admin])).rows[0].email;
    await su.query("insert into admins (email) values (lower($1)) on conflict do nothing", [email]);
    const clientId = (await asUser(app, admin, () => app.query("select admin_test_client('Test client (you)') as id"))).rows[0].id;
    // Same client the second time, linked to the admin's own login and owned by them.
    expect((await asUser(app, admin, () => app.query("select admin_test_client('x') as id"))).rows[0].id).toBe(clientId);
    const link = (await su.query("select therapist_id, client_id from client_accounts where user_id = $1", [admin])).rows[0];
    expect(link).toEqual({ therapist_id: admin, client_id: clientId });
    // Not for a non-admin, and an admin can't link themselves to someone else's client.
    await expect(asUser(app, plain, () => app.query("select admin_test_client('x')"))).rejects.toThrow(/not_admin/);
    const other = (await su.query("insert into clients (therapist_id, pseudonym) values ($1, 'Other') returning id", [plain])).rows[0].id;
    await expect(asUser(app, admin, () => app.query(
      "insert into client_accounts (user_id, therapist_id, client_id) values ($1, $2, $3) on conflict (user_id) do update set therapist_id = excluded.therapist_id, client_id = excluded.client_id",
      [admin, plain, other]))).rejects.toThrow();
  });
});

describe("database file storage", () => {
  it("each therapist can only store and read files under their own folder", async () => {
    const key = `audio/${alice}/s1/mic/000-000000.bin`;
    await asUser(app, alice, () => app.query("insert into blob_store (key, body) values ($1, '\\x00')", [key]));
    expect((await asUser(app, alice, () => app.query("select key from blob_store where key = $1", [key]))).rows).toHaveLength(1);
    expect((await asUser(app, bob, () => app.query("select key from blob_store where key = $1", [key]))).rows).toHaveLength(0);
    expect((await app.query("select key from blob_store")).rows).toHaveLength(0);
    await expect(asUser(app, bob, () => app.query("insert into blob_store (key, body) values ($1, '\\x00')", [`audio/${alice}/x.bin`]))).rejects.toThrow(/row-level security/);
    await expect(asUser(app, alice, () => app.query("insert into blob_store (key, body) values ($1, '\\x00')", [`secrets/${alice}/x.bin`]))).rejects.toThrow(/row-level security/);
    await expect(asUser(app, alice, () => app.query("insert into blob_store (key, body) values ($1, '\\x00')", [`audio/${alice}/../x.bin`]))).rejects.toThrow();
  });
});
