"use client";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { joinWithCode, type JoinError } from "../actions";

type Who = "none" | "fresh" | "therapist" | "client";

/** A client accepts their therapist's invite: what this is → their email → a 6-digit code → in. */
export function JoinFlow({ code, therapistName, who, email: signedInEmail }: { code: string; therapistName: string; who: Who; email: string | null }) {
  const t = useTranslations("join");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const [step, setStep] = useState<"welcome" | "email" | "code">("welcome");
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const joinError = (e: JoinError) => setError(t(`error_${e}`));
  const connect = () => start(async () => {
    setError(null);
    const res = await joinWithCode(code); // redirects to the client app on success
    if (res?.error) joinError(res.error);
  });

  function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    start(async () => {
      setError(null);
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
      if (error) { setError(error.status === 429 ? ta("tooMany") : tc("somethingWrong")); return; }
      setStep("code");
      setOtp("");
      setWait(30);
    });
  }
  function signIn(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setError(null);
      const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: otp.replace(/\D/g, "") });
      if (error) { setError(error.status === 429 ? ta("tooMany") : ta("wrongCode")); return; }
      const res = await joinWithCode(code);
      if (res?.error) joinError(res.error);
    });
  }

  if (who === "therapist") {
    return (
      <Card className="space-y-4">
        <h1 className="text-3xl">{t("therapistTitle")}</h1>
        <p className="text-muted">{t("therapistBody", { email: signedInEmail ?? "" })}</p>
        <Button variant="secondary" onClick={async () => { await authClient.signOut(); window.location.reload(); }}>{t("signOutFirst")}</Button>
      </Card>
    );
  }

  if (step === "welcome") {
    const sees = [t("sees1"), t("sees3")];
    const notSees = [t("notSees1"), t("notSees3")];
    return (
      <Card className="space-y-5 fade-up">
        <h1 className="text-3xl">{t("invitedBy", { name: therapistName })}</h1>
        <p className="text-muted">{t("whatItIs", { name: therapistName })}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t("seesTitle", { name: therapistName })}</p>
            <ul className="space-y-1.5 text-sm text-muted">{sees.map((s) => <li key={s} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden />{s}</li>)}</ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{t("notSeesTitle")}</p>
            <ul className="space-y-1.5 text-sm text-muted">{notSees.map((s) => <li key={s} className="flex gap-2"><X size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />{s}</li>)}</ul>
          </div>
        </div>
        <Notice tone="info">{t("notMonitored")}</Notice>
        <label className="flex items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary-strong)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{t.rich("agree", { privacy: (c) => <a href="/privacy" target="_blank" className="text-primary-strong underline underline-offset-4">{c}</a> })}</span>
        </label>
        {error && <Notice tone="attention">{error}</Notice>}
        <Button className="w-full" disabled={!agreed || pending} onClick={() => (who === "fresh" ? connect() : setStep("email"))}>
          {who === "fresh" ? t("connect") : t("continue")}
        </Button>
      </Card>
    );
  }

  if (step === "email") {
    return (
      <Card className="space-y-5 fade-up">
        <h1 className="text-3xl">{t("emailTitle")}</h1>
        <p className="text-muted">{t("emailBody", { name: therapistName })}</p>
        <form onSubmit={sendCode} className="space-y-4">
          <Field label={ta("email")} htmlFor="email" error={error ?? undefined}>
            <Input id="email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? ta("sending") : ta("send")}</Button>
        </form>
        <Button variant="ghost" onClick={() => setStep("welcome")}>{tc("back")}</Button>
      </Card>
    );
  }

  return (
    <Card className="space-y-5 fade-up">
      <h1 className="text-3xl">{ta("checkTitle")}</h1>
      <p className="text-muted">{ta("checkBody", { email: email.trim() })}</p>
      <form onSubmit={signIn} className="space-y-4">
        <Field label={ta("code")} hint={ta("codeHint")} htmlFor="otp" error={error ?? undefined}>
          <Input id="otp" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={7} value={otp}
            onChange={(e) => setOtp(e.target.value)} className="text-center font-serif text-2xl tracking-[0.4em]" />
        </Field>
        <Button type="submit" className="w-full" disabled={pending || otp.replace(/\D/g, "").length !== 6}>{pending ? ta("signingIn") : t("connect")}</Button>
      </form>
      <p className="text-sm text-muted">{ta("spamHint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => sendCode()} disabled={pending || wait > 0}>{wait > 0 ? ta("resendIn", { seconds: wait }) : ta("resend")}</Button>
        <Button variant="ghost" onClick={() => { setStep("email"); setError(null); }}>{ta("useDifferent")}</Button>
      </div>
    </Card>
  );
}
