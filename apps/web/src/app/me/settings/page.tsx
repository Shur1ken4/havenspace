import { getTranslations } from "next-intl/server";
import { requireClient } from "@/lib/session";
import { hasPassword } from "@/lib/account-actions";
import { AccountSettings } from "@/components/account/account-settings";
import { Card } from "@/components/ui/card";
import { LeaveApp } from "../parts";

export async function generateMetadata() {
  return { title: (await getTranslations("account"))("account") };
}

// The client's own settings: profile, password, their data, and leaving the app.
export default async function ClientSettings() {
  const { session } = await requireClient();
  const t = await getTranslations("me");
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">{t("settingsTitle")}</h1>
      <AccountSettings name={session.user.name ?? ""} email={session.user.email} image={session.user.image ?? null} hasPassword={await hasPassword()} />
      {/* CLINICAL-REVIEW: where to find urgent help (moved here from the footer of every page). */}
      <Card className="space-y-2">
        <h2 className="text-2xl">{t("urgentTitle")}</h2>
        <p className="text-muted">{t("crisis")}</p>
      </Card>
      <Card className="space-y-3">
        <h2 className="text-2xl">{t("dataTitle")}</h2>
        <p className="text-muted">{t("dataBody")}</p>
        <a href="/api/export" className="inline-block text-primary-strong underline underline-offset-4">{t("downloadData")}</a>
      </Card>
      <LeaveApp />
    </div>
  );
}
