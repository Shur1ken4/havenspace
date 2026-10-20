"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Ear, NotebookPen, Pause, Play, DoorClosed, Check, Lightbulb } from "lucide-react";
import { Arch, type ArchMood } from "@/components/arch";
import { useInView } from "@/lib/use-in-view";

/** The hero: Arch acts out one session, from listening to closing the door. */
const SCENES: { mood: ArchMood; key: string; icon: typeof Ear }[] = [
  { mood: "listening", key: "listening", icon: Ear },
  { mood: "writing", key: "working", icon: NotebookPen },
  { mood: "thinking", key: "thinking", icon: Lightbulb },
  { mood: "celebrate", key: "done", icon: Check },
  { mood: "resting", key: "resting", icon: DoorClosed },
];
const SCENE_MS = 4200;

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function ArchStage() {
  const t = useTranslations("arch");
  const [scene, setScene] = useState(0);
  // null = the visitor hasn't chosen; then play unless they prefer reduced motion.
  const [choice, setChoice] = useState<boolean | null>(null);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCED).matches, () => false);
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root);
  const playing = (choice ?? !reduced) && visible;
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

  return (
    <div ref={root} data-paused={!visible} className="relative mx-auto flex w-full max-w-md flex-col items-center gap-5">
      <div
        aria-hidden
        className="absolute left-1/2 top-[38%] -z-10 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent)" }}
      />
      <Arch mood={mood} followPointer onClick={() => setHello(true)} label={t("sayHello")} className="h-64 w-64 sm:h-80 sm:w-80" />

      <div className="w-full rounded-[18px] border border-line bg-surface p-4 shadow-[var(--shadow)]" aria-live="polite">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted">
          <span className="font-medium text-brand-ink">Arch</span> · {hello ? t("helloTag") : t(`${current.key}Tag`)}
        </p>
        <p className="mt-1.5 text-lg text-ink">{hello ? t("hello") : t(current.key)}</p>
      </div>

      <div className="flex items-center gap-3">
        <ol className="flex gap-2" aria-label={t("scenes")}>
          {SCENES.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => { setHello(false); setScene(i); }}
                aria-current={i === scene ? "step" : undefined}
                aria-label={t(`${s.key}Tag`)}
                className={`flex h-9 w-9 items-center justify-center rounded-full border ${i === scene ? "border-primary bg-primary-soft text-primary-strong" : "border-line bg-surface text-muted hover:text-ink"}`}
              >
                <s.icon size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setChoice(!(choice ?? !reduced))}
          aria-label={(choice ?? !reduced) ? t("pause") : t("play")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
        >
          {(choice ?? !reduced) ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
