import { getTranslations } from "next-intl/server";
import { requireTherapist } from "@/lib/session";
import { ProfileForm } from "./profile-form";
import { Card } from "@/components/ui/card";
import { ThemeSwitch } from "@/components/theme-switch";
import { currentTheme } from "@/lib/theme";

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("title") };
}

export default async function ProfileSettings() {
  const { therapist } = await requireTherapist();
  const t = await getTranslations("theme");
  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl">{t("title")}</h2>
          <p className="text-sm text-muted">{t("body")}</p>
        </div>
        <ThemeSwitch initial={await currentTheme()} />
      </Card>
      <ProfileForm therapist={therapist} />
    </div>
  );
}
