import { getTranslations } from "next-intl/server";
import {
  CalendarClock, ClipboardCheck, EyeOff, Globe2, GlobeLock, Languages, Link2, MessageCircleQuestion, NotebookPen,
  Search, ShieldCheck, Smartphone, Sprout, UsersRound, Video,
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

/** Arch as an AI practice agent: a small picture of a real exchange. */
export async function ArchAgentVisual() {
  const t = await getTranslations("landing");
  const caps = [
    { icon: Search, label: t("agentCap1") },
    { icon: CalendarClock, label: t("agentCap2") },
    { icon: ClipboardCheck, label: t("agentCap3") },
    { icon: ShieldCheck, label: t("agentCap4") },
  ];
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_1.1fr]">
      <div className="space-y-5">
        <h2 id="arch-title" className="text-3xl text-ink sm:text-4xl">{t("agentTitle")}</h2>
        <p className="text-lg text-muted">{t("agentBody")}</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {caps.map((c) => (
            <li key={c.label} className="flex items-center gap-3 text-ink">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><c.icon size={19} aria-hidden /></span>
              {c.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-3 rounded-panel border border-line bg-surface-2 p-4 sm:p-5" role="img" aria-label={t("agentDemoLabel")}>
        <p className="ml-auto w-fit max-w-[85%] rounded-card rounded-br-sm bg-primary-soft px-4 py-2.5 text-ink">{t("agentAsk")}</p>
        <div className="flex items-start gap-2">
          <Arch mood="thinking" className="h-11 w-11 shrink-0" />
          <div className="space-y-2 rounded-card rounded-tl-sm border border-line bg-surface p-3.5 text-sm text-ink shadow-[var(--shadow)]">
            <p>{t("agentAnswer1")} <span className="whitespace-nowrap text-primary-strong underline underline-offset-4">9 Oct · 1:36</span></p>
            <p>{t("agentAnswer2")} <span className="whitespace-nowrap text-primary-strong underline underline-offset-4">9 Oct · 2:37</span></p>
          </div>
        </div>
        <div className="ml-12 space-y-2 rounded-card border border-primary bg-surface p-3.5 text-sm">
          <p className="flex items-center gap-2 text-muted"><ClipboardCheck size={15} className="text-primary-strong" /> {t("agentCard")}</p>
          <p className="font-medium text-ink">{t("agentCardTitle")}</p>
          <span className="inline-flex rounded-control bg-primary-strong px-3 py-1 text-xs font-medium text-on-primary">{t("agentApprove")}</span>
        </div>
      </div>
    </div>
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
