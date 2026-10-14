"use client";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { retrySession } from "../actions";

export function Failed({ sessionId, canRetry }: { sessionId: string; canRetry: boolean }) {
  const t = useTranslations("review");
  const [pending, start] = useTransition();
  return (
    <Notice tone="attention" title={t("failedTitle")}>
      <p>{t("failedBody")}</p>
      {canRetry && <Button className="mt-3" size="sm" disabled={pending} onClick={() => start(() => retrySession(sessionId))}>{t("retry")}</Button>}
    </Notice>
  );
}
