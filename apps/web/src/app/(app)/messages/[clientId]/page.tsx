import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { requireTherapist } from "@/lib/session";
import { audit } from "@/lib/audit";
import { loadMessages, readUpTo } from "@/lib/messages";
import { Conversation } from "@/components/messages/conversation";
import { Notice } from "@/components/ui/notice";

export async function generateMetadata() {
  return { title: (await getTranslations("messages"))("title") };
}

export default async function ConversationPage({ params }: PageProps<"/messages/[clientId]">) {
  const { clientId } = await params;
  if (!isUuid(clientId)) notFound();
  const { therapist } = await requireTherapist();
  const t = await getTranslations("messages");
  const client = await withUser(therapist.id, async (db) => {
    const { rows: [c] } = await db.query(
      `select c.pseudonym, exists (select 1 from client_accounts a where a.client_id = c.id and a.revoked_at is null) as linked
         from clients c where c.id = $1`, [clientId]);
    if (c) await audit(db, therapist.id, "messages.view", "client", clientId);
    return c;
  });
  if (!client) notFound();
  const [initial, read] = await Promise.all([loadMessages(clientId), readUpTo(clientId)]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-1">
        <Link href="/messages" className="text-sm text-muted hover:text-ink">← {t("title")}</Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl sm:text-4xl">{client.pseudonym}</h1>
          <Link href={`/clients/${clientId}`} className="text-sm text-primary-strong underline-offset-4 hover:underline">{t("openClient")}</Link>
        </div>
      </div>
      {!client.linked && <Notice tone="attention">{t("notLinkedBody", { name: client.pseudonym })}</Notice>}
      {client.linked && <Conversation clientId={clientId} initial={initial} initialReadUpTo={read} otherName={client.pseudonym} />}
      <p className="text-sm text-muted">{t("privacyTherapist")}</p>
    </div>
  );
}
