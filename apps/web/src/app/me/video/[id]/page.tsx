import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { requireClient } from "@/lib/session";
import { CallPage } from "@/components/video/call-host";

export async function generateMetadata() {
  return { title: (await getTranslations("video"))("title") };
}

export default async function ClientVideoPage({ params }: PageProps<"/me/video/[id]">) {
  const { session, role } = await requireClient();
  if (role !== "client") notFound();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const data = await withUser(session.user.id, async (db) => ({
    therapist: (await db.query("select my_therapist_name() as name")).rows[0]?.name as string | null,
  }));
  const t = await getTranslations("video");
  // A closed room still renders: the join step then says the session has ended.
  return <CallPage path={`/me/video/${id}`} roomId={id} role="client" otherName={data.therapist ?? t("yourTherapist")} />;
}
