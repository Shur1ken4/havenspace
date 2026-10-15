"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { archiveClient, deleteClient } from "../actions";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";

export function ClientDanger({ clientId, pseudonym, archived }: { clientId: string; pseudonym: string; archived: boolean }) {
  const t = useTranslations("clients");
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-wrap gap-3 border-t border-line pt-6">
      <a href={`/api/export?client=${clientId}`} className={buttonClass("secondary", "sm")}><Download size={16} aria-hidden /> {t("exportClient")}</a>
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(() => archiveClient(clientId, !archived))}>
        {archived ? t("unarchive") : t("archive")}
      </Button>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>{t("deleteClient")}</Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("deleteClient")} description={t("deleteClientBody", { pseudonym })}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { await deleteClient(clientId, confirm); }); }}>
          <label className="block space-y-1.5">
            <span className="text-[15px] font-medium">{t("deleteConfirmLabel")}</span>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </label>
          <Button type="submit" variant="destructive" disabled={pending || confirm.trim() !== pseudonym}>{t("deleteClient")}</Button>
        </form>
      </Dialog>
    </section>
  );
}
