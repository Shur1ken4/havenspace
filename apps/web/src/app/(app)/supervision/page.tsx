import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Notice } from "@/components/ui/notice";
import { loadMonth } from "./data";
import { BuildPack, ExcerptPicker, HoursForm, RemoveHours } from "./controls";

export async function generateMetadata() {
  return { title: (await getTranslations("supervision"))("title") };
}

function months(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default async function SupervisionPage({ searchParams }: PageProps<"/supervision">) {
  const { therapist } = await requireTherapist();
  const t = await getTranslations("supervision");
  const format = await getFormatter();
  const sp = await searchParams;
  const all = months();
  const month = typeof sp.month === "string" && all.includes(sp.month) ? sp.month : all[0];
  const data = await withUser(therapist.id, (db) => loadMonth(db, month));
  const monthLabel = format.dateTime(new Date(`${month}-01T12:00:00`), { month: "long", year: "numeric" });
  const clientHours = data.hours.client_seconds / 3600;
  const supHours = data.supervisionMinutes / 60;
  const ai = data.pack?.content_json?.ai as undefined | { overview: string; clients: { pseudonym: string; summary: string }[]; growth_themes: string[]; questions_for_supervision: string[] };
  const selected: string[] = data.pack?.content_json?.excerpts ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="text-muted">{t("intro")}</p>
      </div>
      <nav aria-label={t("month")} className="flex gap-2 overflow-x-auto pb-1">
        {all.map((m) => (
          <Link key={m} href={`/supervision?month=${m}`} aria-current={m === month ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${m === month ? "border-primary bg-primary-soft text-primary-strong" : "border-line text-muted hover:text-ink"}`}>
            {format.dateTime(new Date(`${m}-01T12:00:00`), { month: "short", year: "2-digit" })}
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl">{t("packTitle", { month: monthLabel })}</h2>
            <div className="flex flex-wrap gap-2">
              {ai && <a className={buttonClass("secondary", "sm")} href={`/api/supervision/${month}`}><Download size={16} aria-hidden /> {t("exportPdf")}</a>}
              <BuildPack month={month} building={Boolean(data.pack?.building)} hasPack={Boolean(ai)} disabled={data.hours.approved === 0} />
            </div>
          </div>
          {data.hours.sessions === 0 ? <Notice tone="info">{t("noSessions")}</Notice> : !ai && <p className="text-muted">{t("approvedOnly", { count: data.hours.approved })}</p>}
          {ai && (
            <div className="space-y-5">
              <section className="space-y-2"><h3 className="text-xl">{t("summary")}</h3><p className="leading-relaxed">{ai.overview}</p>
                {ai.clients.map((c) => <p key={c.pseudonym} className="leading-relaxed"><span className="font-medium">{c.pseudonym}:</span> {c.summary}</p>)}
              </section>
              <section className="space-y-2"><h3 className="text-xl">{t("growth")}</h3>
                <ul className="list-disc space-y-1 pl-5">{ai.growth_themes.map((g, i) => <li key={i}>{g}</li>)}</ul></section>
              <section className="space-y-2"><h3 className="text-xl">{t("questions")}</h3>
                <ul className="list-disc space-y-1 pl-5">{ai.questions_for_supervision.map((g, i) => <li key={i}>{g}</li>)}</ul></section>
            </div>
          )}
          {data.moments.length > 0 && (
            <section className="space-y-3 border-t border-line pt-5">
              <h3 className="text-xl">{t("excerpts")}</h3>
              <p className="text-sm text-muted">{t("excerptChoose")}</p>
              <ExcerptPicker month={month} selected={selected} moments={data.moments.map((m) => ({ ...m, date: format.dateTime(new Date(m.date), { dateStyle: "medium" }) }))} />
            </section>
          )}
        </Card>

        <Card className="space-y-4 self-start">
          <h2 className="text-2xl">{t("hoursLog")}</h2>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-control bg-surface-2 p-3"><dt className="text-xs text-muted">{t("clientHours")}</dt><dd className="font-serif text-2xl">{clientHours.toFixed(1)}</dd></div>
            <div className="rounded-control bg-surface-2 p-3"><dt className="text-xs text-muted">{t("supervisionHours")}</dt><dd className="font-serif text-2xl">{supHours.toFixed(1)}</dd></div>
            <div className="rounded-control bg-surface-2 p-3"><dt className="text-xs text-muted">{t("ratio")}</dt><dd className="font-serif text-2xl">{supHours > 0 ? `1:${(clientHours / supHours).toFixed(1)}` : "—"}</dd></div>
          </dl>
          <p className="text-sm text-muted">{t("ratioHint")}</p>
          {data.supervision.length > 0 && (
            <ul className="divide-y divide-line text-ui">
              {data.supervision.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                  <span>{format.dateTime(new Date(h.occurred_on), { dateStyle: "medium" })} · {h.minutes} min · {t(`kind_${h.kind}`)}{h.supervisor ? ` · ${h.supervisor}` : ""}</span>
                  <RemoveHours id={h.id} />
                </li>
              ))}
            </ul>
          )}
          <HoursForm month={month} />
          <Chip tone="plain">{t("sessionsCount", { count: data.hours.sessions })}</Chip>
        </Card>
      </section>
    </div>
  );
}
