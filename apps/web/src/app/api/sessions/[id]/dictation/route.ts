import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { getSession } from "@/lib/session";

// Queue transcription of a dictated recap segment.
export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/dictation">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { segment } = await req.json().catch(() => ({ segment: 0 }));
  const uid = session.user.id;
  const ok = await withUser(uid, async (db) => {
    const { rowCount } = await db.query(
      "update sessions set dictation_status = 'transcribing', dictation_text = null where id = $1 and capture_mode = 'recap' and status = 'draft'", [id],
    );
    if (!rowCount) return false;
    await db.query("insert into jobs (therapist_id, session_id, kind, payload) values ($1, $2, 'transcribe_dictation', $3)", [uid, id, { segment: Number(segment) || 0 }]);
    return true;
  });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_allowed" }, { status: 409 });
}

// The text has been copied into the recap box: clear it from the server.
export async function DELETE(_req: Request, ctx: RouteContext<"/api/sessions/[id]/dictation">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  await withUser(session.user.id, (db) => db.query("update sessions set dictation_status = null, dictation_text = null where id = $1", [id]));
  return NextResponse.json({ ok: true });
}
