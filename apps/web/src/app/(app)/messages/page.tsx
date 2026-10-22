import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { MessageCircle } from "lucide-react";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

export async function generateMetadata() {
  return { title: (await getTranslations("messages"))("title") };
}

/** Therapist: every client who uses the client app, newest conversation first. */
export default async function MessagesPage() {
  const { therapist } = await requireTherapist();
  const t = await getTranslations("messages");
  const f = await getFormatter();
  const rows = await withUser(therapist.id, async (db) => (await db.query(
    `select c.id, c.pseudonym, a.user_id is not null as linked, last.body, last.created_at, last.from_client,
            (select count(*) from messages u where u.client_id = c.id and u.from_client and u.read_at is null)::int as unread
       from clients c
       left join client_accounts a on a.client_id = c.id and a.revoked_at is null
       left join lateral (select body, created_at, from_client from messages m where m.client_id = c.id order by created_at desc limit 1) last on true
      where a.user_id is not null or last.created_at is not null
      order by last.created_at desc nulls last, c.pseudonym`,
  )).rows);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="text-muted">{t("intro")}</p>
      </div>
      {rows.length === 0 ? (
        <Card className="space-y-2">
          <p className="text-ink">{t("noneYet")}</p>
          <p className="text-sm text-muted">{t("noneYetHint")}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/messages/${r.id}`} className="block">
                <Card className="flex items-center gap-4 p-4 hover:border-primary sm:p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><MessageCircle size={19} aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-xl text-ink">{r.pseudonym}</span>
                      {r.unread > 0 && <Chip tone="sage">{t("unread", { count: r.unread })}</Chip>}
                      {!r.linked && <Chip tone="amber">{t("notLinked")}</Chip>}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {r.body ? `${r.from_client ? "" : `${t("you")}: `}${r.body}` : t("startConversation")}
                    </p>
                  </div>
                  {r.created_at && <span className="shrink-0 text-xs text-muted">{f.relativeTime(r.created_at)}</span>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
