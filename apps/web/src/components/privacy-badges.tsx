import { getTranslations } from "next-intl/server";
import { GlobeLock, ShieldCheck, EyeOff } from "lucide-react";
import { Chip } from "@/components/ui/chip";

export async function PrivacyBadges({ className }: { className?: string }) {
  const t = await getTranslations("badges");
  return (
    <ul className={`flex flex-wrap gap-2 ${className ?? ""}`} aria-label="Privacy">
      <li><Chip><ShieldCheck size={15} aria-hidden /> {t("audioDeleted")}</Chip></li>
      <li><Chip><GlobeLock size={15} aria-hidden /> {t("euStored")}</Chip></li>
      <li><Chip><EyeOff size={15} aria-hidden /> {t("noTraining")}</Chip></li>
    </ul>
  );
}
