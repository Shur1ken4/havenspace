import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { getSession, loadRole } from "@/lib/session";
import { storage } from "@/lib/storage";
import { audit } from "@/lib/audit";

// Optional verification documents a therapist adds while applying (ADR-14):
// a licence, membership card or student letter. Seen only by them and admins,
// and deleted 30 days after the access decision.
const MAX_BYTES = 4 * 1024 * 1024; // hosting request limit; photos are shrunk in the browser first
const MAX_FILES = 5;

function sniff(b: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | null {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  return null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if ((await loadRole(session.user.id)) !== "therapist") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) return NextResponse.json({ error: "bad_size" }, { status: 400 });
  const mime = sniff(body);
  if (!mime) return NextResponse.json({ error: "bad_type" }, { status: 400 });
  const filename = (decodeURIComponent(req.headers.get("x-filename") ?? "document").replace(/[^\p{L}\p{N} ._()-]/gu, "_").slice(0, 120)) || "document";
  const uid = session.user.id;
  const key = `documents/${uid}/${randomUUID()}.${mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg"}`;

  const count = await withUser(uid, async (db) => {
    await db.query("insert into therapists (id) values ($1) on conflict (id) do nothing", [uid]);
    return (await db.query("select count(*)::int as n from therapist_documents where deleted_at is null")).rows[0].n as number;
  });
  if (count >= MAX_FILES) return NextResponse.json({ error: "too_many" }, { status: 400 });

  await storage().put(key, body, mime);
  const row = await withUser(uid, async (db) => {
    const { rows } = await db.query(
      "insert into therapist_documents (therapist_id, path, filename, mime, bytes) values ($1, $2, $3, $4, $5) returning id, filename, created_at",
      [uid, key, filename, mime, body.byteLength],
    );
    await audit(db, uid, "document.upload", "document", rows[0].id);
    return rows[0];
  }).catch(async (err) => { await storage().remove([key]); throw err; });
  return NextResponse.json(row);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const rows = await withUser(session.user.id, async (db) =>
    (await db.query("select id, filename, created_at from therapist_documents where therapist_id = $1 and deleted_at is null order by created_at", [session.user.id])).rows);
  return NextResponse.json(rows, { headers: { "cache-control": "no-store" } });
}
