"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { verifyCode, type VerifyState } from "./actions";

export function VerifyForm({ next, justEnabled }: { next: string; justEnabled: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [state, action, pending] = useActionState<VerifyState, FormData>(verifyCode, {});
  return (
    <Card className="space-y-5">
      <h1 className="text-3xl">{t("twoFactorTitle")}</h1>
      {justEnabled && <Notice tone="success">{t("twoFactorJustEnabled")}</Notice>}
      <p className="text-muted">{t("twoFactorBody")}</p>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field label={t("twoFactorCode")} hint={t("twoFactorBackupHint")} htmlFor="code"
          error={state.error === "invalid" ? t("invalidCode") : state.error === "locked" ? t("tooManyAttempts") : undefined}>
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={20} />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>{t("verify")}</Button>
      </form>
      <Button variant="ghost" className="w-full" onClick={async () => { await authClient.signOut(); router.push("/login"); }}>{t("useDifferent")}</Button>
    </Card>
  );
}
