"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Arch, type ArchMood } from "@/components/arch";

const ORDER = ["queued", "transcribing", "labelling", "cleaning", "writing_note", "reflecting", "timeline"];
// What Arch is doing at each step (only Arch's own work, never a reaction to content).
const MOOD: Record<string, ArchMood> = {
  queued: "idle", transcribing: "transcribing", labelling: "curious", cleaning: "writing",
  writing_note: "writing", reflecting: "thinking", timeline: "writing",
};

/** After this long in the queue, say plainly that processing hasn't started. */
const SLOW_QUEUE_SECONDS = 5 * 60;

export function Progress({ sessionId, initialStage }: { sessionId: string; initialStage: string | null }) {
  const t = useTranslations("review");
  const router = useRouter();
  const [stage, setStage] = useState(initialStage ?? "queued");
  const [queuedFor, setQueuedFor] = useState(0);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      while (alive) {
        await new Promise((r) => setTimeout(r, 2500));
        const res = await fetch(`/api/sessions/${sessionId}/status`, { cache: "no-store" }).catch(() => null);
        if (!res?.ok) continue;
        const s = await res.json();
        if (s.status === "ready" || s.status === "failed") { router.refresh(); return; }
        if (s.stage) setStage(s.stage);
        setQueuedFor(Number(s.queued_seconds ?? 0));
      }
    };
    poll();
    return () => { alive = false; };
  }, [sessionId, router]);
  const current = Math.max(0, ORDER.indexOf(stage));
  return (
    <Card className="mx-auto max-w-xl space-y-6 py-10 text-center">
      <Arch mood={MOOD[ORDER[current]] ?? "writing"} alive className="mx-auto h-44 w-44" label={t("archWaiting")} />
      <h2 className="text-3xl">{t("progressTitle")}</h2>
      <p className="flex items-center justify-center gap-3 text-lg text-ink" aria-live="polite">
        <span className="breathing-dot" /> {t(`stage_${ORDER[current]}`)}
      </p>
      <ol className="mx-auto flex max-w-xs gap-1.5" aria-hidden>
        {ORDER.slice(1).map((s, i) => <li key={s} className={`h-1.5 flex-1 rounded-full ${i < current ? "bg-primary" : "bg-surface-2"}`} />)}
      </ol>
      <p className="text-sm text-muted">{t("archWaiting")}</p>
      <p className="text-sm text-muted">{t("progressHint")}</p>
      {stage === "queued" && queuedFor >= SLOW_QUEUE_SECONDS && (
        <p className="mx-auto max-w-md rounded-card bg-attention-soft px-4 py-3 text-sm text-ink" role="status">{t("queueSlow")}</p>
      )}
    </Card>
  );
}
