"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDbError, withUser } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";

const sectionsSchema = z.array(z.object({ key: z.string().max(40), text: z.string().max(20000) })).max(12);

export async function saveNote(sessionId: string, sections: { key: string; text: string }[]) {
  const session = await requireUser();
  z.uuid().parse(sessionId);
  const clean = sectionsSchema.parse(sections);
  try {
    await withUser(session.user.id, async (db) => {
      await db.query(
        "update notes set content_json = jsonb_set(content_json, '{sections}', $2::jsonb) where session_id = $1 and status = 'draft'",
        [sessionId, JSON.stringify(clean)],
      );
      await audit(db, session.user.id, "note.edit", "session", sessionId);
    });
  } catch (err) {
    if (isDbError(err, "note_locked")) return { ok: false, locked: true };
    throw err;
  }
  return { ok: true };
}

export async function approveNote(sessionId: string) {
  const session = await requireUser();
  z.uuid().parse(sessionId);
  await withUser(session.user.id, async (db) => {
    await db.query("update notes set status = 'approved', approved_at = now() where session_id = $1 and status = 'draft'", [sessionId]);
    await audit(db, session.user.id, "note.approve", "session", sessionId);
  });
  revalidatePath(`/sessions/${sessionId}`);
}

export async function renameSpeakers(sessionId: string, names: Record<string, string>) {
  const session = await requireUser();
  z.uuid().parse(sessionId);
  const clean = Object.fromEntries(
    Object.entries(names).filter(([k]) => /^[a-z_0-9]{1,20}$/.test(k)).map(([k, v]) => [k, String(v).trim().slice(0, 30)]),
  );
  await withUser(session.user.id, (db) => db.query("update sessions set speaker_names = $2 where id = $1", [sessionId, clean]));
  revalidatePath(`/sessions/${sessionId}`);
}

/** Swap two speaker labels across the whole transcript (e.g. if "You" and "Client" came out reversed). */
export async function swapSpeakers(sessionId: string, a: string, b: string) {
  const session = await requireUser();
  if (!/^[a-z_0-9]{1,20}$/.test(a) || !/^[a-z_0-9]{1,20}$/.test(b)) return;
  await withUser(session.user.id, async (db) => {
    await db.query(
      `update transcript_segments set speaker = case when speaker = $2 then $3 when speaker = $3 then $2 else speaker end
        where session_id = $1 and speaker in ($2, $3)`,
      [sessionId, a, b],
    );
    await audit(db, session.user.id, "transcript.relabel", "session", sessionId);
  });
  revalidatePath(`/sessions/${sessionId}`);
}

export async function redraft(sessionId: string) {
  const session = await requireUser();
  z.uuid().parse(sessionId);
  await withUser(session.user.id, async (db) => {
    const { rowCount } = await db.query(
      `update sessions set status = 'processing', stage = 'writing_note' where id = $1 and status = 'ready'
         and not exists (select 1 from notes where session_id = $1 and status = 'approved')`,
      [sessionId],
    );
    if (rowCount) await db.query("insert into jobs (therapist_id, session_id, kind) values ($1, $2, 'regenerate')", [session.user.id, sessionId]);
  });
  revalidatePath(`/sessions/${sessionId}`);
}
