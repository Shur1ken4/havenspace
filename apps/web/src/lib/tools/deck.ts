// The art card deck for associative card work (ADR-21): 56 paintings in the public
// domain (CC0) from the Cleveland Museum of Art Open Access collection, chosen to be
// open to many readings: windows, roads, rooms, the sea, people alone and together.
// Images live in public/cards/art. Titles are kept for credits, not shown during a session.
import cards from "./art-deck.json";

export type ArtCard = { id: string; file: string; w: number; h: number; title: string; artist: string; date: string; source: string; page: string; license: string };

export const ART_DECK: ArtCard[] = cards;
export const ART_DECK_IDS = ART_DECK.map((c) => c.id);
export const ART_DECK_SET = new Set(ART_DECK_IDS);
export const artCard = (id: string) => ART_DECK.find((c) => c.id === id);
export const artCardSrc = (id: string) => `/cards/art/${id}.jpg`;
