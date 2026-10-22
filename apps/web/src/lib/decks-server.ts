import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "./db";
import { customRef } from "./tools/decks";

// A therapist's own card decks (db/migrations/0022_card_decks.sql).

export type MyDeck = { id: string; name: string; refs: string[]; cover: string | null; key: string };

const KEY_HOURS = 12;
const secret = () => {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return s;
};
const sign = (deckId: string, exp: number) => createHmac("sha256", secret()).update(`deck-link:${deckId}:${exp}`).digest("base64url");

/** A key that lets the other person in a call see this deck's images for a few hours. */
export function deckKey(deckId: string): string {
  const exp = Math.floor(Date.now() / 1000) + KEY_HOURS * 3600;
  return `${exp}.${sign(deckId, exp)}`;
}

export function deckKeyValid(deckId: string, key: string | null): boolean {
  const m = /^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(key ?? "");
  if (!m || Number(m[1]) < Date.now() / 1000) return false;
  const want = Buffer.from(sign(deckId, Number(m[1])));
  const got = Buffer.from(m[2]);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** The signed-in therapist's decks, oldest first, each with its cards and a call key. */
export async function loadMyDecks(db: Db): Promise<MyDeck[]> {
  const { rows } = await db.query(
    `select d.id, d.name, coalesce(array_agg(c.id order by c.created_at) filter (where c.id is not null), '{}') as cards
       from card_decks d left join deck_cards c on c.deck_id = d.id group by d.id order by d.created_at`);
  return rows.map((d) => {
    const refs = (d.cards as string[]).map((c) => customRef(d.id, c));
    return { id: d.id, name: d.name, refs, cover: refs[0] ?? null, key: deckKey(d.id) };
  });
}

export const MAX_DECKS = 20;
export const MAX_CARDS = 100;
