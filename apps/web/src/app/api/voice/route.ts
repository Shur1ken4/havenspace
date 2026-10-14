import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { getSession } from "@/lib/session";
import { storage } from "@/lib/storage";
import { audit } from "@/lib/audit";

const MAX_BYTES = 2 * 1024 * 1024;

// Voice enrolment: a few seconds of the therapist's own voice. The worker
// turns it into a voice fingerprint and deletes the audio straight away.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return NextResponse.json({ error: "bad_size" }, { status: 400 });
  const uid = session.user.id;
  const mime = (req.headers.get("content-type") ?? "audio/webm").split(";")[0];
  const key = `audio/${uid}/voice/${randomUUID()}.${mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "m4a" : "webm"}`;
  await storage().put(key, body, mime);
  await withUser(uid, async (db) => {
    const { rows } = await db.query(
      `insert into audio_chunks (therapist_id, session_id, track, segment, seq, path, bytes, mime)
       values ($1, null, 'calibration', 0, 0, $2, $3, $4) returning id`,
      [uid, key, body.byteLength, mime],
    );
    await db.query(`insert into jobs (therapist_id, kind, payload) values ($1, 'enrol_voice', $2)`, [uid, { chunk_id: rows[0].id }]);
    await audit(db, uid, "voice.enrol", "therapist", uid);
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const uid = session.user.id;
  await withUser(uid, async (db) => {
    await db.query("update therapists set voice_embedding = null, voice_enrolled_at = null where id = $1", [uid]);
    await audit(db, uid, "voice.delete", "therapist", uid);
  });
  return NextResponse.json({ ok: true });
}
