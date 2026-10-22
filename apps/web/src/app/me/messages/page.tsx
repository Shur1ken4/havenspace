import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { loadMessages, readUpTo } from "@/lib/messages";
import { Conversation } from "@/components/messages/conversation";

export async function generateMetadata() {
  return { title: (await getTranslations("messages"))("title") };
}

/** Client: the one conversation with their therapist. */
export default async function ClientMessages() {
  const { session, role } = await requireClient();
  if (role !== "client") redirect("/me");
  const t = await getTranslations("messages");
  const me = await withUser(session.user.id, async (db) => (await db.query(
    "select current_client_id() as id, my_therapist_name() as therapist")).rows[0]);
  if (!me.id) redirect("/me");
  const [initial, read] = await Promise.all([loadMessages(me.id), readUpTo(me.id)]);
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Link href="/me" className="text-sm text-muted hover:text-ink">← {t("backHome")}</Link>
        <h1 className="text-3xl sm:text-4xl">{t("withTherapist", { name: me.therapist })}</h1>
      </div>
      <Conversation clientId={me.id} initial={initial} initialReadUpTo={read} otherName={me.therapist} />
      <p className="text-sm text-muted">{t("privacyClient", { name: me.therapist })}</p>
    </div>
  );
}
