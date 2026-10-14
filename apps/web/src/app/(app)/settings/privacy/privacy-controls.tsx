"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { VoiceCheck } from "@/components/app/voice-check";
import { deleteAccount, setRetention } from "../actions";

export function RetentionChoice({ value }: { value: "delete_after_transcription" | "keep_7_days" }) {
  const t = useTranslations("settings");
  const [pending, start] = useTransition();
  return (
    <fieldset className="space-y-2" disabled={pending}>
      {(["delete_after_transcription", "keep_7_days"] as const).map((v) => (
        <label key={v} className="flex items-start gap-3 rounded-[12px] border border-line px-4 py-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
          <input type="radio" name="retention" className="mt-1 accent-[var(--primary-strong)]" defaultChecked={value === v} onChange={() => start(() => setRetention(v))} />
          <span>{t(`retention_${v}`)}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function VoiceSettings({ enrolledAt }: { enrolledAt: string | null }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [setup, setSetup] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <p className="text-muted">{enrolledAt ? t("voiceEnrolled", { date: enrolledAt }) : t("voiceNone")}</p>
      {setup ? (
        <VoiceCheck onDone={() => setTimeout(() => router.refresh(), 4000)} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSetup(true)}>{enrolledAt ? t("voiceRedo") : t("voiceSetup")}</Button>
          {enrolledAt && (
            <Button variant="destructive" size="sm" disabled={pending} onClick={() => start(async () => { await fetch("/api/voice", { method: "DELETE" }); router.refresh(); })}>
              {t("voiceDelete")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function DeleteAccount() {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>{t("deleteCta")}</Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("deleteTitle")} description={t("deleteBody")}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); start(async () => { await deleteAccount(value); }); }}>
          <label className="block space-y-1.5">
            <span className="text-[15px] font-medium">{t("deleteConfirmLabel")}</span>
            <Input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
          </label>
          <Button type="submit" variant="destructive" disabled={pending || value.trim().toUpperCase() !== "DELETE"}>{t("deleteCta")}</Button>
        </form>
      </Dialog>
    </>
  );
}
