import { getTranslations } from "next-intl/server";
import {
  CalendarClock, EyeOff, Globe2, GlobeLock, Languages, Link2, MessageCircleQuestion, NotebookPen,
  ShieldCheck, Smartphone, Sprout, UsersRound, Video,
} from "lucide-react";
import { Arch } from "@/components/arch";

// Landing visuals (less text, more pictures). Everything shown is a made-up example.

/** "How it works" as three small pictures with a few words each. */
export async function StepsVisual() {
  const t = await getTranslations("landing");
  const frame = "flex h-40 items-center justify-center overflow-hidden rounded-card border border-line bg-surface-2 p-4";
  return (
    <ol className="grid gap-5 md:grid-cols-3">
      <li className="space-y-3">
        <div className={frame} aria-hidden>
          <div className="relative h-full w-full overflow-hidden rounded-inner bg-[#1E2421]">
            <div className="absolute inset-3 flex items-center justify-center rounded-inner bg-calm-blue/40"><UsersRound size={34} className="text-white/80" /></div>
            <div className="absolute bottom-2 right-2 h-9 w-14 rounded-md border border-white/30 bg-primary/60" />
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white"><span className="breathing-dot !h-1.5 !w-1.5" /> REC</span>
          </div>
        </div>
        <p className="font-serif text-2xl"><span className="text-muted">1.</span> {t("v_step1")}</p>
        <p className="text-muted">{t("v_step1Body")}</p>
      </li>
      <li className="space-y-3">
        <div className={frame} aria-hidden>
          <div className="relative w-full space-y-2 rounded-inner bg-surface p-3 shadow-[var(--shadow)]">
            {["S", "O", "A", "P"].map((k, i) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-3 text-[10px] font-medium text-muted">{k}</span>
                <span className="h-2 rounded-full bg-primary-soft" style={{ width: `${[78, 52, 66, 44][i]}%` }} />
              </div>
            ))}
            <Arch mood="writing" className="absolute -bottom-3 -right-2 h-14 w-14" />
          </div>
        </div>
        <p className="font-serif text-2xl"><span className="text-muted">2.</span> {t("v_step2")}</p>
        <p className="text-muted">{t("v_step2Body")}</p>
      </li>
      <li className="space-y-3">
        <div className={frame} aria-hidden>
          <div className="w-full space-y-2">
            {[{ c: "bg-primary-soft text-primary-strong", w: "70%" }, { c: "bg-accent-soft text-ink", w: "55%" }].map((r, i) => (
              <div key={i} className="space-y-1.5 rounded-inner bg-surface p-2.5 shadow-[var(--shadow)]">
                <span className={`inline-block h-3 w-16 rounded-full ${r.c}`} />
                <span className="block h-2 rounded-full bg-surface-2" style={{ width: r.w }} />
                <span className="flex items-center gap-1 text-[10px] text-muted"><Link2 size={10} /> 14:32</span>
              </div>
            ))}
          </div>
        </div>
        <p className="font-serif text-2xl"><span className="text-muted">3.</span> {t("v_step3")}</p>
        <p className="text-muted">{t("v_step3Body")}</p>
      </li>
    </ol>
  );
}

/** Everything in one place, as icons with a few words. */
export async function FeatureGrid() {
  const t = await getTranslations("landing");
  const items = [
    { icon: Video, label: t("f_video") },
    { icon: NotebookPen, label: t("f_notes") },
    { icon: Sprout, label: t("f_reflection") },
    { icon: MessageCircleQuestion, label: t("f_arch") },
    { icon: Smartphone, label: t("f_clientApp") },
    { icon: CalendarClock, label: t("f_supervision"), soon: true },
    { icon: Languages, label: t("f_languages") },
    { icon: GlobeLock, label: t("f_eu") },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <li key={it.label} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><it.icon size={21} aria-hidden /></span>
          <span className="font-medium leading-snug text-ink">{it.label}</span>
          {it.soon && <span className="w-fit rounded-full bg-attention-soft px-2 py-0.5 text-xs text-ink">{t("soon")}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Privacy as three big promises. */
export async function PrivacyVisual() {
  const t = await getTranslations("landing");
  const promises = [
    { icon: ShieldCheck, label: t("promise1Title") },
    { icon: Globe2, label: t("promise2Title") },
    { icon: EyeOff, label: t("promise3Title") },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {promises.map((p) => (
        <li key={p.label} className="flex items-center gap-4 rounded-card border border-line bg-surface p-5 sm:flex-col sm:items-start">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><p.icon size={26} aria-hidden /></span>
          <span className="text-lg font-medium leading-snug text-ink">{p.label}</span>
        </li>
      ))}
    </ul>
  );
}
