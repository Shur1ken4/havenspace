"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { withdrawConsent } from "../../actions";

export function WithdrawConsent({ clientId }: { clientId: string }) {
  const t = useTranslations("consent");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const go = (deletePast: boolean) => start(async () => { await withdrawConsent(clientId, deletePast); setOpen(false); });
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>{t("withdraw")}</Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("withdrawTitle")} description={t("withdrawBody")}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" disabled={pending} onClick={() => go(false)}>{t("withdrawKeep")}</Button>
          <Button variant="destructive" disabled={pending} onClick={() => go(true)}>{t("withdrawDelete")}</Button>
        </div>
      </Dialog>
    </>
  );
}
