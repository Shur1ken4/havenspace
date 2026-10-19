import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { getSession } from "@/lib/session";
import { storage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { isUuid } from "@/lib/ids";

// Opens one verification document: its owner, or an admin (row-level security decides).
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const doc = await withUser(session.user.id, async (db) => {
    const r = (await db.query("select path, mime, filename from therapist_documents where id = $1 and deleted_at is null", [id])).rows[0];
    if (r) await audit(db, session.user.id, "document.view", "document", id);
    return r;
  });
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body = await storage().get(doc.path);
  return new Response(new Blob([body as BlobPart], { type: doc.mime }), {
    headers: {
      "content-type": doc.mime,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const path = await withUser(session.user.id, async (db) => {
    const { rows } = await db.query(
      "update therapist_documents set deleted_at = now() where id = $1 and therapist_id = $2 and deleted_at is null returning path", [id, session.user.id]);
    if (rows[0]) await audit(db, session.user.id, "document.delete", "document", id);
    return rows[0]?.path as string | undefined;
  });
  if (path) await storage().remove([path]);
  return NextResponse.json({ ok: Boolean(path) });
}
