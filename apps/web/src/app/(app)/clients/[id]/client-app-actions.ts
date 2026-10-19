"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { audit } from "@/lib/audit";
import { hashInviteCode, newInviteCode } from "@/lib/invites";

// The therapist's side of the client app (ADR-14).

const id = z.uuid();

/** Creates a fresh one-time code (older unused codes stop working). The code is returned once and never stored. */
export async function createInvite(clientId: string): Promise<{ code?: string; expiresAt?: string; error?: string }> {
  const { therapist } = await requireTherapist();
  id.parse(clientId);
  const code = newInviteCode();
  try {
    const expiresAt = await withUser(therapist.id, async (db) => {
      const { rows: [c] } = await db.query("select status from clients where id = $1", [clientId]);
      if (!c || c.status !== "active") throw new Error("not_active");
      await db.query("delete from client_invites where client_id = $1 and used_at is null", [clientId]);
      const { rows } = await db.query(
        "insert into client_invites (therapist_id, client_id, code_hash) values ($1, $2, $3) returning expires_at",
        [therapist.id, clientId, hashInviteCode(code)],
      );
      await audit(db, therapist.id, "client_app.invite", "client", clientId);
      return (rows[0].expires_at as Date).toISOString();
    });
    revalidatePath(`/clients/${clientId}`);
    return { code, expiresAt };
  } catch {
    return { error: "generic" };
  }
}

export async function disconnectClient(clientId: string) {
  const { therapist } = await requireTherapist();
  id.parse(clientId);
  await withUser(therapist.id, async (db) => {
    await db.query("select revoke_client_link($1)", [clientId]);
    await audit(db, therapist.id, "client_app.disconnect", "client", clientId);
  });
  revalidatePath(`/clients/${clientId}`);
}

const assignmentSchema = z.object({
  clientId: z.uuid(),
  title: z.string().trim().min(1).max(120),
  details: z.string().trim().max(2000),
  dueOn: z.union([z.literal(""), z.iso.date()]),
});

export async function addAssignment(_prev: { ok?: boolean; error?: boolean }, form: FormData): Promise<{ ok?: boolean; error?: boolean }> {
  const { therapist } = await requireTherapist();
  const d = assignmentSchema.safeParse({
    clientId: form.get("clientId"), title: form.get("title"), details: String(form.get("details") ?? ""), dueOn: String(form.get("dueOn") ?? ""),
  });
  if (!d.success) return { error: true };
  await withUser(therapist.id, async (db) => {
    const { rows } = await db.query(
      "insert into assignments (therapist_id, client_id, title, details, due_on) values ($1, $2, $3, $4, nullif($5, '')::date) returning id",
      [therapist.id, d.data.clientId, d.data.title, d.data.details, d.data.dueOn],
    );
    await audit(db, therapist.id, "assignment.create", "assignment", rows[0].id);
  });
  revalidatePath(`/clients/${d.data.clientId}`);
  return { ok: true };
}

export async function archiveAssignment(clientId: string, assignmentId: string) {
  const { therapist } = await requireTherapist();
  id.parse(clientId);
  id.parse(assignmentId);
  await withUser(therapist.id, (db) => db.query("update assignments set archived_at = now() where id = $1", [assignmentId]));
  revalidatePath(`/clients/${clientId}`);
}

const appointmentSchema = z.object({ clientId: z.uuid(), startsAt: z.iso.datetime({ offset: true }) });

/** startsAt comes from the browser already converted to UTC, so the therapist's own time zone is respected. */
export async function setNextSession(clientId: string, startsAt: string) {
  const { therapist } = await requireTherapist();
  const d = appointmentSchema.parse({ clientId, startsAt });
  if (new Date(d.startsAt).getTime() < Date.now() - 60 * 60_000) return { error: "past" };
  await withUser(therapist.id, async (db) => {
    await db.query("delete from appointments where client_id = $1 and starts_at > now()", [d.clientId]);
    await db.query("insert into appointments (therapist_id, client_id, starts_at) values ($1, $2, $3)", [therapist.id, d.clientId, d.startsAt]);
  });
  revalidatePath(`/clients/${d.clientId}`);
  return {};
}

export async function clearNextSession(clientId: string) {
  const { therapist } = await requireTherapist();
  id.parse(clientId);
  await withUser(therapist.id, (db) => db.query("delete from appointments where client_id = $1 and starts_at > now()", [clientId]));
  revalidatePath(`/clients/${clientId}`);
}
