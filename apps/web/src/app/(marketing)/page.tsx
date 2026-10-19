import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRight, Check, Download, EyeOff, Lightbulb, Minimize2, SmilePlus, UserCheck, GlobeLock, HandHeart, KeyRound, Mic, NotebookPen, ShieldCheck, Sprout, Users,
} from "lucide-react";
import { PlantIllustration, WindowIllustration } from "@/components/illustrations";
import { ArchStage } from "@/components/marketing/arch-stage";
import { SignupForm } from "@/components/marketing/signup-form";
import { Pricing } from "@/components/marketing/pricing";
import { PrivacyBadges } from "@/components/privacy-badges";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const a = await getTranslations("arch");

  const steps = [
    { icon: Mic, title: t("step1Title"), body: t("step1Body") },
    { icon: NotebookPen, title: t("step2Title"), body: t("step2Body") },
    { icon: Sprout, title: t("step3Title"), body: t("step3Body") },
  ];
  const promises = [
    { icon: ShieldCheck, title: t("promise1Title"), body: t("promise1Body") },
    { icon: GlobeLock, title: t("promise2Title"), body: t("promise2Body") },
    { icon: EyeOff, title: t("promise3Title"), body: t("promise3Body") },
    { icon: Users, title: t("promise4Title"), body: t("promise4Body") },
    { icon: HandHeart, title: t("promise5Title"), body: t("promise5Body") },
    { icon: Download, title: t("promise6Title"), body: t("promise6Body") },
  ];
  // CLINICAL-REVIEW: how Arch is described to therapists.
  const archPoints = [
    { icon: Lightbulb, title: a("lightTitle"), body: a("lightBody") },
    { icon: SmilePlus, title: a("neverTitle"), body: a("neverBody") },
    { icon: Minimize2, title: a("stillTitle"), body: a("stillBody") },
    { icon: UserCheck, title: a("decideTitle"), body: a("decideBody") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 py-10 md:grid-cols-[1fr_1fr] md:py-16">
        <div className="fade-up space-y-6">
          <p className="text-sm uppercase tracking-[0.12em] text-muted">{t("eyebrow")}</p>
          <h1 className="text-4xl text-ink sm:text-5xl md:text-[3.4rem]">{t("heroTitle")}</h1>
          <p className="max-w-xl text-lg text-muted">{t("heroBody")}</p>
          <div className="flex flex-wrap gap-3">
            <a href="#join" className={buttonClass("primary", "lg")}>{t("heroCta")} <ArrowRight size={18} aria-hidden /></a>
            <a href="#how" className={buttonClass("secondary", "lg")}>{t("heroSecondary")}</a>
          </div>
          <PrivacyBadges className="pt-2" />
        </div>
        <ArchStage />
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
      <section id="arch" aria-labelledby="arch-title" className="scroll-mt-20 py-16">
        <p className="text-sm uppercase tracking-[0.12em] text-muted">{a("meetEyebrow")}</p>
        <h2 id="arch-title" className="mt-2 text-3xl text-ink sm:text-4xl">{a("meetTitle")}</h2>
        <p className="mt-3 max-w-2xl text-lg text-muted">{a("meetIntro")}</p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {archPoints.map((p) => (
            <li key={p.title}>
              <Card className="h-full space-y-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-ink">
                  <p.icon size={20} aria-hidden />
                </span>
                <h3 className="font-sans text-lg font-medium text-ink">{p.title}</h3>
                <p className="text-muted">{p.body}</p>
              </Card>
            </li>
          ))}
        </ul>
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
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
        <Card className="mt-10 space-y-3 border-dashed bg-transparent shadow-none">
          <h3 className="flex items-center gap-2 font-sans text-lg font-medium"><KeyRound size={18} aria-hidden /> {t("notTitle")}</h3>
          <ul className="list-disc space-y-1 pl-6 text-muted">
            <li>{t("not1")}</li>
            <li>{t("not2")}</li>
            <li>{t("not3")}</li>
          </ul>
        </Card>
        <p className="mt-6">
          <Link href="/privacy" className="text-primary-strong underline underline-offset-4">{t("privacyTitle")} →</Link>
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
