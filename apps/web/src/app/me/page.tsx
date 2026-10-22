import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { CalendarClock, ChevronRight, MessageCircle } from "lucide-react";
import { withUser } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { Arch } from "@/components/arch";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { HomeworkItem, LeaveApp, MoodCheckIn, MoodList } from "./parts";
import { VideoJoinBanner } from "@/components/video/join-banner";
import { videoEnabled } from "@/lib/video";

export async function generateMetadata() {
  return { title: (await getTranslations("me"))("title") };
}

export default async function ClientHome({ searchParams }: PageProps<"/me">) {
  const { session, role } = await requireClient();
  const t = await getTranslations("me");
  const f = await getFormatter();
  const welcome = (await searchParams).welcome === "1";

  if (role === "former_client") {
    return (
      <div className="space-y-6">
        <Card className="space-y-3">
          <h1 className="text-3xl">{t("disconnectedTitle")}</h1>
          <p className="text-muted">{t("disconnectedBody")}</p>
        </Card>
        <LeaveApp />
      </div>
    );
  }

  // Always this client's own rows: an admin in client view is also the therapist (lib/view.ts).
  const data = await withUser(session.user.id, async (db) => ({
    therapist: (await db.query("select my_therapist_name() as n")).rows[0].n as string,
    next: (await db.query("select min(starts_at) as s from appointments where client_id = current_client_id() and starts_at > now() - interval '1 hour'")).rows[0].s as Date | null,
    homework: (await db.query(
      `select id, title, details, to_char(due_on, 'YYYY-MM-DD') as due_on, done_at is not null as done, coalesce(client_reply, '') as reply
         from assignments where client_id = current_client_id() order by done_at nulls first, coalesce(due_on, '9999-12-31'), created_at desc limit 30`,
    )).rows,
    unread: (await db.query("select count(*)::int as n from messages where client_id = current_client_id() and not from_client and read_at is null")).rows[0].n as number,
    moods: (await db.query("select id, mood, note, shared, created_at from mood_entries where client_id = current_client_id() order by created_at desc limit 14")).rows,
  }));
  const open = data.homework.filter((h) => !h.done).length;

  return (
    <div className="space-y-8">
      {welcome && <Notice tone="success">{t("welcome", { name: data.therapist })}</Notice>}
      <section className="flex items-center gap-4 sm:gap-6">
        <Arch mood={open === 0 ? "done" : "idle"} alive followPointer className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />
        <div className="space-y-1">
          <h1 className="text-4xl">{t("hello")}</h1>
          <p className="text-ink"><span className="font-medium text-brand-ink">Arch:</span> {open > 0 ? t("archOpen", { count: open }) : t("archNone")}</p>
        </div>
      </section>

      {videoEnabled() && <VideoJoinBanner therapist={data.therapist} />}

      <Link href="/me/messages" className="block">
        <Card className="flex items-center gap-4 hover:border-primary">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><MessageCircle size={20} aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <p className="text-lg text-ink">{t("messagesTitle", { name: data.therapist })}</p>
            <p className="text-sm text-muted">{data.unread > 0 ? t("messagesUnread", { count: data.unread }) : t("messagesHint")}</p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
        </Card>
      </Link>

      <Card className="flex items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><CalendarClock size={20} aria-hidden /></span>
        <div>
          <p className="text-sm text-muted">{t("nextSession", { name: data.therapist })}</p>
          <p className="text-lg text-ink">{data.next ? f.dateTime(data.next, { dateStyle: "full", timeStyle: "short" }) : t("noNextSession")}</p>
        </div>
      </Card>

      <section aria-labelledby="hw-title" className="space-y-3">
        <h2 id="hw-title" className="text-2xl">{t("homeworkTitle")}</h2>
        {data.homework.length === 0 ? <p className="text-muted">{t("homeworkEmpty", { name: data.therapist })}</p> : (
          <ul className="space-y-3">
            {data.homework.map((h) => (
              <li key={h.id}>
                <HomeworkItem item={{ ...h, due_label: h.due_on ? f.dateTime(new Date(`${h.due_on}T12:00:00`), { dateStyle: "medium" }) : null }} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="mood-title" className="space-y-3">
        <h2 id="mood-title" className="text-2xl">{t("moodTitle")}</h2>
        <MoodCheckIn therapist={data.therapist} />
        <MoodList items={data.moods.map((m) => ({ id: m.id, mood: m.mood, note: m.note, shared: m.shared, when: f.dateTime(m.created_at, { dateStyle: "medium", timeStyle: "short" }) }))} />
      </section>

    </div>
  );
}
