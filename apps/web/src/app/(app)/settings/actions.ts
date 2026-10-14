"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { isFresh, requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { storage } from "@/lib/storage";

const profileSchema = z.object({
  displayName: z.string().trim().max(80),
  profession: z.enum(["counsellor", "psychotherapist", "psychologist", "other"]),
  accreditationStage: z.enum(["student", "pre_accredited", "accredited", "supervisor"]),
  modalities: z.array(z.enum(["cbt", "mi", "dbt", "person_centred", "solution_focused", "integrative", "psychodynamic", "systemic"])).min(1),
  noteFormat: z.enum(["SOAP", "DAP", "BIRP", "FREE"]),
  language: z.enum(["en", "ru"]),
});

export type ProfileState = { ok?: boolean; error?: boolean };

export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const session = await requireUser();
  const parsed = profileSchema.safeParse({
    displayName: form.get("displayName"),
    profession: form.get("profession"),
    accreditationStage: form.get("accreditationStage"),
    modalities: form.getAll("modalities"),
    noteFormat: form.get("noteFormat"),
    language: form.get("language"),
  });
  if (!parsed.success) return { error: true };
  const d = parsed.data;
  await withUser(session.user.id, (db) => db.query(
    `update therapists set display_name = $2, profession = $3, accreditation_stage = $4, modalities = $5, note_format = $6, language = $7 where id = $1`,
    [session.user.id, d.displayName, d.profession, d.accreditationStage, d.modalities, d.noteFormat, d.language],
  ));
  (await cookies()).set("locale", d.language, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setRetention(value: "delete_after_transcription" | "keep_7_days") {
  const session = await requireUser();
  z.enum(["delete_after_transcription", "keep_7_days"]).parse(value);
  await withUser(session.user.id, async (db) => {
    await db.query("update therapists set audio_retention = $2 where id = $1", [session.user.id, value]);
    await audit(db, session.user.id, "settings.retention", "therapist", session.user.id);
  });
  revalidatePath("/settings/privacy");
}

export async function deleteAccount(confirmation: string) {
  const session = await requireUser();
  if (confirmation.trim().toUpperCase() !== "DELETE") return { ok: false };
  if (!isFresh(session)) redirect("/login?reason=fresh&next=/settings/privacy");
  const uid = session.user.id;
  const keys = await withUser(uid, async (db) => {
    const { rows } = await db.query("select path from audio_chunks where deleted_at is null");
    await audit(db, uid, "account.delete", "therapist", uid);
    return rows.map((r) => r.path as string);
  });
  if (keys.length) await storage().remove(keys);
  // Deleting the login cascades to the profile and every client, session, note and reflection.
  await withUser(uid, (db) => db.query('delete from "user" where id = $1', [uid]));
  await auth.api.signOut({ headers: await headers() }).catch(() => {});
  redirect("/?deleted=1");
}

export async function signOutEverywhere() {
  const session = await requireUser();
  await auth.api.revokeSessions({ headers: await headers() });
  await withUser(session.user.id, (db) => audit(db, session.user.id, "auth.revoke_all", "therapist", session.user.id));
  redirect("/login");
}
