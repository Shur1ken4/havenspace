"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { audit } from "@/lib/audit";
import { MAX_DECKS } from "@/lib/decks-server";

export type DeckFormState = { error?: "name" | "rights" | "tooMany" | "failed"; id?: string };

/** A new, empty deck. The therapist must confirm they may use the pictures. */
export async function createDeck(_prev: DeckFormState, form: FormData): Promise<DeckFormState> {
  const { therapist } = await requireTherapist();
  const name = z.string().trim().min(1).max(60).safeParse(form.get("name"));
  if (!name.success) return { error: "name" };
  if (form.get("rights") !== "on") return { error: "rights" };
  const res = await withUser(therapist.id, async (db) => {
    const { rows: [n] } = await db.query("select count(*)::int as n from card_decks");
    if (n.n >= MAX_DECKS) return { error: "tooMany" as const };
    const { rows: [d] } = await db.query(
      "insert into card_decks (therapist_id, name, rights_confirmed_at) values ($1, $2, now()) returning id", [therapist.id, name.data]);
    await audit(db, therapist.id, "deck.create", "card_deck", d.id);
    return { id: d.id as string };
  }).catch(() => ({ error: "failed" as const }));
  revalidatePath("/settings/decks");
  return res;
}

export async function renameDeck(id: string, name: string): Promise<void> {
  const { therapist } = await requireTherapist();
  z.uuid().parse(id);
  const n = z.string().trim().min(1).max(60).parse(name);
  await withUser(therapist.id, (db) => db.query("update card_decks set name = $2 where id = $1", [id, n]));
  revalidatePath("/settings/decks");
}

export async function deleteDeck(id: string): Promise<void> {
  const { therapist } = await requireTherapist();
  z.uuid().parse(id);
  await withUser(therapist.id, async (db) => {
    const { rowCount } = await db.query("delete from card_decks where id = $1", [id]);
    if (rowCount) await audit(db, therapist.id, "deck.delete", "card_deck", id);
  });
  revalidatePath("/settings/decks");
}

export async function deleteDeckCard(id: string): Promise<void> {
  const { therapist } = await requireTherapist();
  z.uuid().parse(id);
  await withUser(therapist.id, (db) => db.query("delete from deck_cards where id = $1", [id]));
  revalidatePath("/settings/decks");
}
