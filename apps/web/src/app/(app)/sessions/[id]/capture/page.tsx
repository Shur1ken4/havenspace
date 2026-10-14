import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { Chip } from "@/components/ui/chip";
import { Recorder } from "./recorder";
import { Uploader } from "./uploader";
import { RecapForm } from "./recap";

export default async function CapturePage({ params }: PageProps<"/sessions/[id]/capture">) {
  const { id } = await params;
  const { therapist } = await requireTherapist();
  const t = await getTranslations("session");
  const s = await withUser(therapist.id, async (db) => (await db.query(
    `select s.id, s.status, s.capture_mode, c.pseudonym, c.id as client_id,
            exists (select 1 from audio_chunks a where a.session_id = s.id and a.track <> 'calibration') as has_audio
       from sessions s join clients c on c.id = s.client_id where s.id = $1`, [id],
  )).rows[0]).catch(() => null);
  if (!s) notFound();
  if (!["draft", "recording"].includes(s.status)) redirect(`/sessions/${id}`);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date());
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/clients/${s.client_id}`} className="text-sm text-muted hover:text-ink">← {s.pseudonym}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl">{s.pseudonym}</h1>
        {s.capture_mode !== "recap" && <Chip>{t("consentConfirmed")}</Chip>}
        <Chip tone="plain">{t(`mode_${s.capture_mode}`)}</Chip>
      </div>
      {(s.capture_mode === "online_call" || s.capture_mode === "in_person") && (
        <Recorder sessionId={id} mode={s.capture_mode} hasSavedVoice={Boolean(therapist.voice_enrolled_at)} interrupted={s.status === "recording" && s.has_audio} />
      )}
      {s.capture_mode === "upload" && <Uploader sessionId={id} />}
      {s.capture_mode === "recap" && <RecapForm sessionId={id} today={today} />}
    </div>
  );
}
