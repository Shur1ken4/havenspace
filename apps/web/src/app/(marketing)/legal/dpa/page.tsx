import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

export async function generateMetadata() {
  return { title: (await getTranslations("dpa"))("title") };
}

export default async function Dpa() {
  const t = await getTranslations("dpa");
  const points = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"] as const;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-4xl">{t("title")}</h1>
      <Notice tone="attention">{t("draft")}</Notice>
      <p className="text-lg text-muted">{t("intro")}</p>
      <Card>
        <ol className="list-decimal space-y-3 pl-6">{points.map((p) => <li key={p}>{t(p)}</li>)}</ol>
      </Card>
    </div>
  );
}
