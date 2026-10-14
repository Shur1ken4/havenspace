"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDbError, withUser } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { storage } from "@/lib/storage";

const createSchema = z.object({
  clientId: z.uuid(),
  mode: z.enum(["online_call", "in_person", "upload", "recap"]),
});

export async function createSession(form: FormData) {
  const session = await requireUser();
  const d = createSchema.parse({ clientId: form.get("clientId"), mode: form.get("mode") });
  let id: string;
  try {
    id = await withUser(session.user.id, async (db) => {
      const { rows: [t] } = await db.query("select audio_retention from therapists where id = $1", [session.user.id]);
      const { rows } = await db.query(
        `insert into sessions (therapist_id, client_id, capture_mode, audio_retention) values ($1, $2, $3, $4) returning id`,
        [session.user.id, d.clientId, d.mode, t.audio_retention],
      );
      await audit(db, session.user.id, "session.create", "session", rows[0].id);
      return rows[0].id as string;
    });
  } catch (err) {
    if (isDbError(err, "consent_required")) redirect(`/clients/${d.clientId}/consent?next=/sessions/new?client=${d.clientId}`);
    throw err;
  }
  redirect(`/sessions/${id}/capture`);
}

const recapSchema = z.object({
  sessionId: z.uuid(),
  text: z.string().trim().min(20).max(20000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.coerce.number().int().min(5).max(240),
});

export async function submitRecap(form: FormData) {
  const session = await requireUser();
  const d = recapSchema.parse({
    sessionId: form.get("sessionId"), text: form.get("text"), date: form.get("date"), minutes: form.get("minutes"),
  });
  await withUser(session.user.id, async (db) => {
    const { rowCount } = await db.query(
      `update sessions set recap_text = $2, started_at = ($3::date + time '12:00') at time zone 'Europe/Dublin',
              duration_seconds = $4, ended_at = now(), status = 'uploaded', stage = 'queued'
        where id = $1 and capture_mode = 'recap' and status = 'draft'`,
      [d.sessionId, d.text, d.date, d.minutes * 60],
    );
    if (!rowCount) throw new Error("session not editable");
    await db.query("insert into jobs (therapist_id, session_id, kind) values ($1, $2, 'process_session')", [session.user.id, d.sessionId]);
  });
  redirect(`/sessions/${d.sessionId}`);
}

export async function deleteSession(sessionId: string) {
  const session = await requireUser();
  z.uuid().parse(sessionId);
  const { keys, clientId } = await withUser(session.user.id, async (db) => {
    const { rows } = await db.query("select path from audio_chunks where session_id = $1 and deleted_at is null", [sessionId]);
    const { rows: [s] } = await db.query("delete from sessions where id = $1 returning client_id", [sessionId]);
    await audit(db, session.user.id, "session.delete", "session", sessionId);
    return { keys: rows.map((r) => r.path as string), clientId: s?.client_id as string | undefined };
  });
  if (keys.length) await storage().remove(keys);
  redirect(clientId ? `/clients/${clientId}` : "/today");
}

export async function retrySession(sessionId: string) {
  const session = await requireUser();
  await withUser(session.user.id, async (db) => {
    const { rowCount } = await db.query(
      "update sessions set status = 'uploaded', stage = 'queued', error_code = null where id = $1 and status = 'failed' and error_code is distinct from 'consent_withdrawn'",
      [sessionId],
    );
    if (rowCount) await db.query("insert into jobs (therapist_id, session_id, kind) values ($1, $2, 'process_session')", [session.user.id, sessionId]);
  });
  revalidatePath(`/sessions/${sessionId}`);
}
