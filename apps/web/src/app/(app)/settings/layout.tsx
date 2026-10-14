import { getTranslations } from "next-intl/server";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const t = await getTranslations("settings");
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">{t("title")}</h1>
      <SettingsNav />
      <div>{children}</div>
    </div>
  );
}
