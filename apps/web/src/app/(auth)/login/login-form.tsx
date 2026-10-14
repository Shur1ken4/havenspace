"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

export function LoginForm({ next, fresh, devMailbox }: { next: string; fresh: boolean; devMailbox: boolean }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"email" | "sent" | "twoFactor">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.magicLink({ email: email.trim(), callbackURL: next });
    setPending(false);
    if (error) setError(tc("somethingWrong"));
    else setStage("sent");
  }

  async function passkey() {
    setError(null);
    const res = await authClient.signIn.passkey();
    if (res?.error) setError(t("passkeyFailed"));
    else router.push(next);
  }

  async function verifyTotp(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    if (error) setError(t("invalidCode"));
    else router.push(next);
  }

  if (stage === "sent") {
    return (
      <Card className="space-y-4 fade-up">
        <h1 className="text-3xl">{t("checkTitle")}</h1>
        <p className="text-muted">{t("checkBody", { email })}</p>
        {devMailbox && (
          <Notice tone="info">
            {t("devMailboxHint")}{" "}
            <a className="text-primary-strong underline underline-offset-4" href="/dev/mailbox">{t("devMailbox")}</a>
          </Notice>
        )}
        <Button variant="ghost" onClick={() => setStage("email")}>{t("useDifferent")}</Button>
      </Card>
    );
  }

  if (stage === "twoFactor") {
    return (
      <Card className="space-y-4">
        <h1 className="text-3xl">{t("twoFactorTitle")}</h1>
        <p className="text-muted">{t("twoFactorBody")}</p>
        <form onSubmit={verifyTotp} className="space-y-4">
          <Field label={t("twoFactorCode")} htmlFor="totp" error={error}>
            <Input id="totp" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">{t("verify")}</Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <h1 className="text-3xl">{t("title")}</h1>
      {fresh && <Notice tone="attention">{t("freshNeeded")}</Notice>}
      <p className="text-muted">{t("intro")}</p>
      <form onSubmit={sendLink} className="space-y-4">
        <Field label={t("email")} htmlFor="email" error={error ?? undefined}>
          <Input id="email" type="email" autoComplete="email webauthn" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>{pending ? t("sending") : t("send")}</Button>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />{t("orPasskey")}<span className="h-px flex-1 bg-line" /></div>
      <Button variant="secondary" className="w-full" onClick={passkey}><KeyRound size={18} aria-hidden /> {t("passkey")}</Button>
      <p className="text-sm text-muted">{t("passkeyHint")}</p>
      <p className="text-sm text-muted">{t("newHere")}</p>
    </Card>
  );
}
