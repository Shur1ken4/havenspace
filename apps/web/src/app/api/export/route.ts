import { NextResponse } from "next/server";
import JSZip from "jszip";
import { withUser } from "@/lib/db";
import { getSession, isFresh, loadRole } from "@/lib/session";
import { audit } from "@/lib/audit";
import { fileResponse } from "@/lib/export";

// "Export all my data" (GDPR access/portability), or one client's data with ?client=<id>.
// Requires a recent sign-in.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  // A client of the client app gets their own data: diary and homework (ADR-14).
  if ((await loadRole(session.user.id)) !== "therapist") {
    const mine = await withUser(session.user.id, async (db) => ({
      exported_at: new Date().toISOString(),
      scope: "client_app",
      homework: (await db.query("select title, details, due_on, done_at, client_reply, created_at from assignments where client_id = current_client_id() order by created_at")).rows,
      next_sessions: (await db.query("select starts_at from appointments where client_id = current_client_id() order by starts_at")).rows,
      mood_diary: (await db.query("select mood, note, shared, created_at from mood_entries where client_id = current_client_id() order by created_at")).rows,
      messages: (await db.query("select case when from_client then 'me' else 'therapist' end as sender, body, created_at, read_at from messages where client_id = current_client_id() order by created_at")).rows,
    }));
    const zip = new JSZip();
    for (const [key, value] of Object.entries(mine)) zip.file(`${key}.json`, JSON.stringify(value, null, 2));
    return fileResponse(await zip.generateAsync({ type: "uint8array" }), `havenspace-my-data-${new Date().toISOString().slice(0, 10)}.zip`, "application/zip");
  }
  const clientId = new URL(req.url).searchParams.get("client");
  const back = clientId ? `/clients/${clientId}` : "/settings/privacy";
  if (!isFresh(session)) return NextResponse.redirect(new URL(`/login?reason=fresh&next=${encodeURIComponent(back)}`, req.url));
  if (clientId && !/^[0-9a-f-]{36}$/.test(clientId)) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const uid = session.user.id;
  const data = await withUser(uid, async (db) => {
    const scope = clientId ? "where client_id = $1" : "";
    const sScope = clientId ? "where session_id in (select id from sessions where client_id = $1)" : "";
    const args = clientId ? [clientId] : [];
    const q = async (sql: string) => (await db.query(sql, args)).rows;
    const out = {
      exported_at: new Date().toISOString(),
      scope: clientId ? "client" : "account",
      therapist: clientId ? undefined : (await db.query(
        "select id, display_name, profession, accreditation_stage, modalities, note_format, language, audio_retention, voice_enrolled_at, created_at from therapists",
      )).rows[0],
      clients: await q(`select id, pseudonym, status, created_at from clients ${clientId ? "where id = $1" : ""}`),
      consents: await q(`select * from consents ${scope}`),
      sessions: await q(`select id, client_id, capture_mode, status, started_at, ended_at, duration_seconds, language, speaker_names, recap_text, audio_deleted_at from sessions ${scope}`),
      transcript_segments: await q(`select session_id, idx, speaker, start_ms, end_ms, text from transcript_segments ${sScope} order by session_id, idx`),
      notes: await q(`select session_id, format, content_json, status, approved_at, model_id, prompt_version from notes ${sScope}`),
      live_research_insights: await q(`select session_id, offset_ms, content, model_id, prompt_version, created_at from live_insights ${sScope} order by session_id, id`),
      live_research_lines: await q(`select session_id, speaker, offset_ms, text from live_lines ${sScope} order by session_id, offset_ms, id`),
      reflections: await q(`select session_id, modality, content_json, model_id, prompt_version, created_at from reflections ${sScope}`),
      client_timeline_items: await q(`select * from client_timeline_items ${scope}`),
      // Therapy tools saved from video sessions (ADR-21); drawing-board pictures go in tools/ as PNG files.
      tool_results: await q(`select id, client_id, session_id, kind, content, created_at from tool_results ${scope} order by created_at`),
      messages: await q(`select id, client_id, from_client, body, created_at, read_at from messages ${scope} order by created_at`),
      supervision_packs: clientId ? undefined : await q("select month, content_json, status, created_at from supervision_packs"),
      supervision_hours: clientId ? undefined : await q("select * from supervision_hours"),
      audit_log: clientId ? undefined : await q("select action, entity_type, entity_id, at from audit_log order by at desc limit 5000"),
    };
    const pictures = await q(`select id, image from tool_results ${clientId ? "where client_id = $1 and" : "where"} image is not null`);
    await audit(db, uid, clientId ? "client.export" : "account.export", clientId ? "client" : "therapist", clientId ?? uid);
    return { out, pictures };
  });

  const zip = new JSZip();
  zip.file("README.txt", "HavenSpace data export.\nEach file is JSON. Audio is not included because it is deleted after transcription.\nDrawings from the drawing board are in tools/, named by their tool_results id.\n");
  for (const [key, value] of Object.entries(data.out)) if (value !== undefined) zip.file(`${key}.json`, JSON.stringify(value, null, 2));
  for (const p of data.pictures) zip.file(`tools/${p.id}.png`, new Uint8Array(p.image));
  const body = await zip.generateAsync({ type: "uint8array" });
  return fileResponse(body, `havenspace-${clientId ? "client" : "account"}-export-${new Date().toISOString().slice(0, 10)}.zip`, "application/zip");
}
