import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight, Check, EyeOff, GlobeLock, KeyRound, Mic, NotebookPen, ShieldCheck, Sprout,
} from "lucide-react";
import { PlantIllustration, WindowIllustration } from "@/components/illustrations";
import { ArchStage } from "@/components/marketing/arch-stage";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { SignupForm } from "@/components/marketing/signup-form";
import { Pricing } from "@/components/marketing/pricing";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const a = await getTranslations("arch");
  const b = await getTranslations("badges");

  const steps = [
    { icon: Mic, title: t("step1Title"), body: t("step1Body") },
    { icon: NotebookPen, title: t("step2Title"), body: t("step2Body") },
    { icon: Sprout, title: t("step3Title"), body: t("step3Body") },
  ];
  const promises = [
    { icon: ShieldCheck, title: t("promise1Title"), body: t("promise1Body") },
    { icon: GlobeLock, title: t("promise2Title"), body: t("promise2Body") },
    { icon: EyeOff, title: t("promise3Title"), body: t("promise3Body") },
  ];
  const worksWith = ["works1", "works2", "works3", "works4", "works5", "works6"] as const;
  // CLINICAL-REVIEW: how Arch is described to therapists.
  const archPoints = [
    { title: a("lightTitle"), body: a("lightBody") },
    { title: a("neverTitle"), body: a("neverBody") },
    { title: a("decideTitle"), body: a("decideBody") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-6 pb-12 [&>*]:min-w-0 pt-6 md:grid-cols-[1fr_1.1fr] md:gap-10 md:pb-16 md:pt-12">
        <div className="fade-up space-y-6">
          <h1 className="text-[2.6rem] leading-[1.08] text-ink sm:text-5xl md:text-[3.6rem]">
            {t.rich("heroTitle", { em: (chunks) => <span className="hero-accent">{chunks}</span> })}
          </h1>
          <p className="max-w-xl text-lg text-muted">{t("heroBody")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={buttonClass("primary", "lg")}>{t("heroCta")} <ArrowRight size={18} aria-hidden /></Link>
            <a href="#join" className={buttonClass("secondary", "lg")}>{t("heroSecondary")}</a>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
            <span className="flex items-center gap-1.5"><ShieldCheck size={15} className="text-primary-strong" aria-hidden /> {b("audioDeleted")}</span>
            <span className="flex items-center gap-1.5"><GlobeLock size={15} className="text-primary-strong" aria-hidden /> {b("euStored")}</span>
            <span className="flex items-center gap-1.5"><EyeOff size={15} className="text-primary-strong" aria-hidden /> {b("noTraining")}</span>
          </p>
        </div>
        <HeroDemo />
      </section>

      {/* Works wherever sessions happen */}
      <section aria-labelledby="works-title" className="border-y border-line py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-8">
          <h2 id="works-title" className="shrink-0 font-sans text-sm text-muted">{t("worksTitle")}</h2>
          <ul className="flex flex-wrap gap-x-7 gap-y-2 font-serif text-lg text-ink/80 sm:text-xl">
            {worksWith.map((k) => <li key={k}>{t(k)}</li>)}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" aria-labelledby="how-title" className="scroll-mt-20 py-16">
        <h2 id="how-title" className="text-3xl text-ink sm:text-4xl">{t("howTitle")}</h2>
        <p className="mt-3 max-w-2xl text-lg text-muted">{t("howIntro")}</p>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
                    <s.icon size={20} aria-hidden />
                  </span>
                  <span className="text-sm text-muted">{i + 1}</span>
                </div>
                <h3 className="text-2xl">{s.title}</h3>
                <p className="text-muted">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Arch */}
      <section id="arch" aria-labelledby="arch-title" className="scroll-mt-20 grid items-center gap-10 py-16 md:grid-cols-[1fr_1.1fr]">
        <div className="order-2 md:order-1"><ArchStage /></div>
        <div className="order-1 space-y-5 md:order-2">
          <h2 id="arch-title" className="text-3xl text-ink sm:text-4xl">{a("meetTitle")}</h2>
          <p className="text-lg text-muted">{a("meetIntro")}</p>
          <ul className="space-y-4">
            {archPoints.map((p) => (
              <li key={p.title} className="flex gap-3">
                <Check size={18} className="mt-1 shrink-0 text-primary-strong" aria-hidden />
                <p><span className="font-medium text-ink">{p.title}.</span> <span className="text-muted">{p.body}</span></p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reflection */}
      <section id="reflection" aria-labelledby="reflect-title" className="scroll-mt-20 grid gap-10 py-16 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <h2 id="reflect-title" className="text-3xl text-ink sm:text-4xl">{t("reflectTitle")}</h2>
          <p className="text-lg text-muted">{t("reflectBody")}</p>
          <PlantIllustration className="hidden h-36 w-36 md:block" />
        </div>
        <div className="space-y-3" aria-label={t("reflectSampleLabel")}>
          <p className="text-sm text-muted">{t("reflectSampleLabel")}</p>
          {[
            { label: t("sampleStrengthLabel"), text: t("sampleStrength"), tone: "sage" as const },
            { label: t("sampleOpeningLabel"), text: t("sampleOpening"), tone: "blue" as const },
            { label: t("sampleTryLabel"), text: t("sampleTry"), tone: "clay" as const },
          ].map((item) => (
            <Card key={item.label} className="space-y-2 p-5">
              <Chip tone={item.tone}>{item.label}</Chip>
              <p className="text-ink">{item.text}</p>
              <p className="text-sm text-muted">{t("sampleMoment")}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Supervision */}
      <section aria-labelledby="sup-title" className="py-16">
        <Card className="grid gap-6 bg-surface-2 md:grid-cols-[1fr_auto] md:items-center md:p-10">
          <div className="space-y-3">
            <Chip tone="amber">{t("supervisionSoon")}</Chip>
            <h2 id="sup-title" className="text-3xl">{t("supervisionTitle")}</h2>
            <p className="max-w-2xl text-lg text-muted">{t("supervisionBody")}</p>
          </div>
          <WindowIllustration className="h-40 w-48 justify-self-center" />
        </Card>
      </section>

      {/* Privacy */}
      <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-20 py-16">
        <h2 id="privacy-title" className="text-3xl text-ink sm:text-4xl">{t("privacyTitle")}</h2>
        <p className="mt-3 max-w-2xl text-lg text-muted">{t("privacyIntro")}</p>
        <ul className="mt-10 grid gap-8 sm:grid-cols-3">
          {promises.map((p) => (
            <li key={p.title} className="space-y-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary-strong">
                <p.icon size={20} aria-hidden />
              </span>
              <h3 className="font-sans text-lg font-medium text-ink">{p.title}</h3>
              <p className="text-muted">{p.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-muted">{t("privacyAlso")}</p>
        <div className="mt-6 space-y-2 rounded-[16px] border border-dashed border-line p-5">
          <h3 className="flex items-center gap-2 font-sans text-base font-medium"><KeyRound size={17} aria-hidden /> {t("notTitle")}</h3>
          <ul className="list-disc space-y-1 pl-6 text-muted">
            <li>{t("not1")}</li>
            <li>{t("not2")}</li>
            <li>{t("not3")}</li>
          </ul>
        </div>
        <p className="mt-6">
          <Link href="/privacy" className="text-primary-strong underline underline-offset-4">{t("privacyMore")} →</Link>
        </p>
      </section>

      {/* Pricing */}
      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 py-16">
        <h2 id="pricing-title" className="text-3xl text-ink sm:text-4xl">{t("pricingTitle")}</h2>
        <p className="mt-3 text-lg text-muted">{t("pricingIntro")}</p>
        <Pricing />
        <p className="mt-5 text-muted">{t("planCollege")}: {t("planCollegeBody")}</p>
      </section>

      {/* Book a demo / waiting list */}
      <section id="join" aria-labelledby="join-title" className="scroll-mt-20 py-16">
        <Card className="grid gap-10 md:grid-cols-[1fr_1.4fr] md:p-10">
          <div className="space-y-4">
            <h2 id="join-title" className="text-3xl sm:text-4xl">{t("joinTitle")}</h2>
            <p className="text-lg text-muted">{t("joinBody")}</p>
            <ul className="space-y-2 text-muted">
              <li className="flex gap-2"><Check size={18} className="mt-1 shrink-0 text-primary-strong" aria-hidden /> {t("joinPoint1")}</li>
              <li className="flex gap-2"><Check size={18} className="mt-1 shrink-0 text-primary-strong" aria-hidden /> {t("joinPoint2")}</li>
              <li className="flex gap-2"><Check size={18} className="mt-1 shrink-0 text-primary-strong" aria-hidden /> {t("joinPoint3")}</li>
            </ul>
            <PlantIllustration className="hidden h-32 w-32 md:block" />
          </div>
          <SignupForm />
        </Card>
      </section>

      {/* Free consent template */}
      <section className="pb-8">
        <Card className="flex flex-col gap-4 bg-accent-soft/60 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="space-y-2">
            <h2 className="text-2xl">{t("consentTemplateTitle")}</h2>
            <p className="max-w-2xl text-muted">{t("consentTemplateBody")}</p>
          </div>
          <Link href="/resources/consent-template" className={buttonClass("secondary")}>{t("consentTemplateCta")}</Link>
        </Card>
      </section>
    </div>
  );
}
