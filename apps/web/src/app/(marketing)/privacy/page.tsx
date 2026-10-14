import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Cloud, Mic, PenLine, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { PrivacyBadges } from "@/components/privacy-badges";

export async function generateMetadata() {
  return { title: (await getTranslations("privacyPage"))("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacyPage");
  const flow = [
    { icon: Mic, text: t("flow1") },
    { icon: Cloud, text: t("flow2") },
    { icon: Sparkles, text: t("flow3") },
    { icon: PenLine, text: t("flow4") },
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-4">
        <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
        <p className="text-lg text-muted">{t("intro")}</p>
        <PrivacyBadges />
      </header>
      <section className="space-y-4">
        <h2 className="text-2xl">{t("flowTitle")}</h2>
        <ol className="space-y-3">
          {flow.map((f, i) => (
            <li key={i}>
              <Card className="flex gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><f.icon size={20} aria-hidden /></span>
                <p className="pt-1.5">{f.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">{t("notTitle")}</h2>
        <ul className="list-disc space-y-1.5 pl-6">
          {(["never1", "never2", "never3", "never4"] as const).map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">{t("whoTitle")}</h2>
        <p>{t("whoBody")} <Link className="text-primary-strong underline underline-offset-4" href="/legal/subprocessors">{t("whoLink")}</Link></p>
      </section>
      <section className="space-y-3">
        <h2 className="text-2xl">{t("rightsTitle")}</h2>
        <p>{t("rightsBody")}</p>
      </section>
      <Notice tone="info">{t("status")}</Notice>
      <p className="text-sm text-muted">{t("contact")}</p>
    </div>
  );
}
