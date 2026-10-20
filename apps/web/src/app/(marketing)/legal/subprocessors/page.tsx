import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

export async function generateMetadata() {
  return { title: (await getTranslations("subprocessors"))("title") };
}

// Keep in sync with docs/subprocessors.md.
const rows = [
  { name: "Vercel Inc.", purpose: "web", location: "fra1", data: "web" },
  { name: "EU managed Postgres (provider to be confirmed — see ADR-2/ADR-5)", purpose: "db", location: "eu", data: "all" },
  { name: "EU S3-compatible object storage (provider to be confirmed)", purpose: "storage", location: "eu", data: "audio" },
  { name: "Hetzner Online GmbH", purpose: "asr", location: "de", data: "audioText" },
  { name: "Amazon Web Services EMEA SARL (Amazon Bedrock — Claude by Anthropic)", purpose: "ai", location: "fra", data: "text" },
  { name: "Brevo (Sendinblue SAS)", purpose: "email", location: "fr", data: "email" },
] as const;

export default async function Subprocessors() {
  const t = await getTranslations("subprocessors");
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="text-4xl">{t("title")}</h1>
      <p className="text-lg text-muted">{t("intro")}</p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-ui">
          <thead className="border-b border-line bg-surface-2 text-sm text-muted">
            <tr><th className="p-4 font-medium">{t("name")}</th><th className="p-4 font-medium">{t("purpose")}</th><th className="p-4 font-medium">{t("location")}</th><th className="p-4 font-medium">{t("data")}</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.name} className="align-top">
                <td className="p-4">{r.name}</td>
                <td className="p-4">{t(`purpose_${r.purpose}`)}</td>
                <td className="p-4">{t(`location_${r.location}`)}</td>
                <td className="p-4">{t(`data_${r.data}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Notice tone="info">{t("devNote")}</Notice>
    </div>
  );
}
