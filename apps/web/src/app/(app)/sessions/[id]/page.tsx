import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { audit } from "@/lib/audit";
import { packFor } from "@/lib/modalities";
import { Chip } from "@/components/ui/chip";
import type { NoteContent, ReflectionContent, Segment } from "@/lib/types";
import { Review } from "./review";
import { Progress } from "./progress";
import { Failed } from "./failed";
import { DeleteSession } from "./delete-session";
import { LiveInsights, type LiveInsightRow } from "./live-insights";

export async function generateMetadata() {
  return { title: (await getTranslations("meta"))("session") };
}

export default async function SessionPage({ params, searchParams }: PageProps<"/sessions/[id]">) {
  // ?moment=<segment> opens the transcript at that moment (links from Arch).
  const momentParam = Number((await searchParams).moment);
  const moment = Number.isInteger(momentParam) && momentParam >= 0 ? momentParam : undefined;
  const { id } = await params;
  const { therapist } = await requireTherapist();
  const t = await getTranslations();
  const format = await getFormatter();
  const data = await withUser(therapist.id, async (db) => {
    const s = (await db.query(
      `select s.*, c.pseudonym from sessions s join clients c on c.id = s.client_id where s.id = $1`, [id],
    )).rows[0];
    if (!s) return null;
    const segments = (await db.query<Segment>(
      "select idx, speaker, start_ms, end_ms, text from transcript_segments where session_id = $1 order by idx", [id],
    )).rows;
    const note = (await db.query("select status, approved_at, content_json from notes where session_id = $1", [id])).rows[0];
    const reflection = (await db.query("select modality, content_json, dropped_items from reflections where session_id = $1", [id])).rows[0];
    const live = s.live_research ? (await db.query<LiveInsightRow>(
      "select id, offset_ms, content from live_insights where session_id = $1 order by id", [id],
    )).rows : [];
    await audit(db, therapist.id, "session.view", "session", id);
    return { s, segments, note, reflection, live };
  }).catch(() => null);
  if (!data) notFound();
  const { s } = data;
  if (s.status === "draft" || s.status === "recording") redirect(`/sessions/${id}/capture`);

  const pack = data.reflection ? packFor(data.reflection.modality) : null;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href={`/clients/${s.client_id}`} className="text-sm text-muted hover:text-ink">← {s.pseudonym}</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-4xl">{s.pseudonym} · {format.dateTime(s.started_at, { dateStyle: "medium" })}</h1>
          <div className="flex flex-wrap gap-2">
            <Chip tone="plain">{t(`session.short_${s.capture_mode}`)}</Chip>
            {s.duration_seconds ? <Chip tone="plain">{Math.round(s.duration_seconds / 60)} min</Chip> : null}
            {s.audio_deleted_at && <Chip>{t("review.audioDeleted", { date: format.dateTime(s.audio_deleted_at, { dateStyle: "medium" }) })}</Chip>}
            {!s.audio_deleted_at && s.audio_delete_after && <Chip tone="amber">{t("review.audioKept", { date: format.dateTime(s.audio_delete_after, { dateStyle: "medium" }) })}</Chip>}
          </div>
        </div>
      </div>
      {(s.status === "uploaded" || s.status === "processing") && <Progress sessionId={id} initialStage={s.stage} />}
      {s.status === "failed" && <Failed sessionId={id} canRetry={s.error_code !== "consent_withdrawn"} />}
      {s.status === "ready" && (
        <Review
          initialMoment={moment}
          sessionId={id}
          isRecap={s.capture_mode === "recap"}
          segments={data.segments}
          speakerNames={s.speaker_names ?? {}}
          note={data.note ? { status: data.note.status, approvedAt: data.note.approved_at?.toISOString() ?? null, content: data.note.content_json as NoteContent } : null}
          reflection={data.reflection && pack ? {
            content: data.reflection.content_json as ReflectionContent,
            modalityName: pack.name,
            dimensions: pack.dimensions.map((d) => ({ id: d.id, label: d.label, description: d.description })),
            dropped: data.reflection.dropped_items,
          } : null}
        />
      )}
      {data.live.length > 0 && <div className="border-t border-line pt-6"><LiveInsights insights={data.live} /></div>}
      <div className="border-t border-line pt-6"><DeleteSession sessionId={id} /></div>
    </div>
  );
}
