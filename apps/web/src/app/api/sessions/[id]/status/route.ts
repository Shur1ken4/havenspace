import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { getSession } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]/status">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const row = await withUser(session.user.id, async (db) =>
    (await db.query(
      `select s.status, s.stage, s.error_code, s.dictation_status, s.dictation_text,
              -- How long a finished recording has waited for the processing server to pick it up.
              case when s.status = 'uploaded' and s.stage = 'queued' then extract(epoch from now() - coalesce(s.ended_at, s.updated_at))::int end as queued_seconds,
              coalesce((select max(segment) + 1 from audio_chunks a where a.session_id = s.id), 0) as next_segment
         from sessions s where s.id = $1`, [id],
    )).rows[0],
  );
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(row, { headers: { "cache-control": "no-store" } });
}
