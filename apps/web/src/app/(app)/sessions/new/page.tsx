import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MonitorSpeaker, Mic, Upload, PenLine } from "lucide-react";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Notice } from "@/components/ui/notice";
import { createSession } from "../actions";
import { BrowserCheck } from "./browser-check";

export async function generateMetadata() {
  return { title: (await getTranslations("session"))("newTitle") };
}

const modes = [
  { id: "online_call", icon: MonitorSpeaker },
  { id: "in_person", icon: Mic },
  { id: "upload", icon: Upload },
  { id: "recap", icon: PenLine },
] as const;

export default async function NewSessionPage({ searchParams }: PageProps<"/sessions/new">) {
  const { therapist } = await requireTherapist();
  const t = await getTranslations();
  const sp = await searchParams;
  const clientId = typeof sp.client === "string" ? sp.client : null;

  const clients = await withUser(therapist.id, async (db) => (await db.query(
    `select c.id, c.pseudonym,
            exists (select 1 from consents k where k.client_id = c.id and k.withdrawn_at is null) as consent
       from clients c where c.status = 'active' order by c.pseudonym`,
  )).rows);
  const client = clients.find((c) => c.id === clientId);

  if (!client) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-4xl">{t("today.chooseClient")}</h1>
        {clients.length === 0 && (
          <Notice tone="info">{t("today.noClientsBody")} <Link className="underline" href="/clients">{t("clients.add")}</Link></Notice>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/sessions/new?client=${c.id}`} className="block">
                <Card className="flex items-center justify-between p-5 hover:border-primary">
                  <span className="font-serif text-xl">{c.pseudonym}</span>
                  <Chip tone={c.consent ? "sage" : "amber"}>{c.consent ? t("clients.consentActive") : t("clients.consentMissing")}</Chip>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/sessions/new" className="text-sm text-muted hover:text-ink">← {t("today.chooseClient")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl">{client.pseudonym}</h1>
        {client.consent && <Chip>{t("session.consentConfirmed")}</Chip>}
      </div>
      {!client.consent && (
        <Notice tone="attention" title={t("consent.required")}>
          <Link className="underline" href={`/clients/${client.id}/consent?next=/sessions/new?client=${client.id}`}>{t("consent.record")}</Link>
        </Notice>
      )}
      <h2 className="text-2xl">{t("session.modeTitle")}</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {modes.map((m) => {
          const needsConsent = m.id !== "recap" && !client.consent;
          return (
            <li key={m.id}>
              <form action={createSession} className="h-full">
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="mode" value={m.id} />
                <button type="submit" disabled={needsConsent} className="h-full w-full text-left disabled:opacity-50">
                  <Card className="h-full space-y-2 p-5 hover:border-primary">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><m.icon size={20} aria-hidden /></span>
                    <p className="text-lg font-medium text-ink">{t(`session.mode_${m.id}`)}</p>
                    <p className="text-muted">{t(`session.mode_${m.id}_body`)}</p>
                    {m.id === "online_call" && <BrowserCheck />}
                  </Card>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
