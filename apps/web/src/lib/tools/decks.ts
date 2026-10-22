// Card decks for associative card work (ADR-21). Every built-in deck is ours to use:
//  • Pathways («Тропинки»): illustrations and questions made by our Clinical Lead for HavenSpace.
//  • Paintings and Faces: works in the public domain (CC0), Cleveland Museum of Art Open Access.
//  • Colours & shapes: our own generated artwork (scripts/decks/abstract.py).
//  • Words and Inner resources: our own wording (text-decks.ts).
// Therapists can also add their own decks (Settings → Card decks), kept private to them.
//
// A card is named by a "ref": "<deck>/<card>" for built-in decks and
// "u/<deck uuid>/<card uuid>" for a therapist's own deck. Older saved results use a
// bare number, which means the Paintings deck.
import art from "./art-deck.json";
import faces from "./faces-deck.json";
import pathways from "./pathways-deck.json";
import { RESOURCE_CARDS, WORD_CARDS } from "./text-decks";

export type L = { en: string; ru: string };
export type BuiltInDeckId = "pathways" | "art" | "faces" | "abstract" | "words" | "resources";

export type CardView =
  | { kind: "image"; src: string; alt: L | string; question?: L }
  | { kind: "word"; word: L; question?: L; tone: "words" | "resources" };

/** `cover`: the card shown for the deck in lists. */
type Deck = { id: BuiltInDeckId; kind: "image" | "word"; count: number; cover: string; card: (id: string) => CardView | null; ids: string[] };

const pad = (n: number) => String(n).padStart(2, "0");
const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((c) => [c.id, c]));
const artById = byId(art), facesById = byId(faces), pathwaysById = byId(pathways);
const artAlt = (c: { title: string; artist: string }) => `${c.title} — ${c.artist}`;

export const DECKS: Deck[] = [
  {
    id: "pathways", kind: "image", count: pathways.length, cover: "39", ids: pathways.map((c) => c.id),
    card: (id) => { const c = pathwaysById.get(id); return c ? { kind: "image", src: `/cards/pathways/${id}.jpg`, alt: c.title, question: c.question } : null; },
  },
  {
    id: "art", kind: "image", count: art.length, cover: "01", ids: art.map((c) => c.id),
    card: (id) => { const c = artById.get(id); return c ? { kind: "image", src: `/cards/art/${id}.jpg`, alt: artAlt(c) } : null; },
  },
  {
    id: "faces", kind: "image", count: faces.length, cover: "15", ids: faces.map((c) => c.id),
    card: (id) => { const c = facesById.get(id); return c ? { kind: "image", src: `/cards/faces/${id}.jpg`, alt: artAlt(c) } : null; },
  },
  {
    id: "abstract", kind: "image", count: 40, cover: "02", ids: Array.from({ length: 40 }, (_, i) => pad(i + 1)),
    card: (id) => (/^(0[1-9]|[1-3]\d|40)$/.test(id) ? { kind: "image", src: `/cards/abstract/${id}.svg`, alt: { en: `Colours and shapes, card ${Number(id)}`, ru: `Цвета и формы, карта ${Number(id)}` } } : null),
  },
  {
    id: "words", kind: "word", count: WORD_CARDS.length, cover: "01", ids: WORD_CARDS.map((_, i) => pad(i + 1)),
    card: (id) => { const w = WORD_CARDS[Number(id) - 1]; return /^\d\d$/.test(id) && w ? { kind: "word", word: w, tone: "words" } : null; },
  },
  {
    id: "resources", kind: "word", count: RESOURCE_CARDS.length, cover: "01", ids: RESOURCE_CARDS.map((_, i) => pad(i + 1)),
    card: (id) => { const r = RESOURCE_CARDS[Number(id) - 1]; return /^\d\d$/.test(id) && r ? { kind: "word", word: r.word, question: r.question, tone: "resources" } : null; },
  },
];
const DECKS_BY_ID = new Map(DECKS.map((d) => [d.id, d]));
export const DEFAULT_DECK: BuiltInDeckId = "pathways";

export const isBuiltInDeck = (id: string): id is BuiltInDeckId => DECKS_BY_ID.has(id as BuiltInDeckId);
/** Every card of a built-in deck, as refs. */
export const deckRefs = (deck: BuiltInDeckId) => DECKS_BY_ID.get(deck)!.ids.map((id) => `${deck}/${id}`);

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CUSTOM_REF = new RegExp(`^u/(${UUID})/(${UUID})$`);
export const customRef = (deckId: string, cardId: string) => `u/${deckId}/${cardId}`;
export const parseCustomRef = (ref: string) => { const m = CUSTOM_REF.exec(ref); return m ? { deckId: m[1], cardId: m[2] } : null; };
/** A therapist's own card image: in a call with a short-lived key, otherwise for the signed-in therapist. */
export const customCardSrc = (deckId: string, cardId: string, key?: string) =>
  `/api/decks/${deckId}/cards/${cardId}${key ? `?k=${encodeURIComponent(key)}` : ""}`;

/** What a card shows. `keys` holds the call's keys for the therapist's own decks. */
export function cardView(ref: string, keys?: Record<string, string>): CardView | null {
  if (/^\d\d$/.test(ref)) return DECKS_BY_ID.get("art")!.card(ref); // saved before there were several decks
  const custom = parseCustomRef(ref);
  if (custom) return { kind: "image", src: customCardSrc(custom.deckId, custom.cardId, keys?.[custom.deckId]), alt: { en: "Card", ru: "Карта" } };
  const [deck, id] = ref.split("/");
  return isBuiltInDeck(deck) ? DECKS_BY_ID.get(deck)!.card(id ?? "") : null;
}

export const isBuiltInRef = (ref: string) => !parseCustomRef(ref) && cardView(ref) !== null;
export const pick = (l: L | string, locale: string) => (typeof l === "string" ? l : locale.startsWith("ru") ? l.ru : l.en);
