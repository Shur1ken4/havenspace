"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { requireClient } from "@/lib/session";

// The client's own actions (ADR-14). Row-level security and the database
// functions make sure a client can only touch their own homework and diary.

export async function updateHomework(id: string, done: boolean, reply: string) {
  const { session, role } = await requireClient();
  if (role !== "client") return;
  const d = z.object({ id: z.uuid(), done: z.boolean(), reply: z.string().max(1000) }).parse({ id, done, reply });
  await withUser(session.user.id, (db) => db.query("select client_update_assignment($1, $2, $3)", [d.id, d.done, d.reply]));
  revalidatePath("/me");
}

const moodSchema = z.object({ mood: z.coerce.number().int().min(1).max(5), note: z.string().trim().max(1000), shared: z.boolean() });

export type FormResult = { ok?: boolean; error?: boolean };

export async function addMood(_prev: FormResult, form: FormData): Promise<FormResult> {
  const { session, role } = await requireClient();
  if (role !== "client") return { error: true };
  const d = moodSchema.safeParse({ mood: form.get("mood"), note: String(form.get("note") ?? ""), shared: form.get("shared") === "on" });
  if (!d.success) return { error: true };
  await withUser(session.user.id, (db) => db.query(
    `insert into mood_entries (therapist_id, client_id, client_user_id, mood, note, shared)
     select therapist_id, client_id, $1, $2, $3, $4 from client_accounts where user_id = $1 and revoked_at is null`,
    [session.user.id, d.data.mood, d.data.note, d.data.shared],
  ));
  revalidatePath("/me");
  return { ok: true };
}

export async function setMoodShared(id: string, shared: boolean) {
  const { session } = await requireClient();
  z.uuid().parse(id);
  await withUser(session.user.id, (db) => db.query("update mood_entries set shared = $2 where id = $1", [id, Boolean(shared)]));
  revalidatePath("/me");
}

export async function deleteMood(id: string) {
  const { session } = await requireClient();
  z.uuid().parse(id);
  await withUser(session.user.id, (db) => db.query("delete from mood_entries where id = $1", [id]));
  revalidatePath("/me");
}

/** Deletes the client's account and their diary. Homework stays with the therapist's records. */
export async function leaveApp(confirmation: string) {
  const { session } = await requireClient();
  const word = confirmation.trim().toUpperCase();
  if (word !== "DELETE" && word !== "УДАЛИТЬ") return { ok: false };
  const h = await headers();
  await auth.api.signOut({ headers: h }).catch(() => {});
  await withUser(session.user.id, (db) => db.query("select leave_client_app()"));
  redirect("/?left=1");
}
