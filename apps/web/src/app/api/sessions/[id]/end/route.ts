import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

// "End session": marks the recording complete and queues processing.
export async function POST(req: Request, ctx: RouteContext<"/api/sessions/[id]/end">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const duration = Math.max(0, Math.min(6 * 3600, Math.round(Number(body.durationSeconds) || 0)));
  const uid = session.user.id;
  const ok = await withUser(uid, async (db) => {
    const { rows: [c] } = await db.query("select count(*)::int as n from audio_chunks where session_id = $1 and track <> 'calibration'", [id]);
    if (!c.n) return false;
    const { rowCount } = await db.query(
      `update sessions set status = 'uploaded', stage = 'queued', ended_at = now(),
              duration_seconds = coalesce(nullif($2, 0), extract(epoch from now() - started_at)::int)
        where id = $1 and status in ('draft','recording')`,
      [id, duration],
    );
    if (!rowCount) return false;
    await db.query("insert into jobs (therapist_id, session_id, kind) values ($1, $2, 'process_session')", [uid, id]);
    await audit(db, uid, "session.end", "session", id);
    return true;
  });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "nothing_recorded" }, { status: 409 });
}
