import { getTranslations } from "next-intl/server";

// CLINICAL-REVIEW: consent wording (messages/*.json → consent.text*).
export async function ConsentText() {
  const t = await getTranslations("consent");
  return (
    <article className="space-y-3 rounded-card border border-line bg-surface-2 p-6 text-[17px] leading-relaxed text-ink">
      <h2 className="text-2xl">{t("textHeading")}</h2>
      {(["textP1", "textP2", "textP3", "textP4", "textP5", "textP6"] as const).map((k) => <p key={k}>{t(k)}</p>)}
    </article>
  );
}
