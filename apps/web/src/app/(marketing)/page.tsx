import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check, EyeOff, GlobeLock, Link2, ShieldCheck } from "lucide-react";
import { PlantIllustration } from "@/components/illustrations";
import { ArchAgentVisual, FeatureGrid, PrivacyVisual, StepsVisual } from "@/components/marketing/visuals";
import { Devices } from "@/components/marketing/devices";
import { APPS_PUBLISHED, appDownloads } from "@/lib/apps";
import { HeroDemo } from "@/components/marketing/hero-demo";
import { SignupForm } from "@/components/marketing/signup-form";
import { Pricing } from "@/components/marketing/pricing";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const b = await getTranslations("badges");

  const worksWith = ["works1", "works2", "works3", "works4", "works5", "works6"] as const;
  const tdev = await getTranslations("devices");

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

      {/* How it works: three pictures */}
      <section id="how" aria-labelledby="how-title" className="scroll-mt-20 py-16">
        <h2 id="how-title" className="mb-8 text-3xl text-ink sm:text-4xl">{t("howTitle")}</h2>
        <StepsVisual />
      </section>

      {/* Arch, the AI practice agent */}
      <section id="arch" aria-labelledby="arch-title" className="scroll-mt-20 py-16">
        <ArchAgentVisual />
      </section>

      {/* Reflection */}
      <section id="reflection" aria-labelledby="reflect-title" className="scroll-mt-20 grid gap-10 py-16 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <h2 id="reflect-title" className="text-3xl text-ink sm:text-4xl">{t("reflectTitle")}</h2>
          <p className="text-lg text-muted">{t("reflectShort")}</p>
          <PlantIllustration className="hidden h-36 w-36 md:block" />
        </div>
        <div className="space-y-3" aria-label={t("reflectSampleLabel")}>
          {[
            { label: t("sampleStrengthLabel"), text: t("sampleStrength"), tone: "sage" as const },
            { label: t("sampleTryLabel"), text: t("sampleTry"), tone: "clay" as const },
          ].map((item) => (
            <Card key={item.label} className="space-y-2 p-5">
              <Chip tone={item.tone}>{item.label}</Chip>
              <p className="text-ink">{item.text}</p>
              <p className="flex items-center gap-1 text-sm text-muted"><Link2 size={13} aria-hidden /> {t("sampleMoment")}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Everything in one place */}
      <section aria-labelledby="features-title" className="py-16">
        <h2 id="features-title" className="mb-8 text-3xl text-ink sm:text-4xl">{t("featuresTitle")}</h2>
        <FeatureGrid />
      </section>

      {/* Privacy */}
      <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-20 py-16">
        <h2 id="privacy-title" className="mb-8 text-3xl text-ink sm:text-4xl">{t("privacyTitle")}</h2>
        <PrivacyVisual />
        <p className="mt-6 text-muted">{t("privacyLine")}</p>
        <p className="mt-3">
          <Link href="/privacy" className="text-primary-strong underline underline-offset-4">{t("privacyMore")} →</Link>
        </p>
      </section>

      {/* On every device */}
      <section id="devices" aria-labelledby="devices-title" className="scroll-mt-20 py-16">
        <h2 id="devices-title" className="text-3xl text-ink sm:text-4xl">{tdev("title")}</h2>
        <p className="mb-8 mt-3 text-lg text-muted">{APPS_PUBLISHED ? tdev("bodyDownloads") : tdev("body")}</p>
        <Devices downloads={appDownloads} />
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
