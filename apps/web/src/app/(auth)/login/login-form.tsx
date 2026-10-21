"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";

const RESEND_SECONDS = 30;

/** What the screen is doing: the usual email + password, or one of the code paths. */
type Mode = "password" | "codeEmail" | "code" | "resetEmail" | "reset" | "verify";

/**
 * Signing in (ADR-18): email and password, or a passkey (Face ID, Touch ID,
 * Windows Hello). A forgotten password is reset with an email code, and signing
 * in with just an email code stays available. New people create an account on
 * /signup; codes never create accounts.
 */
export function LoginForm({ next, fresh, devMailbox }: { next: string; fresh: boolean; devMailbox: boolean }) {
  const t = useTranslations("auth");
  const tr = useTranslations("register");
  const tc = useTranslations("common");
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const go = (m: Mode) => { setMode(m); setError(null); setInfo(null); setCode(""); };
  // A full page load, so every server component sees the new session.
  const done = () => window.location.assign(next);
  const tooMany = (status?: number) => (status === 429 ? t("tooMany") : null);

  async function sendCode(type: "sign-in" | "forget-password" | "email-verification", then: Mode) {
    setPending(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type });
    setPending(false);
    if (error) { setError(tooMany(error.status) ?? tc("somethingWrong")); return false; }
    if (mode === then) setInfo(t("resent"));
    else go(then);
    setWait(RESEND_SECONDS);
    return true;
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({ email: email.trim(), password });
    setPending(false);
    if (error) {
      if (error.status === 403 || /NOT_VERIFIED/i.test(error.code ?? "")) {
        // Created but never confirmed: confirm the email now, then they're in.
        await sendCode("email-verification", "verify");
        return;
      }
      setError(tooMany(error.status) ?? t("wrongPassword"));
      return;
    }
    // Accounts with an authenticator app use a code or passkey instead (one second step, not two).
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) { setError(t("passwordTwoFactor")); return; }
    done();
  }

  async function signInWithCode(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code.replace(/\D/g, "") });
    if (error) { setPending(false); setError(tooMany(error.status) ?? t("wrongCode")); return; }
    done();
  }

  async function confirmEmail(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await authClient.emailOtp.verifyEmail({ email: email.trim(), otp: code.replace(/\D/g, "") });
    if (error) { setPending(false); setError(tooMany(error.status) ?? t("wrongCode")); return; }
    done();
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 10) { setError(tr("short")); return; }
    if (password !== repeat) { setError(tr("mismatch")); return; }
    setPending(true);
    setError(null);
    const { error } = await authClient.emailOtp.resetPassword({ email: email.trim(), otp: code.replace(/\D/g, ""), password });
    if (error) { setPending(false); setError(tooMany(error.status) ?? t("wrongCode")); return; }
    const signedIn = await authClient.signIn.email({ email: email.trim(), password });
    if (signedIn.error) { setPending(false); go("password"); setInfo(t("resetDone")); return; }
    done();
  }

  async function passkey() {
    setError(null);
    const res = await authClient.signIn.passkey();
    if (res?.error) setError(t("passkeyFailed"));
    else router.push(next);
  }

  const emailField = (
    <Field label={t("email")} htmlFor="email">
      <Input id="email" type="email" autoComplete="username webauthn" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
    </Field>
  );
  const codeField = (
    <Field label={t("code")} hint={t("codeHint")} htmlFor="code">
      <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required pattern="[0-9 ]{6,7}" maxLength={7}
        value={code} onChange={(e) => setCode(e.target.value)} className="text-center font-serif text-2xl tracking-[0.4em]" />
    </Field>
  );
  const codeHelp = (resend: () => void) => (
    <>
      {info && <Notice tone="success">{info}</Notice>}
      <p className="text-sm text-muted">{t("spamHint")}</p>
      {devMailbox && (
        <Notice tone="info">
          {t("devMailboxHint")}{" "}
          <a className="text-primary-strong underline underline-offset-4" href="/dev/mailbox" target="_blank" rel="noreferrer">{t("devMailbox")}</a>
        </Notice>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={resend} disabled={pending || wait > 0}>{wait > 0 ? t("resendIn", { seconds: wait }) : t("resend")}</Button>
        <Button variant="ghost" onClick={() => go("password")}>{tc("back")}</Button>
      </div>
    </>
  );
  const errorBox = error && <Notice tone="attention">{error}</Notice>;
  const footer = (
    <div className="space-y-1 border-t border-line pt-4 text-sm text-muted">
      <p>{t("newHere")} <Link href="/signup" className="text-primary-strong underline underline-offset-4">{t("createLink")}</Link></p>
      <p>{t("clientHint")} <Link href="/join" className="text-primary-strong underline underline-offset-4">{t("clientLink")}</Link></p>
    </div>
  );

  // ── Code sent: type it ──────────────────────────────────────────────────
  if (mode === "code" || mode === "verify") {
    return (
      <Card className="space-y-5 fade-up">
        <h1 className="text-3xl">{t("checkTitle")}</h1>
        <p className="text-muted">{mode === "verify" ? t("verifyFirst", { email: email.trim() }) : t("checkBody", { email: email.trim() })}</p>
        <form onSubmit={mode === "verify" ? confirmEmail : signInWithCode} className="space-y-4">
          {codeField}
          {errorBox}
          <Button type="submit" className="w-full" disabled={pending || code.replace(/\D/g, "").length !== 6}>{pending ? t("signingIn") : t("signIn")}</Button>
        </form>
        {mode === "code" && <p className="text-sm text-muted">{t("noAccountHint")} <Link href="/signup" className="text-primary-strong underline underline-offset-4">{t("createLink")}</Link></p>}
        {codeHelp(() => void sendCode(mode === "verify" ? "email-verification" : "sign-in", mode))}
      </Card>
    );
  }

  // ── Reset: code + new password ──────────────────────────────────────────
  if (mode === "reset") {
    return (
      <Card className="space-y-5 fade-up">
        <h1 className="text-3xl">{t("resetTitle")}</h1>
        <p className="text-muted">{t("resetBody", { email: email.trim() })}</p>
        <form onSubmit={resetPassword} className="space-y-4">
          {codeField}
          <Field label={t("newPassword")} htmlFor="new-password" hint={tr("passwordHint")}>
            <Input id="new-password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={tr("repeat")} htmlFor="repeat">
            <Input id="repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </Field>
          {errorBox}
          <Button type="submit" className="w-full" disabled={pending || code.replace(/\D/g, "").length !== 6}>{t("resetSave")}</Button>
        </form>
        {codeHelp(() => void sendCode("forget-password", "reset"))}
      </Card>
    );
  }

  // ── Ask for the email (code sign-in or password reset) ──────────────────
  if (mode === "codeEmail" || mode === "resetEmail") {
    const reset = mode === "resetEmail";
    return (
      <Card className="space-y-5 fade-up">
        <h1 className="text-3xl">{reset ? t("forgotTitle") : t("codeTitle")}</h1>
        <p className="text-muted">{reset ? t("forgotBody") : t("intro")}</p>
        <form onSubmit={(e) => { e.preventDefault(); void sendCode(reset ? "forget-password" : "sign-in", reset ? "reset" : "code"); }} className="space-y-4">
          {emailField}
          {errorBox}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? t("sending") : t("send")}</Button>
        </form>
        <Button variant="ghost" onClick={() => go("password")}>{tc("back")}</Button>
      </Card>
    );
  }

  // ── Email + password (the usual way) ────────────────────────────────────
  return (
    <Card className="space-y-5">
      <h1 className="text-3xl">{t("title")}</h1>
      {fresh && <Notice tone="attention">{t("freshNeeded")}</Notice>}
      {info && <Notice tone="success">{info}</Notice>}
      <form onSubmit={signInWithPassword} className="space-y-4">
        {emailField}
        <Field label={t("password")} htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {errorBox}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? t("signingIn") : t("signIn")}</Button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <button type="button" className="inline-flex min-h-11 items-center text-left text-primary-strong underline underline-offset-4" onClick={() => go("resetEmail")}>{t("forgot")}</button>
          <button type="button" className="inline-flex min-h-11 items-center text-left text-primary-strong underline underline-offset-4" onClick={() => go("codeEmail")}>{t("useCodeInstead")}</button>
        </div>
      </form>
      <div className="flex items-center gap-3 text-sm text-muted"><span className="h-px flex-1 bg-line" />{t("orPasskey")}<span className="h-px flex-1 bg-line" /></div>
      <Button variant="secondary" className="w-full" onClick={passkey} title={t("passkeyHint")}><Fingerprint size={18} aria-hidden /> {t("passkey")}</Button>
      {footer}
      {devMailbox && (
        <a href="/dev/login" className="block text-center text-sm text-primary-strong underline underline-offset-4">{t("devQuick")}</a>
      )}
    </Card>
  );
}
