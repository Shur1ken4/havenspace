"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireTherapist } from "@/lib/session";

// The therapist approved something Arch proposed (ADR-19). The proposal came
// back from the browser, so it is validated again; row-level security makes
// sure it can only touch this therapist's own clients.
const proposal = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("homework"), clientId: z.uuid(), title: z.string().trim().min(1).max(120), details: z.string().max(2000), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() }),
  z.object({ kind: z.literal("next_session"), clientId: z.uuid(), startsAt: z.iso.datetime({ offset: true }) }),
]);

export async function approveArchProposal(input: unknown): Promise<{ ok: true } | { error: "invalid" | "past" }> {
  const { therapist } = await requireTherapist();
  const p = proposal.safeParse(input);
  if (!p.success) return { error: "invalid" };
  const d = p.data;
  if (d.kind === "next_session" && new Date(d.startsAt).getTime() < Date.now()) return { error: "past" };
  await withUser(therapist.id, async (db) => {
    if (d.kind === "homework") {
      const { rows } = await db.query(
        "insert into assignments (therapist_id, client_id, title, details, due_on) values ($1, $2, $3, $4, $5::date) returning id",
        [therapist.id, d.clientId, d.title, d.details, d.dueOn]);
      await audit(db, therapist.id, "arch.approve_homework", "assignment", rows[0].id);
    } else {
      await db.query("delete from appointments where client_id = $1 and starts_at > now()", [d.clientId]);
      await db.query("insert into appointments (therapist_id, client_id, starts_at) values ($1, $2, $3)", [therapist.id, d.clientId, d.startsAt]);
      await audit(db, therapist.id, "arch.approve_appointment", "client", d.clientId);
    }
  });
  revalidatePath(`/clients/${d.clientId}`);
  return { ok: true };
}
