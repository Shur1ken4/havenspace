"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteSession } from "../actions";

export function DeleteSession({ sessionId }: { sessionId: string }) {
  const t = useTranslations("review");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>{t("deleteSession")}</Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("deleteSession")}>
        <div className="flex gap-2">
          <Button variant="destructive" disabled={pending} onClick={() => start(() => deleteSession(sessionId))}>{tc("delete")}</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
        </div>
      </Dialog>
    </>
  );
}
