"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Check, CircleCheck, Link2 } from "lucide-react";
import { Arch, type ArchMood } from "@/components/arch";
import { useInView } from "@/lib/use-in-view";

/**
 * The landing hero: a role-play session turning into a note, with Arch at work on
 * top of the window. Everything shown is a made-up example. It rests (no timers,
 * no animation) while scrolled out of view.
 * CLINICAL-REVIEW: the sample transcript, note and reflection (messages: heroDemo).
 */
type Phase = "listening" | "writing" | "reflecting" | "done";
// One tick = 900 ms; the whole loop takes about 20 seconds.
const TIMELINE: { phase: Phase; ticks: number }[] = [
  { phase: "listening", ticks: 7 },
  { phase: "writing", ticks: 6 },
  { phase: "reflecting", ticks: 5 },
  { phase: "done", ticks: 4 },
];
const TOTAL = TIMELINE.reduce((n, p) => n + p.ticks, 0);
const MOOD: Record<Phase, ArchMood> = { listening: "listening", writing: "writing", reflecting: "thinking", done: "celebrate" };

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

function at(tick: number): { phase: Phase; step: number } {
  let rest = tick;
  for (const p of TIMELINE) {
    if (rest < p.ticks) return { phase: p.phase, step: rest };
    rest -= p.ticks;
  }
  return { phase: "done", step: 0 };
}

export function HeroDemo() {
  const t = useTranslations("heroDemo");
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCED).matches, () => false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced || !visible) return;
    const id = setInterval(() => setTick((n) => (n + 1) % TOTAL), 900);
    return () => clearInterval(id);
  }, [reduced, visible]);

  // Without motion, show the finished result rather than a frozen first frame.
  const { phase, step } = reduced ? { phase: "done" as Phase, step: 3 } : at(tick);
  const tabs: { key: Phase | "transcript"; label: string; active: boolean }[] = [
    { key: "transcript", label: t("tabTranscript"), active: phase === "listening" },
    { key: "writing", label: t("tabNote"), active: phase === "writing" || phase === "done" },
    { key: "reflecting", label: t("tabReflection"), active: phase === "reflecting" },
  ];
  const lines = [
    { who: "you", text: t("line1") },
    { who: "client", text: t("line2") },
    { who: "you", text: t("line3") },
    { who: "client", text: t("line4") },
  ] as const;
  const note = [
    { label: t("noteDataLabel"), text: t("noteData") },
    { label: t("noteAssessLabel"), text: t("noteAssess") },
    { label: t("notePlanLabel"), text: t("notePlan") },
  ];

  return (
    <div ref={root} data-paused={!visible} className="relative mx-auto w-full min-w-0 max-w-xl pt-[7.6rem] sm:pt-40" aria-label={t("label")} role="img">
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 -z-10 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent)" }}
      />

      {/* Arch stands on the window and says what it's doing. */}
      <div aria-hidden className="absolute right-2 top-0 flex max-w-full items-end gap-1 sm:right-8 sm:gap-2">
        <p key={phase} className="fade-up mb-14 min-w-0 max-w-[11rem] rounded-2xl rounded-br-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink shadow-[var(--shadow)] sm:mb-20 sm:max-w-[14rem]">
          {t(`arch_${phase}`)}
        </p>
        <Arch mood={MOOD[phase]} className="-mb-[6px] h-32 w-32 shrink-0 sm:-mb-[8px] sm:h-44 sm:w-44" />
      </div>

      <div aria-hidden className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(47,58,53,0.25)]">
        {/* Window bar */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
          </div>
          <p className="min-w-0 truncate text-xs text-muted">{t("sessionMeta")}</p>
          <p className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            {phase === "listening"
              ? <><span className="breathing-dot !h-2 !w-2" /> {t("recording")}</>
              : <><CircleCheck size={13} className="text-primary-strong" /> {t("audioDeleted")}</>}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3">
          {tabs.map((tab) => (
            <span key={tab.key} className={`rounded-full px-3 py-1 text-xs ${tab.active ? "bg-primary-soft font-medium text-primary-strong" : "text-muted"}`}>
              {tab.label}
            </span>
          ))}
        </div>

        <div className="h-[19rem] px-4 pb-4 pt-3 sm:px-5">
          {phase === "listening" && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-muted">
                {(["you", "client"] as const).map((who, w) => (
                  <span key={who} className="flex items-center gap-2">
                    {who === "you" ? t("you") : t("client")}
                    <span className="demo-wave flex h-4 items-center gap-[3px]">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className="h-full" style={{ background: w ? "var(--calm-blue)" : "var(--primary)", animationDelay: `${(i * 0.13 + w * 0.4).toFixed(2)}s` }} />
                      ))}
                    </span>
                  </span>
                ))}
              </div>
              {lines.slice(0, Math.min(4, step + 1)).map((l, i) => (
                <div key={i} className="fade-up flex gap-3 text-sm">
                  <span className={`w-14 shrink-0 text-xs font-medium leading-6 ${l.who === "you" ? "text-primary-strong" : "text-calm-blue"}`}>
                    {l.who === "you" ? t("you") : t("client")}
                  </span>
                  <p className="text-ink">{l.text}</p>
                </div>
              ))}
            </div>
          )}

          {(phase === "writing" || phase === "done") && (
            <div className="space-y-3.5">
              {note.map((n, i) => (
                <div key={n.label} className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{n.label}</p>
                  {phase === "done" || step > i * 2
                    ? <p className={`text-sm text-ink ${phase === "writing" ? "demo-type" : ""}`}>{n.text}</p>
                    : <div className="space-y-1.5"><div className="demo-shimmer h-3 w-11/12 rounded" /><div className="demo-shimmer h-3 w-2/3 rounded" /></div>}
                </div>
              ))}
              {phase === "done" && (
                <div className="fade-up flex items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="flex items-center gap-1.5 text-sm text-muted"><Check size={15} className="text-primary-strong" /> {t("ready")}</p>
                  <span className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-white">{t("approve")}</span>
                </div>
              )}
            </div>
          )}

          {phase === "reflecting" && (
            <div className="space-y-3">
              {[
                { label: t("wellLabel"), text: t("well"), time: "02:14", tone: "bg-primary-soft text-primary-strong" },
                { label: t("tryLabel"), text: t("try"), time: "04:40", tone: "bg-accent-soft text-ink" },
              ].slice(0, step >= 2 ? 2 : 1).map((r) => (
                <div key={r.label} className="fade-up space-y-2 rounded-xl border border-line p-3.5">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs ${r.tone}`}>{r.label}</span>
                  <p className="text-sm text-ink">{r.text}</p>
                  <p className="flex items-center gap-1 text-xs text-muted"><Link2 size={12} /> {t("moment", { time: r.time })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
