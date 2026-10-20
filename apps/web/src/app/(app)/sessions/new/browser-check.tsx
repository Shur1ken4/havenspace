"use client";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { canCaptureTabAudio } from "@/lib/client/browser";

export function BrowserCheck() {
  const t = useTranslations("session");
  const ok = useSyncExternalStore(() => () => {}, canCaptureTabAudio, () => true);
  if (ok) return null;
  return <p className="text-sm text-attention-strong">{t("browserCheckFail")}</p>;
}
