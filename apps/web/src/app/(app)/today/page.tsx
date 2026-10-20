import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowRight, Plus } from "lucide-react";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { PlantIllustration, WindowIllustration } from "@/components/illustrations";
import { Arch } from "@/components/arch";
import { PasskeyPrompt } from "@/components/app/passkey-prompt";

export async function generateMetadata() {
  return { title: (await getTranslations("today"))("title") };
}

type Row = { id: string; pseudonym: string; started_at: Date; status: string; capture_mode: string; note_status: string | null };

export default async function TodayPage() {
  const { therapist } = await requireTherapist();
  const t = await getTranslations();
  const format = await getFormatter();

  const data = await withUser(therapist.id, async (db) => {
    const sessions = (await db.query<Row>(
      `select s.id, c.pseudonym, s.started_at, s.status, s.capture_mode, n.status as note_status
         from sessions s join clients c on c.id = s.client_id left join notes n on n.session_id = s.id
        where s.started_at >= date_trunc('day', now() at time zone 'Europe/Dublin') at time zone 'Europe/Dublin'
          and s.status <> 'draft'
        order by s.started_at desc`,
    )).rows;
    const awaiting = (await db.query<Row>(
      `select s.id, c.pseudonym, s.started_at, s.status, s.capture_mode, n.status as note_status
         from notes n join sessions s on s.id = n.session_id join clients c on c.id = s.client_id
        where n.status = 'draft' order by s.started_at desc limit 10`,
    )).rows;
    const processing = (await db.query<Row>(
      `select s.id, c.pseudonym, s.started_at, s.status, s.capture_mode, null as note_status
         from sessions s join clients c on c.id = s.client_id
        where s.status in ('uploaded','processing') order by s.started_at desc`,
    )).rows;
    const { rows: [counts] } = await db.query(
      `select (select count(*) from clients where status = 'active')::int as clients,
              coalesce((select sum(duration_seconds) from sessions
                         where status = 'ready' and started_at >= date_trunc('month', now())), 0)::int as seconds`,
    );
    return { sessions, awaiting, processing, counts };
  });

  const hour = Number(new Intl.DateTimeFormat("en-IE", { hour: "numeric", hour12: false, timeZone: "Europe/Dublin" }).format(new Date()));
  const greetingKey = hour < 12 ? "greetingMorning" : hour < 18 ? "greetingAfternoon" : "greetingEvening";
  const greeting = therapist.display_name ? t(`app.${greetingKey}`, { name: therapist.display_name }) : t("app.greetingNoName");

  const SessionLink = ({ s }: { s: Row }) => (
    <li>
      <Link href={`/sessions/${s.id}`} className="flex items-center justify-between gap-3 rounded-control px-3 py-3 hover:bg-surface-2">
        <span>
          <span className="font-medium text-ink">{s.pseudonym}</span>{" "}
          <span className="text-muted">· {format.dateTime(s.started_at, { weekday: "short", day: "numeric", month: "short" })} · {t(`session.short_${s.capture_mode}`)}</span>
        </span>
        <ArrowRight size={16} className="text-muted" aria-hidden />
      </Link>
    </li>
  );

  // Arch only reports its own work; never anything about a client.
  const archMood = data.processing.length > 0 ? "working" : data.awaiting.length > 0 ? "done" : "idle";
  const archLine = archMood === "working" ? t("arch.todayWorking", { count: data.processing.length })
    : archMood === "done" ? t("arch.todayDone", { count: data.awaiting.length }) : t("arch.todayIdle");

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <Arch mood={archMood} alive followPointer label={archLine} className="h-24 w-24 shrink-0 sm:h-32 sm:w-32" />
          <div className="space-y-2">
            <h1 className="text-4xl">{greeting}</h1>
            <p className="text-muted">{format.dateTime(new Date(), { dateStyle: "full", timeZone: "Europe/Dublin" })}</p>
            <p className="text-ink" aria-live="polite"><span className="font-medium text-brand-ink">Arch:</span> {archLine}</p>
          </div>
        </div>
        {data.counts.clients > 0 ? (
          <Link href="/sessions/new" className={buttonClass("primary", "lg")}>{t("today.startSession")}</Link>
        ) : (
          <Link href="/clients#add" className={buttonClass("primary", "lg")}><Plus size={18} aria-hidden /> {t("today.addClientFirst")}</Link>
        )}
      </section>

      <PasskeyPrompt />

      {data.counts.clients === 0 && (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <WindowIllustration className="h-32 w-40" />
          <h2 className="text-2xl">{t("today.noClientsTitle")}</h2>
          <p className="text-muted">{t("today.noClientsBody")}</p>
          <Link href="/clients#add" className={buttonClass("secondary")}>{t("clients.add")}</Link>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-2xl">{t("today.awaitingReview")}</h2>
          {data.awaiting.length === 0 ? (
            <div className="flex items-center gap-4 text-muted"><PlantIllustration className="h-16 w-16" /> {t("today.nothingToReview")}</div>
          ) : (
            <ul className="-mx-3">{data.awaiting.map((s) => <SessionLink key={s.id} s={s} />)}</ul>
          )}
          {data.processing.length > 0 && (
            <div className="space-y-1 border-t border-line pt-3">
              <p className="text-sm text-muted">{t("today.processing")}</p>
              <ul className="-mx-3">{data.processing.map((s) => <SessionLink key={s.id} s={s} />)}</ul>
            </div>
          )}
        </Card>
        <Card className="space-y-3">
          <h2 className="text-2xl">{t("today.todaysSessions")}</h2>
          {data.sessions.length === 0 ? (
            <p className="text-muted">{t("today.noSessionsToday")}</p>
          ) : (
            <ul className="-mx-3">{data.sessions.map((s) => <SessionLink key={s.id} s={s} />)}</ul>
          )}
          <div className="border-t border-line pt-3">
            <Chip tone="plain">{t("today.hoursThisMonth")}: {(data.counts.seconds / 3600).toFixed(1)}</Chip>
          </div>
        </Card>
      </div>
    </div>
  );
}
