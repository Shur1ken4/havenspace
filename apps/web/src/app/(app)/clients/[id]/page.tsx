import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { audit } from "@/lib/audit";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Notice } from "@/components/ui/notice";
import { TimelineList } from "./timeline-list";
import { ClientDanger } from "./client-danger";
import { ClientAppPanel, type ClientAppData } from "./client-app-panel";
import { videoEnabled } from "@/lib/video";

export async function generateMetadata() {
  return { title: (await getTranslations("meta"))("client") };
}

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const { therapist } = await requireTherapist();
  const t = await getTranslations();
  const format = await getFormatter();
  const data = await withUser(therapist.id, async (db) => {
    const client = (await db.query("select id, pseudonym, status from clients where id = $1", [id])).rows[0];
    if (!client) return null;
    const consent = (await db.query("select given_at from consents where client_id = $1 and withdrawn_at is null limit 1", [id])).rows[0];
    const sessions = (await db.query(
      `select s.id, s.started_at, s.status, s.capture_mode, s.duration_seconds, n.status as note_status,
              coalesce((select array_agg(distinct i.text) from client_timeline_items i where i.session_id = s.id and i.kind = 'theme'), '{}') as themes
         from sessions s left join notes n on n.session_id = s.id
        where s.client_id = $1 and s.status <> 'draft' order by s.started_at desc`, [id],
    )).rows;
    const items = (await db.query(
      `select i.id, i.kind, i.text, i.status, i.source, i.created_at, s.started_at as session_date
         from client_timeline_items i left join sessions s on s.id = i.session_id
        where i.client_id = $1 and i.status <> 'dropped' order by i.status, i.created_at desc`, [id],
    )).rows;
    const iso = (d: Date | null) => (d ? d.toISOString() : null);
    const link = (await db.query("select linked_at from client_accounts where client_id = $1 and revoked_at is null", [id])).rows[0];
    const invite = (await db.query("select max(expires_at) as e from client_invites where client_id = $1 and used_at is null and expires_at > now()", [id])).rows[0];
    const app: ClientAppData = {
      link: link ? { linked_at: link.linked_at.toISOString() } : null,
      inviteExpires: iso(invite?.e ?? null),
      assignments: (await db.query(
        `select id, title, details, to_char(due_on, 'YYYY-MM-DD') as due_on, done_at, client_reply from assignments
          where client_id = $1 and archived_at is null order by done_at nulls first, created_at desc limit 30`, [id],
      )).rows.map((a) => ({ ...a, done_at: iso(a.done_at) })),
      nextSession: iso((await db.query("select min(starts_at) as s from appointments where client_id = $1 and starts_at > now() - interval '1 hour'", [id])).rows[0].s),
      moods: (await db.query("select id, mood, note, created_at from mood_entries where client_id = $1 order by created_at desc limit 20", [id]))
        .rows.map((m) => ({ ...m, created_at: m.created_at.toISOString() })),
    };
    await audit(db, therapist.id, "client.view", "client", id);
    return { client, consent, sessions, items, app };
  }).catch(() => null);
  if (!data) notFound();

  const byKind = (k: string) => data.items.filter((i) => i.kind === k).map((i) => ({
    ...i, session_date: i.session_date ? format.dateTime(i.session_date, { dateStyle: "medium" }) : null,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link href="/clients" className="text-sm text-muted hover:text-ink">← {t("clients.title")}</Link>
          <h1 className="text-4xl">{data.client.pseudonym}</h1>
          <Link href={`/clients/${id}/consent`}>
            <Chip tone={data.consent ? "sage" : "amber"}>{data.consent ? t("clients.consentActive") : t("clients.consentMissing")}</Chip>
          </Link>
        </div>
        <Link href={data.consent || videoEnabled() ? `/sessions/new?client=${id}` : `/clients/${id}/consent`} className={buttonClass("primary", "lg")}>
          {t("clients.startSession")}
        </Link>
      </div>
      {!data.consent && <Notice tone="attention">{t("consent.required")}</Notice>}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="timeline-title" className="space-y-4">
          <h2 id="timeline-title" className="text-2xl">{t("clients.timeline")}</h2>
          {data.sessions.length === 0 ? (
            <p className="text-muted">{t("clients.noTimeline")}</p>
          ) : (
            <ol className="relative space-y-4 border-l border-line pl-6">
              {data.sessions.map((s) => (
                <li key={s.id} className="relative">
                  <span className={`absolute -left-[31px] top-2 h-3 w-3 rounded-full border-2 border-bg ${s.note_status === "approved" ? "bg-primary" : "bg-accent"}`} aria-hidden />
                  <Link href={`/sessions/${s.id}`} className="block rounded-card border border-line bg-surface p-4 hover:border-primary">
                    <p className="font-medium text-ink">{format.dateTime(s.started_at, { dateStyle: "medium" })}</p>
                    <p className="text-sm text-muted">
                      {t(`session.short_${s.capture_mode}`)}
                      {s.duration_seconds ? ` · ${Math.round(s.duration_seconds / 60)} min` : ""}
                      {" · "}{t(`review.status_${s.note_status ?? (s.status === "failed" ? "failed" : "processing")}`)}
                    </p>
                    {s.themes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">{s.themes.map((th: string) => <Chip key={th} tone="clay">{th}</Chip>)}</div>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="space-y-4">
          {(["theme", "goal", "homework", "change"] as const).map((kind) => (
            <Card key={kind} className="space-y-3 p-5">
              <h2 className="text-xl">{t(`clients.${kind === "theme" ? "themes" : kind === "goal" ? "goals" : kind === "change" ? "changes" : "homework"}`)}</h2>
              <TimelineList clientId={id} kind={kind} items={byKind(kind)} />
            </Card>
          ))}
        </section>
      </div>

      <ClientAppPanel clientId={id} active={data.client.status === "active"} data={data.app} />

      <ClientDanger clientId={id} pseudonym={data.client.pseudonym} archived={data.client.status === "archived"} />
    </div>
  );
}
