import { NextResponse } from "next/server";
import { isDbError, withUser } from "@/lib/db";
import { getSession } from "@/lib/session";
import { storage } from "@/lib/storage";

const MAX_CHUNK = 4 * 1024 * 1024; // stays under hosting request limits
const TRACKS = new Set(["mic", "tab", "room", "upload", "calibration", "dictation"]);
const UUID = /^[0-9a-f-]{36}$/;

// Receives one piece of audio. Recording uploads a piece every ~10 seconds, so
// a closed or crashed tab loses at most a few seconds. Uploading the same piece
// twice is harmless (idempotent on session/track/segment/seq).
export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/chunks">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const track = url.searchParams.get("track") ?? "";
  const segment = Number(url.searchParams.get("segment"));
  const seq = Number(url.searchParams.get("seq"));
  if (!UUID.test(id) || !TRACKS.has(track) || !Number.isInteger(segment) || !Number.isInteger(seq) || segment < 0 || seq < 0 || segment > 1000 || seq > 100000) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_CHUNK) return NextResponse.json({ error: "bad_size" }, { status: 400 });
  const mime = (req.headers.get("content-type") ?? "application/octet-stream").split(";")[0];
  const uid = session.user.id;

  const ok = await withUser(uid, async (db) => {
    const { rows } = await db.query("select status, capture_mode from sessions where id = $1", [id]);
    if (!rows[0]) return false;
    // Recaps accept only the therapist's dictation, and only while still a draft.
    if (rows[0].capture_mode === "recap") return track === "dictation" && rows[0].status === "draft";
    return track !== "dictation" && ["draft", "recording"].includes(rows[0].status);
  });
  if (!ok) return NextResponse.json({ error: "not_recording" }, { status: 409 });

  const key = `audio/${uid}/${id}/${track}/${String(segment).padStart(3, "0")}-${String(seq).padStart(6, "0")}.bin`;
  await storage().put(key, body, mime);
  try {
    await withUser(uid, async (db) => {
      await db.query(
        `insert into audio_chunks (therapist_id, session_id, track, segment, seq, path, bytes, mime)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (session_id, track, segment, seq) do update set bytes = excluded.bytes, path = excluded.path`,
        [uid, id, track, segment, seq, key, body.byteLength, mime],
      );
      if (track === "dictation") await db.query("update sessions set dictation_status = 'recording' where id = $1", [id]);
      else await db.query("update sessions set status = 'recording' where id = $1 and status = 'draft'", [id]);
    });
  } catch (err) {
    await storage().remove([key]);
    if (isDbError(err, "consent_required")) return NextResponse.json({ error: "consent_required" }, { status: 403 });
    throw err;
  }
  return NextResponse.json({ ok: true });
}
