import { getTranslations } from "next-intl/server";
import { ConsentText } from "@/components/app/consent-text";
import { CONSENT_VERSION } from "@/lib/consent";
import { PrintButton } from "./print-button";

export async function generateMetadata() {
  return { title: (await getTranslations("consentTemplate"))("title") };
}

// CLINICAL-REVIEW: shares its wording with the in-app consent screen.
export default async function ConsentTemplate() {
  const t = await getTranslations("consentTemplate");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="no-print space-y-3">
        <h1 className="text-4xl">{t("title")}</h1>
        <p className="text-lg text-muted">{t("intro")}</p>
        <PrintButton label={t("print")} />
      </div>
      <ConsentText />
      <section className="space-y-6 rounded-[14px] border border-line p-6">
        <p>{t("agree")}</p>
        <div className="grid gap-8 sm:grid-cols-2">
          {[t("clientSignature"), t("therapistSignature")].map((label) => (
            <div key={label} className="space-y-8">
              <p className="text-sm text-muted">{label}</p>
              <div className="border-b border-ink/40" />
              <p className="text-sm text-muted">{t("date")}</p>
              <div className="border-b border-ink/40" />
            </div>
          ))}
        </div>
      </section>
      <p className="text-sm text-muted">{t("version", { version: CONSENT_VERSION })} · {t("licence")}</p>
    </div>
  );
}
