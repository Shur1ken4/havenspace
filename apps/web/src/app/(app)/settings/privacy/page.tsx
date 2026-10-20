import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Download, FileText } from "lucide-react";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RetentionChoice, VoiceSettings, DeleteAccount } from "./privacy-controls";

export async function generateMetadata() {
  return { title: (await (await import("next-intl/server")).getTranslations("settings"))("privacy") };
}

export default async function PrivacySettings() {
  const { therapist } = await requireTherapist();
  const t = await getTranslations("settings");
  const ta = await getTranslations("audit");
  const format = await getFormatter();
  const log = await withUser(therapist.id, async (db) =>
    (await db.query("select action, entity_type, at from audit_log order by at desc limit 15")).rows,
  );
  return (
    <div className="grid max-w-3xl gap-6">
      <Card className="space-y-4">
        <h2 className="text-2xl">{t("retentionTitle")}</h2>
        <RetentionChoice value={therapist.audio_retention} />
      </Card>
      <Card className="space-y-3">
        <h2 className="text-2xl">{t("voiceTitle")}</h2>
        <VoiceSettings enrolledAt={therapist.voice_enrolled_at ? format.dateTime(new Date(therapist.voice_enrolled_at), { dateStyle: "medium" }) : null} />
      </Card>
      <Card className="space-y-3">
        <h2 className="text-2xl">{t("exportTitle")}</h2>
        <p className="text-muted">{t("exportBody")}</p>
        <a href="/api/export" className={buttonClass("secondary")}><Download size={16} aria-hidden /> {t("exportCta")}</a>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-2xl">{t("documentsTitle")}</h2>
        <ul className="space-y-2">
          <li><Link href="/legal/dpa" className="inline-flex items-center gap-2 text-primary-strong underline underline-offset-4"><FileText size={16} aria-hidden /> {t("dpa")}</Link></li>
          <li><Link href="/legal/subprocessors" className="inline-flex items-center gap-2 text-primary-strong underline underline-offset-4"><FileText size={16} aria-hidden /> {t("subprocessors")}</Link></li>
          <li><Link href="/privacy" className="inline-flex items-center gap-2 text-primary-strong underline underline-offset-4"><FileText size={16} aria-hidden /> {t("privacyPageLink")}</Link></li>
        </ul>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-2xl">{t("auditTitle")}</h2>
        {log.length === 0 ? <p className="text-muted">{t("auditEmpty")}</p> : (
          <ul className="divide-y divide-line text-ui">
            {log.map((l, i) => (
              <li key={i} className="flex justify-between gap-4 py-2">
                <span>{ta.has(l.action.replace(".", "__")) ? ta(l.action.replace(".", "__")) : l.action}</span>
                <span className="shrink-0 text-muted">{format.dateTime(l.at, { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="space-y-3 border-destructive/30">
        <h2 className="text-2xl">{t("deleteTitle")}</h2>
        <p className="text-muted">{t("deleteBody")}</p>
        <DeleteAccount />
      </Card>
    </div>
  );
}
