"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDbError, withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { audit } from "@/lib/audit";
import { closeVideoRoom, guestLinkUrl, hashGuestToken, newGuestToken, videoEnabled } from "@/lib/video";

/** Opens a video room for one client and takes the therapist into it. */
export async function startVideo(form: FormData) {
  const { therapist } = await requireTherapist();
  if (!videoEnabled()) throw new Error("video not configured");
  const clientId = z.uuid().parse(form.get("clientId"));
  const id = await withUser(therapist.id, async (db) => {
    // Reuse a room opened for this client in the last few hours instead of making a second one.
    const { rows: [open] } = await db.query(
      `select id from video_rooms where client_id = $1 and ended_at is null and created_at > now() - interval '4 hours'
        order by created_at desc limit 1`, [clientId]);
    if (open) return open.id as string;
    const { rows: [room] } = await db.query(
      "insert into video_rooms (therapist_id, client_id) values ($1, $2) returning id", [therapist.id, clientId]);
    await audit(db, therapist.id, "video.start", "video_room", room.id);
    return room.id as string;
  });
  redirect(`/video/${id}`);
}

/** Starts a recorded session inside the call. Needs the client's consent, like any recording. */
export async function startVideoRecording(roomId: string): Promise<{ sessionId: string } | { error: "consent" | "gone" }> {
  const { therapist } = await requireTherapist();
  z.uuid().parse(roomId);
  try {
    return await withUser(therapist.id, async (db) => {
      const { rows: [room] } = await db.query("select client_id, session_id from video_rooms where id = $1 and ended_at is null", [roomId]);
      if (!room) return { error: "gone" as const };
      if (room.session_id) {
        const { rows: [s] } = await db.query("select status from sessions where id = $1", [room.session_id]);
        if (s?.status === "draft") return { sessionId: room.session_id as string };
      }
      const { rows: [s] } = await db.query(
        `insert into sessions (therapist_id, client_id, capture_mode, audio_retention, started_at)
         select $1, $2, 'online_call', audio_retention, now() from therapists where id = $1 returning id`,
        [therapist.id, room.client_id]);
      await db.query("update video_rooms set session_id = $2 where id = $1", [roomId, s.id]);
      await audit(db, therapist.id, "session.create", "session", s.id);
      return { sessionId: s.id as string };
    });
  } catch (err) {
    if (isDbError(err, "consent_required")) return { error: "consent" };
    throw err;
  }
}

/** Ends the call for both people. */
export async function endVideo(roomId: string): Promise<void> {
  const { therapist } = await requireTherapist();
  z.uuid().parse(roomId);
  const room = await withUser(therapist.id, async (db) => {
    const { rows: [r] } = await db.query(
      "update video_rooms set ended_at = coalesce(ended_at, now()), guest_token_hash = null where id = $1 returning room_name, session_id", [roomId]);
    if (!r) return null;
    await audit(db, therapist.id, "video.end", "video_room", roomId);
    // "Record for notes" was pressed but nothing was recorded (e.g. the client never
    // joined): remove the empty draft so it doesn't sit in the client's timeline.
    if (r.session_id) {
      await db.query(
        `delete from sessions s where s.id = $1 and s.status = 'draft'
           and not exists (select 1 from audio_chunks a where a.session_id = s.id)`, [r.session_id]);
    }
    return r;
  });
  if (room) await closeVideoRoom(room.room_name);
}

/** A fresh one-time link for this session. Making a new one switches the old one off. */
export async function createGuestLink(roomId: string): Promise<{ url: string } | { error: "gone" }> {
  const { therapist } = await requireTherapist();
  z.uuid().parse(roomId);
  const token = newGuestToken();
  const ok = await withUser(therapist.id, async (db) => {
    const { rowCount } = await db.query(
      `update video_rooms set guest_token_hash = $2, guest_expires_at = now() + interval '4 hours'
        where id = $1 and ended_at is null`, [roomId, hashGuestToken(token)]);
    if (rowCount) await audit(db, therapist.id, "video.guest_link", "video_room", roomId);
    return Boolean(rowCount);
  });
  return ok ? { url: guestLinkUrl(token) } : { error: "gone" };
}

/** "Save to my computer" (ADR-24): who asked, agreed, started and stopped, and when. No content. */
export async function logCallSaving(roomId: string, event: "asked" | "agreed" | "declined" | "started" | "stopped" | "withdrawn"): Promise<void> {
  const { therapist } = await requireTherapist();
  z.uuid().parse(roomId);
  z.enum(["asked", "agreed", "declined", "started", "stopped", "withdrawn"]).parse(event);
  await withUser(therapist.id, (db) => audit(db, therapist.id, `video.save_${event}`, "video_room", roomId));
}
