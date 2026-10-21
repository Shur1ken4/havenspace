import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";

// The drawing-board picture of a saved tool result (ADR-21). The therapist's own rows only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { therapist } = await requireTherapist();
  const row = await withUser(therapist.id, async (db) => (await db.query("select image from tool_results where id = $1 and image is not null", [id])).rows[0]);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(row.image), {
    headers: { "content-type": "image/png", "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
