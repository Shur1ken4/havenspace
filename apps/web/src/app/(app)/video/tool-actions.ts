"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { audit } from "@/lib/audit";
import { isBuiltInRef, parseCustomRef } from "@/lib/tools/decks";
import { BOARD_COLORS, BOARD_SIZES, EMOTION_WORDS } from "@/lib/tools/model";

// Saving a therapy tool's result to the client's card (ADR-21). Only what the
// therapist chooses to save is kept; the live tool itself leaves nothing behind.

const text = (max: number) => z.string().trim().max(max);
const content = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scale"), question: text(200).min(1), low: text(60), high: text(60), value: z.number().int().min(0).max(10) }),
  z.object({ kind: z.literal("balance"), areas: z.array(z.object({ label: text(40).min(1), value: z.number().int().min(1).max(10).nullable() })).min(3).max(12) }),
  z.object({ kind: z.literal("emotions"), picked: z.array(z.string().refine((w) => EMOTION_WORDS.has(w))).min(1).max(41), labels: z.array(text(40)).max(41) }),
  z.object({ kind: z.literal("cards"), mode: z.enum(["blind", "open"]), drawn: z.array(z.object({ id: z.string().max(80).refine((id) => isBuiltInRef(id) || parseCustomRef(id) !== null), note: text(200) })).min(1).max(7) }),
  z.object({ kind: z.literal("board"), strokes: z.number().int().min(1).max(1500), colors: z.array(z.enum(BOARD_COLORS)).max(6), sizes: z.array(z.union(BOARD_SIZES.map((n) => z.literal(n)) as [z.ZodLiteral<3>, z.ZodLiteral<6>, z.ZodLiteral<12>])).max(3) }),
]);

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

export async function saveToolResult(input: { roomId: string; content: unknown; image?: string | null }): Promise<{ ok: true; id: string } | { ok: false }> {
  const { therapist } = await requireTherapist();
  const roomId = z.uuid().parse(input.roomId);
  const parsed = content.safeParse(input.content);
  if (!parsed.success) return { ok: false };
  let image: Buffer | null = null;
  if (parsed.data.kind === "board") {
    const m = PNG_DATA_URL.exec(input.image ?? "");
    if (!m) return { ok: false };
    image = Buffer.from(m[1], "base64");
    // A real PNG, and not too big.
    if (image.length > 2_000_000 || image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return { ok: false };
  }
  const saved = await withUser(therapist.id, async (db) => {
    const { rows: [room] } = await db.query("select client_id, session_id from video_rooms where id = $1", [roomId]);
    if (!room) return null;
    // Cards from the therapist's own decks must really be theirs.
    const own = parsed.data.kind === "cards" ? parsed.data.drawn.map((d) => parseCustomRef(d.id)).filter((c) => c !== null) : [];
    if (own.length) {
      const { rows: [n] } = await db.query("select count(*)::int as n from deck_cards where id = any($1::uuid[])", [own.map((c) => c.cardId)]);
      if (n.n !== own.length) return null;
    }
    const { rows: [row] } = await db.query(
      `insert into tool_results (therapist_id, client_id, video_room_id, session_id, kind, content, image)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [therapist.id, room.client_id, roomId, room.session_id, parsed.data.kind, parsed.data, image]);
    await audit(db, therapist.id, "tool.save", "tool_result", row.id);
    return { id: row.id as string, clientId: room.client_id as string };
  });
  if (!saved) return { ok: false };
  revalidatePath(`/clients/${saved.clientId}`);
  return { ok: true, id: saved.id };
}

export async function deleteToolResult(id: string): Promise<void> {
  const { therapist } = await requireTherapist();
  z.uuid().parse(id);
  const clientId = await withUser(therapist.id, async (db) => {
    const { rows: [row] } = await db.query("delete from tool_results where id = $1 returning client_id", [id]);
    if (row) await audit(db, therapist.id, "tool.delete", "tool_result", id);
    return row?.client_id as string | undefined;
  });
  if (clientId) revalidatePath(`/clients/${clientId}`);
}
