import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { liveResearchAllowed, requireTherapist } from "@/lib/session";
import { VideoRoom } from "@/components/video/video-room";

export async function generateMetadata() {
  return { title: (await getTranslations("video"))("title") };
}

export default async function TherapistVideoPage({ params }: PageProps<"/video/[id]">) {
  const { therapist, session } = await requireTherapist();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const room = await withUser(therapist.id, async (db) => (await db.query(
    `select r.id, r.client_id, r.ended_at, c.pseudonym,
            exists (select 1 from consents k where k.client_id = r.client_id and k.withdrawn_at is null) as consent,
            exists (select 1 from client_accounts a where a.client_id = r.client_id and a.revoked_at is null) as linked
       from video_rooms r join clients c on c.id = r.client_id where r.id = $1`, [id])).rows[0]);
  if (!room) notFound();
  return <VideoRoom key={room.id} roomId={room.id} role="therapist" otherName={room.pseudonym} clientId={room.client_id} consent={room.consent} linked={room.linked} liveAllowed={liveResearchAllowed(session.user.email)} />;
}
