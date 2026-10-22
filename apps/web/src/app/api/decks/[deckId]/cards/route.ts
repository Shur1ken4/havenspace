import { NextResponse } from "next/server";
import { withUser } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { getSession, loadRole } from "@/lib/session";
import { audit } from "@/lib/audit";
import { MAX_CARDS } from "@/lib/decks-server";

// Adds one card to the therapist's own deck. The browser has already resized the
// picture; here we only check that it really is a picture and not too big.
const MAX_BYTES = 1_500_000;

function sniff(b: Buffer): string | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export async function POST(req: Request, ctx: RouteContext<"/api/decks/[deckId]/cards">) {
  const session = await getSession();
  if (!session || (await loadRole(session.user.id)) !== "therapist") return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { deckId } = await ctx.params;
  if (!isUuid(deckId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const url = new URL(req.url);
  const width = Math.round(Number(url.searchParams.get("w")));
  const height = Math.round(Number(url.searchParams.get("h")));
  if (!(width >= 16 && width <= 4000 && height >= 16 && height <= 4000)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const body = Buffer.from(await req.arrayBuffer());
  if (!body.length || body.length > MAX_BYTES) return NextResponse.json({ error: "too_big" }, { status: 413 });
  const mime = sniff(body);
  if (!mime) return NextResponse.json({ error: "not_an_image" }, { status: 415 });
  const uid = session.user.id;
  const res = await withUser(uid, async (db) => {
    const { rows: [d] } = await db.query("select (select count(*) from deck_cards c where c.deck_id = d.id)::int as n from card_decks d where d.id = $1", [deckId]);
    if (!d) return { status: 404 as const };
    if (d.n >= MAX_CARDS) return { status: 409 as const };
    const { rows: [c] } = await db.query(
      "insert into deck_cards (deck_id, therapist_id, image, mime, width, height) values ($1, $2, $3, $4, $5, $6) returning id",
      [deckId, uid, body, mime, width, height]);
    await audit(db, uid, "deck.card_add", "card_deck", deckId);
    return { status: 200 as const, id: c.id as string };
  }).catch(() => ({ status: 500 as const }));
  if (res.status !== 200) return NextResponse.json({ error: res.status === 409 ? "deck_full" : "failed" }, { status: res.status });
  return NextResponse.json({ id: res.id });
}
