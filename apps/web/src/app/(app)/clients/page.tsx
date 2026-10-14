import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { AddClientForm } from "./add-client-form";

export async function generateMetadata() {
  return { title: (await getTranslations("clients"))("title") };
}

export default async function ClientsPage() {
  const { therapist } = await requireTherapist();
  const t = await getTranslations("clients");
  const format = await getFormatter();
  const clients = await withUser(therapist.id, async (db) => (await db.query(
    `select c.id, c.pseudonym, c.status,
            (select count(*) from sessions s where s.client_id = c.id)::int as session_count,
            (select max(started_at) from sessions s where s.client_id = c.id) as last_session,
            case when exists (select 1 from consents k where k.client_id = c.id and k.withdrawn_at is null) then 'active'
                 when exists (select 1 from consents k where k.client_id = c.id) then 'withdrawn' else 'missing' end as consent
       from clients c order by c.status, c.pseudonym`,
  )).rows);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="space-y-4">
        <h1 className="text-4xl">{t("title")}</h1>
        {clients.length === 0 ? (
          <p className="text-muted">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {clients.map((c) => (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="block">
                  <Card className={`flex flex-wrap items-center justify-between gap-3 p-5 hover:border-primary ${c.status === "archived" ? "opacity-70" : ""}`}>
                    <div>
                      <p className="font-serif text-xl text-ink">{c.pseudonym}</p>
                      <p className="text-sm text-muted">
                        {t("sessions", { count: c.session_count })}
                        {c.last_session && <> · {t("lastSession", { date: format.dateTime(c.last_session, { dateStyle: "medium" }) })}</>}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {c.status === "archived" && <Chip tone="plain">{t("archived")}</Chip>}
                      <Chip tone={c.consent === "active" ? "sage" : "amber"}>
                        {c.consent === "active" ? t("consentActive") : c.consent === "withdrawn" ? t("consentWithdrawn") : t("consentMissing")}
                      </Chip>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside>
        <Card className="space-y-4 lg:sticky lg:top-6">
          <h2 className="text-2xl">{t("add")}</h2>
          <AddClientForm />
        </Card>
      </aside>
    </div>
  );
}
