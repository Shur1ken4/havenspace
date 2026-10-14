"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { isFresh, requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { looksLikeFullName } from "@/lib/pseudonym";
import { storage } from "@/lib/storage";
import { CONSENT_VERSION } from "@/lib/consent";

export type ClientFormState = { error?: "name" | "taken" | "invalid" | "generic" };

export async function createClient(_prev: ClientFormState, form: FormData): Promise<ClientFormState> {
  const session = await requireUser();
  const pseudonym = String(form.get("pseudonym") ?? "").trim().replace(/\s+/g, " ");
  if (pseudonym.length < 1 || pseudonym.length > 40) return { error: "invalid" };
  if (looksLikeFullName(pseudonym)) return { error: "name" };
  let id: string;
  try {
    id = await withUser(session.user.id, async (db) => {
      const { rows } = await db.query(
        "insert into clients (therapist_id, pseudonym) values ($1, $2) returning id",
        [session.user.id, pseudonym],
      );
      await audit(db, session.user.id, "client.create", "client", rows[0].id);
      return rows[0].id as string;
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return { error: "taken" };
    return { error: "generic" };
  }
  redirect(`/clients/${id}/consent`);
}

const consentSchema = z.object({
  clientId: z.uuid(),
  method: z.enum(["verbal_in_session", "signed_form", "e_sign_link"]),
  confirmed: z.literal("on"),
});

export async function recordConsent(form: FormData) {
  const session = await requireUser();
  const data = consentSchema.parse({ clientId: form.get("clientId"), method: form.get("method"), confirmed: form.get("confirmed") });
  await withUser(session.user.id, async (db) => {
    const { rows } = await db.query(
      `insert into consents (therapist_id, client_id, consent_version, method) values ($1, $2, $3, $4) returning id`,
      [session.user.id, data.clientId, CONSENT_VERSION, data.method],
    );
    await audit(db, session.user.id, "consent.record", "consent", rows[0].id);
  });
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/sessions/new") ? next : `/clients/${data.clientId}`);
}

export async function withdrawConsent(clientId: string, deletePast: boolean) {
  const session = await requireUser();
  z.uuid().parse(clientId);
  const audioKeys = await withUser(session.user.id, async (db) => {
    await db.query("update consents set withdrawn_at = now() where client_id = $1 and withdrawn_at is null", [clientId]);
    await audit(db, session.user.id, "consent.withdraw", "client", clientId);
    // Abandon any session still recording
    await db.query("update sessions set status = 'failed', error_code = 'consent_withdrawn' where client_id = $1 and status in ('draft','recording')", [clientId]);
    if (!deletePast) return [] as string[];
    const { rows } = await db.query(
      "select path from audio_chunks where session_id in (select id from sessions where client_id = $1) and deleted_at is null",
      [clientId],
    );
    await db.query("delete from sessions where client_id = $1", [clientId]);
    await db.query("delete from client_timeline_items where client_id = $1", [clientId]);
    await audit(db, session.user.id, "client.sessions_delete", "client", clientId);
    return rows.map((r) => r.path as string);
  });
  if (audioKeys.length) await storage().remove(audioKeys);
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClient(clientId: string, confirmation: string) {
  const session = await requireUser();
  z.uuid().parse(clientId);
  if (!isFresh(session)) redirect(`/login?reason=fresh&next=/clients/${clientId}`);
  const audioKeys = await withUser(session.user.id, async (db) => {
    const { rows: c } = await db.query("select pseudonym from clients where id = $1", [clientId]);
    if (!c[0] || c[0].pseudonym !== confirmation.trim()) return null;
    const { rows } = await db.query(
      "select path from audio_chunks where session_id in (select id from sessions where client_id = $1) and deleted_at is null",
      [clientId],
    );
    await db.query("delete from clients where id = $1", [clientId]);
    await audit(db, session.user.id, "client.delete", "client", clientId);
    return rows.map((r) => r.path as string);
  });
  if (audioKeys === null) return { ok: false };
  if (audioKeys.length) await storage().remove(audioKeys);
  redirect("/clients");
}

export async function archiveClient(clientId: string, archived: boolean) {
  const session = await requireUser();
  await withUser(session.user.id, (db) =>
    db.query("update clients set status = $2 where id = $1", [clientId, archived ? "archived" : "active"]),
  );
  revalidatePath("/clients");
}

const itemSchema = z.object({ clientId: z.uuid(), kind: z.enum(["theme", "goal", "homework", "change"]), text: z.string().trim().min(1).max(500) });

export async function addTimelineItem(form: FormData) {
  const session = await requireUser();
  const d = itemSchema.parse({ clientId: form.get("clientId"), kind: form.get("kind"), text: form.get("text") });
  await withUser(session.user.id, (db) =>
    db.query(
      "insert into client_timeline_items (therapist_id, client_id, kind, text, source) values ($1, $2, $3, $4, 'therapist')",
      [session.user.id, d.clientId, d.kind, d.text],
    ),
  );
  revalidatePath(`/clients/${d.clientId}`);
}

export async function updateTimelineItem(itemId: string, clientId: string, status: "active" | "done" | "dropped") {
  const session = await requireUser();
  await withUser(session.user.id, (db) => db.query("update client_timeline_items set status = $2 where id = $1", [itemId, status]));
  revalidatePath(`/clients/${clientId}`);
}

