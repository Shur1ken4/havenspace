import { getTranslations } from "next-intl/server";
import { pool } from "@/lib/db";
import { hashGuestToken, isGuestToken } from "@/lib/video";
import { Arch } from "@/components/arch";
import { Card } from "@/components/ui/card";
import { VideoRoom } from "@/components/video/video-room";

export async function generateMetadata() {
  return { title: (await getTranslations("video"))("title"), robots: { index: false } };
}

export default async function GuestVideoPage({ params }: PageProps<"/v/[token]">) {
  const { token } = await params;
  const t = await getTranslations("video");
  const room = isGuestToken(token)
    ? (await pool.query("select * from video_guest_room($1)", [hashGuestToken(token)])).rows[0]
    : null;
  if (!room) {
    return (
      <Card className="mx-auto max-w-lg space-y-4 text-center sm:p-10">
        <Arch mood="resting" className="mx-auto h-24 w-24" />
        <h1 className="text-3xl">{t("linkGoneTitle")}</h1>
        <p className="text-muted">{t("linkGoneBody")}</p>
      </Card>
    );
  }
  return <VideoRoom roomId={room.room_id} role="client" otherName={room.therapist_name} guestToken={token} />;
}
