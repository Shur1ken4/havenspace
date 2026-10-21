"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, ClipboardCheck, Pause, Play, Search, ShieldCheck } from "lucide-react";
import { Arch, type ArchMood } from "@/components/arch";
import { useInView } from "@/lib/use-in-view";

/**
 * "Arch, your AI practice agent": Arch in full size acts out what he does, one
 * scene at a time, and each scene lights up the matching point on the left.
 */
const CAPS = [
  { key: "agentCap1", icon: Search },
  { key: "agentCap2", icon: CalendarClock },
  { key: "agentCap3", icon: ClipboardCheck },
  { key: "agentCap4", icon: ShieldCheck },
] as const;
const SCENES: { mood: ArchMood; cap: number | null }[] = [
  { mood: "curious", cap: 0 },
  { mood: "thinking", cap: 1 },
  { mood: "writing", cap: 2 },
  { mood: "listening", cap: 3 },
  { mood: "resting", cap: null },
];
const SCENE_MS = 4600;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function ArchAgentStage() {
  const t = useTranslations("landing");
  const ta = useTranslations("arch");
  const [scene, setScene] = useState(0);
  // null = the visitor hasn't chosen; then play unless they prefer reduced motion.
  const [choice, setChoice] = useState<boolean | null>(null);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCED).matches, () => false);
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root);
  const wantsPlay = choice ?? !reduced;
  const playing = wantsPlay && visible;
  const [hello, setHello] = useState(false);

  useEffect(() => {
    if (!playing || hello) return;
    const id = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENE_MS);
    return () => clearTimeout(id);
  }, [playing, hello, scene]);
  useEffect(() => {
    if (!hello) return;
    const id = setTimeout(() => setHello(false), 3800);
    return () => clearTimeout(id);
  }, [hello]);

  const current = SCENES[scene];
  const mood: ArchMood = hello ? "hello" : current.mood;
  const tag = hello ? ta("helloTag") : current.cap === null ? t("agentDoneTag") : t(CAPS[current.cap].key);

  return (
    <div ref={root} data-paused={!visible} className="grid items-center gap-10 md:grid-cols-[1fr_1fr]">
      <div className="space-y-5">
        <h2 id="arch-title" className="text-3xl text-ink sm:text-4xl">{t("agentTitle")}</h2>
        <p className="text-lg text-muted">{t("agentBody")}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CAPS.map((c, i) => {
            const on = !hello && current.cap === i;
            return (
              <li key={c.key}>
                <button type="button" aria-pressed={on} onClick={() => { setHello(false); setScene(i); }}
                  className={`flex w-full items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors duration-300 ${
                    on ? "border-primary bg-primary-soft" : "border-transparent hover:bg-surface-2"}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary-strong text-on-primary" : "bg-primary-soft text-primary-strong"}`}>
                    <c.icon size={19} aria-hidden />
                  </span>
                  <span className="text-ink">{t(c.key)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-col items-center gap-5">
        <div aria-hidden className="absolute left-1/2 top-[36%] -z-10 h-[110%] w-[110%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent)" }} />
        <Arch mood={mood} followPointer onClick={() => setHello(true)} label={ta("sayHello")} className="h-56 w-56 sm:h-72 sm:w-72" />
        <div className="w-full rounded-card border border-line bg-surface p-4 shadow-[var(--shadow)]" aria-live="polite">
          <p className="text-xs uppercase tracking-[0.12em] text-muted"><span className="font-medium text-brand-ink">Arch</span> · {tag}</p>
          <p className="mt-1.5 text-lg text-ink">{hello ? t("agentHello") : t(`agentScene${scene}`)}</p>
        </div>
        <div className="flex items-center gap-3">
          <ol className="flex gap-1.5" aria-label={ta("scenes")}>
            {SCENES.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => { setHello(false); setScene(i); }} aria-current={i === scene ? "step" : undefined}
                  aria-label={s.cap === null ? t("agentDoneTag") : t(CAPS[s.cap].key)}
                  className="flex h-6 w-6 items-center justify-center">
                  <span className={`block h-2 rounded-full transition-all duration-300 ${i === scene ? "w-5 bg-primary-strong" : "w-2 bg-line"}`} />
                </button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setChoice(!wantsPlay)} aria-label={wantsPlay ? ta("pause") : ta("play")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink">
            {wantsPlay ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
