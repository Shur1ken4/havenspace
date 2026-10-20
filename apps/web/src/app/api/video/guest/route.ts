import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { hashGuestToken, isGuestToken, videoEnabled, videoServerUrl, videoToken } from "@/lib/video";

// Entry pass for someone holding a one-time join link (no account needed).
// The link stops working when the therapist ends the session or makes a new one.
export async function POST(req: Request) {
  if (!videoEnabled()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!isGuestToken(token)) return NextResponse.json({ error: "gone" }, { status: 410 });
  const { rows: [room] } = await pool.query("select * from video_guest_room($1)", [hashGuestToken(token)]);
  if (!room) return NextResponse.json({ error: "gone" }, { status: 410 });
  // Same identity as a client-app join: a forwarded link replaces, never adds, a person.
  const lk = await videoToken(room.room_name, "client", "Client");
  return NextResponse.json({ url: videoServerUrl(), token: lk }, { headers: { "cache-control": "no-store" } });
}
