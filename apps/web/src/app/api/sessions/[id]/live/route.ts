import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { getSession, liveResearchAllowed } from "@/lib/session";
import { audit } from "@/lib/audit";

const UUID = /^[0-9a-f-]{36}$/;

// Live research mode (ADR-10). POST switches it on for a session that is about
// to record; GET returns what the worker has heard and its latest reads.
export async function POST(_req: Request, ctx: RouteContext<"/api/sessions/[id]/live">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!liveResearchAllowed(session.user.email)) return NextResponse.json({ error: "not_allowed" }, { status: 403 });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const ok = await withUser(session.user.id, async (db) => {
    const { rowCount } = await db.query(
      `update sessions set live_research = true
        where id = $1 and status in ('draft','recording') and capture_mode in ('online_call','in_person')`, [id],
    );
    if (rowCount) await audit(db, session.user.id, "session.live_research_on", "session", id);
    return Boolean(rowCount);
  });
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_recording" }, { status: 409 });
}

export async function GET(req: Request, ctx: RouteContext<"/api/sessions/[id]/live">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);
  if (!UUID.test(id) || !Number.isInteger(after) || after < 0) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const data = await withUser(session.user.id, async (db) => ({
    insights: (await db.query(
      "select id, offset_ms, content from live_insights where session_id = $1 and id > $2 order by id", [id, after],
    )).rows.map((r) => ({ ...r, id: Number(r.id) })),
    lines: (await db.query(
      "select id, speaker, offset_ms, text from live_lines where session_id = $1 order by offset_ms desc, id desc limit 10", [id],
    )).rows.reverse().map((r) => ({ ...r, id: Number(r.id) })),
  }));
  return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
}
