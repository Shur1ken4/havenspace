"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

const RESEND_SECONDS = 30;

export function LoginForm({ next, fresh, devMailbox }: { next: string; fresh: boolean; devMailbox: boolean }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
    setPending(false);
    if (error) { setError(error.status === 429 ? t("tooMany") : tc("somethingWrong")); return; }
    if (stage === "code") setInfo(t("resent"));
    setStage("code");
    setCode("");
    setWait(RESEND_SECONDS);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.replace(/\D/g, "") });
    if (error) {
      setPending(false);
      setError(error.status === 429 ? t("tooMany") : t("wrongCode"));
      return;
    }
    // A full page load, so every server component sees the new session.
    window.location.assign(next);
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({ email: email.trim(), password });
    setPending(false);
    if (error) { setError(error.status === 429 ? t("tooMany") : t("wrongPassword")); return; }
    // Accounts with an authenticator app use a code or passkey instead (one second step, not two).
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) { setUsePassword(false); setError(t("passwordTwoFactor")); return; }
    window.location.assign(next);
  }

  async function passkey() {
    setError(null);
    const res = await authClient.signIn.passkey();
    if (res?.error) setError(t("passkeyFailed"));
    else router.push(next);
  }

  if (stage === "code") {
    return (
      <Card className="space-y-5 fade-up">
        <h1 className="text-3xl">{t("checkTitle")}</h1>
        <p className="text-muted">{t("checkBody", { email: email.trim() })}</p>
        <form onSubmit={signIn} className="space-y-4">
          <Field label={t("code")} hint={t("codeHint")} htmlFor="code" error={error ?? undefined}>
            <Input
              id="code" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required
              pattern="[0-9 ]{6,7}" maxLength={7} value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center font-serif text-2xl tracking-[0.4em]"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={pending || code.replace(/\D/g, "").length !== 6}>
            {pending ? t("signingIn") : t("signIn")}
          </Button>
        </form>
        {info && <Notice tone="success">{info}</Notice>}
        <p className="text-sm text-muted">{t("spamHint")}</p>
        {devMailbox && (
          <Notice tone="info">
            {t("devMailboxHint")}{" "}
            <a className="text-primary-strong underline underline-offset-4" href="/dev/mailbox" target="_blank" rel="noreferrer">{t("devMailbox")}</a>
          </Notice>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => sendCode()} disabled={pending || wait > 0}>
            {wait > 0 ? t("resendIn", { seconds: wait }) : t("resend")}
          </Button>
          <Button variant="ghost" onClick={() => { setStage("email"); setError(null); setInfo(null); }}>{t("useDifferent")}</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-5">
      <h1 className="text-3xl">{t("title")}</h1>
      {fresh && <Notice tone="attention">{t("freshNeeded")}</Notice>}
      <p className="text-muted">{t("intro")}</p>
      <form onSubmit={usePassword ? signInWithPassword : sendCode} className="space-y-4">
        <Field label={t("email")} htmlFor="email" error={!usePassword ? error ?? undefined : undefined}>
          <Input id="email" type="email" autoComplete={usePassword ? "username" : "email webauthn"} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {usePassword && (
          <Field label={t("password")} htmlFor="password" error={error ?? undefined}>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {usePassword ? (pending ? t("signingIn") : t("signIn")) : (pending ? t("sending") : t("send"))}
        </Button>
        <button type="button" className="w-full text-center text-sm text-primary-strong underline underline-offset-4"
          onClick={() => { setUsePassword((u) => !u); setError(null); }}>
          {usePassword ? t("useCodeInstead") : t("usePassword")}
        </button>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />{t("orPasskey")}<span className="h-px flex-1 bg-line" /></div>
      <Button variant="secondary" className="w-full" onClick={passkey} title={t("passkeyHint")}><KeyRound size={18} aria-hidden /> {t("passkey")}</Button>
      <p className="border-t border-line pt-4 text-sm text-muted">
        {t("newHere")}{" "}
        {t("clientHint")} <Link href="/join" className="text-primary-strong underline underline-offset-4">{t("clientLink")}</Link>
      </p>
      {devMailbox && (
        <a href="/dev/login" className="block text-center text-sm text-primary-strong underline underline-offset-4">{t("devQuick")}</a>
      )}
    </Card>
  );
}
