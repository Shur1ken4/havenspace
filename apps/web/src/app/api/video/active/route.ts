import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { getSession } from "@/lib/session";

// For the client app: is my therapist waiting for me in a video room right now?
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const row = await withUser(session.user.id, async (db) =>
    (await db.query(
      "select id from video_rooms where client_id = current_client_id() and ended_at is null order by created_at desc limit 1",
    )).rows[0]);
  return NextResponse.json({ roomId: row?.id ?? null }, { headers: { "cache-control": "no-store" } });
}
