"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

// Live research mode (ADR-10). Shows the worker's short reads during a
// role-play session. Experimental; never part of the product.

type Insight = { id: number; offset_ms: number; content: { now: string; openings: { point: string; quote: string }[]; idea: string } };
type Line = { id: number; speaker: string; offset_ms: number; text: string };

const POLL_MS = 3000;

export function clock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function LivePanel({ sessionId, active }: { sessionId: string; active: boolean }) {
  const t = useTranslations("live");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const last = useRef(0);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/live?after=${last.current}`, { cache: "no-store" });
        if (res.ok && !stopped) {
          const data: { insights: Insight[]; lines: Line[] } = await res.json();
          if (data.insights.length) {
            last.current = data.insights[data.insights.length - 1].id;
            setInsights((prev) => [...prev, ...data.insights]);
          }
          // Sentences cut between two clips are joined back for reading.
          const merged: Line[] = [];
          for (const l of data.lines) {
            const prev = merged[merged.length - 1];
            if (prev && prev.speaker === l.speaker) merged[merged.length - 1] = { ...prev, text: `${prev.text} ${l.text}` };
            else merged.push(l);
          }
          setLines(merged.slice(-3));
        }
      } catch { /* try again on the next tick */ }
    };
    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [sessionId, active]);

  const latest = insights[insights.length - 1];
  const earlier = insights.slice(0, -1).reverse().slice(0, 6);
  const who = (s: string) => (s === "therapist" ? t("you") : s === "client" ? t("client") : t("speaker"));

  return (
    <Card className="space-y-5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">{t("title")}</h2>
        <Chip tone="amber">{t("badge")}</Chip>
      </div>

      {latest ? (
        <div className="space-y-4" aria-live="polite">
          <p className="text-sm text-muted">{clock(latest.offset_ms)}</p>
          <p className="text-lg leading-relaxed text-ink">{latest.content.now}</p>
          {latest.content.openings.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-muted"><MessageCircle size={16} aria-hidden /> {t("openings")}</p>
              <ul className="space-y-2">
                {latest.content.openings.map((o, i) => (
                  <li key={i} className="rounded-xl bg-calm-blue-soft px-4 py-3">
                    <p className="text-ink">{o.point}</p>
                    <p className="mt-1 font-serif italic text-muted">“{o.quote}”</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {latest.content.idea && (
            <div className="flex gap-3 rounded-xl bg-primary-soft px-4 py-3 text-ink">
              <Lightbulb size={18} className="mt-1 shrink-0 text-primary-strong" aria-hidden />
              <p>{latest.content.idea}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-muted"><span className="breathing-dot mr-2 align-middle" />{t("listening")}</p>
      )}

      {lines.length > 0 && (
        <div className="space-y-1 border-t border-line pt-4">
          <p className="text-sm font-medium text-muted">{t("heard")}</p>
          {lines.map((l) => (
            <p key={l.id} className="text-sm text-muted"><span className="text-ink">{who(l.speaker)}:</span> {l.text}</p>
          ))}
        </div>
      )}

      {earlier.length > 0 && (
        <details className="border-t border-line pt-4 text-sm">
          <summary className="cursor-pointer text-muted">{t("earlier")}</summary>
          <ul className="mt-2 space-y-2">
            {earlier.map((i) => <li key={i.id} className="text-muted"><span className="tabular-nums">{clock(i.offset_ms)}</span> · {i.content.now}</li>)}
          </ul>
        </details>
      )}

      <p className="text-xs text-muted">{t("disclaimer")}</p>
    </Card>
  );
}
