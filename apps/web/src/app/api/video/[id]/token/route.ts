import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { getSession, loadRole } from "@/lib/session";
import { videoEnabled, videoServerUrl, videoToken } from "@/lib/video";

// An entry pass to one video room. Row-level security decides who can see the
// room at all: its therapist, or the linked client while the room is open.
export async function GET(_req: Request, ctx: RouteContext<"/api/video/[id]/token">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!videoEnabled()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const role = await loadRole(session.user.id);
  const room = await withUser(session.user.id, async (db) =>
    (await db.query("select room_name, therapist_id, ended_at from video_rooms where id = $1", [id])).rows[0]);
  if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (room.ended_at) return NextResponse.json({ error: "ended" }, { status: 410 });
  const isTherapist = role === "therapist" && room.therapist_id === session.user.id;
  if (!isTherapist && role !== "client") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Generic names: each side's screen labels the other person from its own data.
  const token = await videoToken(room.room_name, isTherapist ? "therapist" : "client", isTherapist ? "Therapist" : "Client");
  return NextResponse.json({ url: videoServerUrl(), token }, { headers: { "cache-control": "no-store" } });
}
