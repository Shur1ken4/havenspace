import "server-only";
import { getTranslations } from "next-intl/server";
import { pool } from "./db";
import { sendEmail } from "./email";
import { inVideoRoom } from "./video";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3210";

/**
 * Someone just got an entry pass to a video room: if the other person isn't in
 * the room, email them a link (db/migrations/0021_video_join_notice.sql decides
 * who and how often). Names and a link only; never anything from the session.
 */
export async function notifyVideoJoin(roomName: string, joiner: "therapist" | "client"): Promise<void> {
  const other = joiner === "therapist" ? "client" : "therapist";
  if (await inVideoRoom(roomName, other)) return;
  const { rows: [n] } = await pool.query("select * from video_join_notice($1, $2)", [roomName, joiner]);
  if (!n?.email) return;
  const locale = n.language === "ru" ? "ru" : "en";
  const t = await getTranslations({ locale, namespace: "videoEmail" });
  try {
    await sendEmail(joiner === "client"
      ? { to: n.email, subject: t("clientJoinedSubject", { name: n.pseudonym }), text: t("clientJoinedBody", { name: n.pseudonym, link: `${appUrl()}/video/${n.room_id}` }) }
      : { to: n.email, subject: t("therapistJoinedSubject", { name: n.therapist_name }), text: t("therapistJoinedBody", { name: n.therapist_name, link: `${appUrl()}/me/video/${n.room_id}` }) });
  } catch (err) {
    console.error(JSON.stringify({ event: "video.join_email_failed", code: (err as { code?: string })?.code ?? "unknown" }));
  }
}
