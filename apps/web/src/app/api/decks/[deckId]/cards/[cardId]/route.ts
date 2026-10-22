import { NextResponse } from "next/server";
import { pool, withUser } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { getSession, loadRole } from "@/lib/session";
import { deckKeyValid } from "@/lib/decks-server";

// One card image from a therapist's own deck. Either the therapist themselves, or the
// other person in their call holding the short-lived key the therapist's screen sent.
export async function GET(req: Request, ctx: RouteContext<"/api/decks/[deckId]/cards/[cardId]">) {
  const { deckId, cardId } = await ctx.params;
  if (!isUuid(deckId) || !isUuid(cardId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const key = new URL(req.url).searchParams.get("k");
  let row: { image: Buffer; mime: string } | undefined;
  if (key) {
    if (!deckKeyValid(deckId, key)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    row = (await pool.query("select * from deck_card_image($1, $2)", [deckId, cardId])).rows[0];
  } else {
    const session = await getSession();
    if (!session || (await loadRole(session.user.id)) !== "therapist") return NextResponse.json({ error: "unauthorised" }, { status: 401 });
    row = await withUser(session.user.id, async (db) => (await db.query(
      "select image, mime from deck_cards where id = $1 and deck_id = $2", [cardId, deckId])).rows[0]);
  }
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(row.image), {
    headers: { "content-type": row.mime, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
  });
}
