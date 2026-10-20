"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, Check, HeartHandshake, Stethoscope, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toAvatar } from "@/lib/client/avatar";
import { updateAccount } from "@/lib/account-actions";
import { Avatar } from "@/components/account/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/components/ui/cn";
import { checkInvite, joinWithCode, type JoinError } from "../join/actions";

type Role = "therapist" | "client";
type Step = "role" | "invite" | "welcome" | "details" | "verify" | "photo";
type Invite = { code: string; therapistName: string };

const RESEND_SECONDS = 30;

/**
 * Creating an account (ADR-18): who you are → (clients: your therapist's invite)
 * → name, email and password → the 6-digit code that confirms the email →
 * an optional photo. Therapists then fill in their professional details
 * (onboarding); clients are connected to their therapist.
 */
export function SignupWizard({ invite: given, devMailbox }: { invite?: Invite; devMailbox: boolean }) {
  const t = useTranslations("register");
  const ta = useTranslations("auth");
  const tj = useTranslations("join");
  const tc = useTranslations("common");
  const tacc = useTranslations("account");
  const router = useRouter();

  const [role, setRole] = useState<Role | null>(given ? "client" : null);
  const [invite, setInvite] = useState<Invite | null>(given ?? null);
  const [step, setStep] = useState<Step>(given ? "welcome" : "role");
  const [agreed, setAgreed] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [otp, setOtp] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const name = `${first.trim()} ${last.trim()}`.trim();
  const steps: Step[] = role === "client" ? [...(given ? [] : (["role", "invite"] as Step[])), "welcome", "details", "verify", "photo"] : ["role", "details", "verify", "photo"];
  const index = Math.max(0, steps.indexOf(step));
  const go = (s: Step) => { setError(null); setInfo(null); setStep(s); };

  function chooseRole(r: Role) {
    setRole(r);
    go(r === "therapist" ? "details" : invite ? "welcome" : "invite");
  }

  function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setError(null);
      const res = await checkInvite(codeInput);
      if ("error" in res) { setError(res.error === "too_many" ? tj("tooMany") : t("inviteInvalid")); return; }
      setInvite(res);
      go("welcome");
    });
  }

  function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setExists(false);
    if (password.length < 10) { setError(t("short")); return; }
    if (password !== repeat) { setError(t("mismatch")); return; }
    start(async () => {
      setError(null);
      const { error } = await authClient.signUp.email({ email: email.trim(), password, name });
      if (error) {
        if (error.status === 429) setError(ta("tooMany"));
        else if (/exist/i.test(`${error.code ?? ""} ${error.message ?? ""}`)) { setExists(true); setError(t("exists")); }
        else if (/password/i.test(`${error.code ?? ""}`)) setError(t("short"));
        else setError(tc("somethingWrong"));
        return;
      }
      setOtp("");
      setWait(RESEND_SECONDS);
      go("verify");
    });
  }

  function resend() {
    start(async () => {
      setError(null);
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "email-verification" });
      if (error) { setError(error.status === 429 ? ta("tooMany") : tc("somethingWrong")); return; }
      setInfo(ta("resent"));
      setWait(RESEND_SECONDS);
    });
  }

  function confirmEmail(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      setError(null);
      const { error } = await authClient.emailOtp.verifyEmail({ email: email.trim(), otp: otp.replace(/\D/g, "") });
      if (error) { setError(error.status === 429 ? ta("tooMany") : ta("wrongCode")); return; }
      go("photo"); // signed in now
    });
  }

  async function pick(f: File | undefined) {
    if (!f) return;
    try { setImage(await toAvatar(f)); setError(null); } catch { setError(tacc("photoUnreadable")); }
    if (file.current) file.current.value = "";
  }

  function finish(withPhoto: boolean) {
    start(async () => {
      setError(null);
      if (withPhoto && image) {
        const res = await updateAccount({ name, image });
        if (!res.ok) { setError(tc("somethingWrong")); return; }
      }
      if (role === "client" && invite) {
        const res = await joinWithCode(invite.code); // redirects to the client app on success
        if (res?.error) setError(tj(`error_${res.error as JoinError}`));
        return;
      }
      router.push("/onboarding");
      router.refresh();
    });
  }

  const progress = (
    <div className="space-y-2">
      <p className="text-sm text-muted">{t("stepOf", { n: index + 1, total: steps.length })}</p>
      <div className="flex gap-1.5" aria-hidden>
        {steps.map((s, i) => <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= index ? "bg-primary" : "bg-surface-2")} />)}
      </div>
    </div>
  );
  const signInLine = (
    <p className="border-t border-line pt-4 text-sm text-muted">
      {ta("haveAccount")}{" "}
      <Link href={invite ? `/login?next=${encodeURIComponent(`/join/${invite.code}`)}` : "/login"} className="text-primary-strong underline underline-offset-4">{ta("signInLink")}</Link>
    </p>
  );

  // ── Who are you? ────────────────────────────────────────────────────────
  if (step === "role") {
    const options: { r: Role; icon: typeof Stethoscope }[] = [{ r: "therapist", icon: Stethoscope }, { r: "client", icon: HeartHandshake }];
    return (
      <Card className="space-y-5 fade-up">
        {progress}
        <h1 className="text-3xl">{t("roleTitle")}</h1>
        <div className="grid gap-3">
          {options.map(({ r, icon: Icon }) => (
            <button key={r} type="button" onClick={() => chooseRole(r)}
              className="flex items-start gap-4 rounded-card border border-line bg-surface p-4 text-left hover:border-primary hover:bg-primary-soft/40">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><Icon size={20} aria-hidden /></span>
              <span className="space-y-1">
                <span className="block text-lg font-medium text-ink">{t(`role_${r}`)}</span>
                <span className="block text-sm text-muted">{t(`role_${r}_body`)}</span>
              </span>
            </button>
          ))}
        </div>
        {signInLine}
      </Card>
    );
  }

  // ── Client: the code from their therapist ───────────────────────────────
  if (step === "invite") {
    return (
      <Card className="space-y-5 fade-up">
        {progress}
        <h1 className="text-3xl">{t("inviteTitle")}</h1>
        <p className="text-muted">{t("inviteBody")}</p>
        <form onSubmit={submitInvite} className="space-y-4">
          <Field label={t("inviteLabel")} htmlFor="invite" error={error ?? undefined}>
            <Input id="invite" autoComplete="off" autoCapitalize="characters" autoFocus required maxLength={12} value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)} className="text-center font-serif text-2xl tracking-[0.2em]" placeholder="K7P4-QM2X" />
          </Field>
          <Button type="submit" className="w-full" disabled={pending || codeInput.replace(/[^a-z0-9]/gi, "").length < 8}>{tc("continue")}</Button>
        </form>
        <Button variant="ghost" onClick={() => go("role")}>{tc("back")}</Button>
      </Card>
    );
  }

  // ── Client: what this is, and what the therapist can see ────────────────
  if (step === "welcome" && invite) {
    const n = invite.therapistName;
    return (
      <Card className="space-y-5 fade-up">
        {progress}
        <h1 className="text-3xl">{tj("invitedBy", { name: n })}</h1>
        <p className="text-muted">{tj("whatItIs", { name: n })}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{tj("seesTitle", { name: n })}</p>
            <ul className="space-y-1.5 text-sm text-muted">{[tj("sees1"), tj("sees3")].map((s) => <li key={s} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden />{s}</li>)}</ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">{tj("notSeesTitle")}</p>
            <ul className="space-y-1.5 text-sm text-muted">{[tj("notSees1"), tj("notSees3")].map((s) => <li key={s} className="flex gap-2"><X size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />{s}</li>)}</ul>
          </div>
        </div>
        <Notice tone="info">{tj("notMonitored")}</Notice>
        <label className="flex items-start gap-3 text-ui text-ink">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary-strong)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{tj.rich("agree", { privacy: (c) => <a href="/privacy" target="_blank" className="text-primary-strong underline underline-offset-4">{c}</a> })}</span>
        </label>
        <Button className="w-full" disabled={!agreed} onClick={() => go("details")}>{tc("continue")}</Button>
        {!given && <Button variant="ghost" onClick={() => go("invite")}>{tc("back")}</Button>}
        {signInLine}
      </Card>
    );
  }

  // ── Name, email, password ───────────────────────────────────────────────
  if (step === "details") {
    return (
      <Card className="space-y-5 fade-up">
        {progress}
        <h1 className="text-3xl">{t("detailsTitle")}</h1>
        <p className="text-muted">{role === "client" ? t("detailsClient") : t("detailsTherapist")}</p>
        <form onSubmit={createAccount} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("firstName")} htmlFor="first">
              <Input id="first" autoComplete="given-name" required maxLength={60} value={first} onChange={(e) => setFirst(e.target.value)} autoFocus />
            </Field>
            <Field label={t("lastName")} htmlFor="last">
              <Input id="last" autoComplete="family-name" required maxLength={60} value={last} onChange={(e) => setLast(e.target.value)} />
            </Field>
          </div>
          <Field label={ta("email")} htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={ta("password")} htmlFor="password" hint={t("passwordHint")}>
            <Input id="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={t("repeat")} htmlFor="repeat">
            <Input id="repeat" type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </Field>
          {error && (
            <Notice tone="attention">
              {error}{" "}
              {exists && <Link href="/login" className="underline underline-offset-4">{t("signInInstead")}</Link>}
            </Notice>
          )}
          <Button type="submit" className="w-full" disabled={pending || !first.trim() || !last.trim()}>{pending ? t("creating") : t("create")}</Button>
        </form>
        <Button variant="ghost" onClick={() => go(role === "client" ? "welcome" : "role")}>{tc("back")}</Button>
      </Card>
    );
  }

  // ── Confirm the email with a code ───────────────────────────────────────
  if (step === "verify") {
    return (
      <Card className="space-y-5 fade-up">
        {progress}
        <h1 className="text-3xl">{ta("checkTitle")}</h1>
        <p className="text-muted">{t("verifyBody", { email: email.trim() })}</p>
        <form onSubmit={confirmEmail} className="space-y-4">
          <Field label={ta("code")} hint={ta("codeHint")} htmlFor="otp" error={error ?? undefined}>
            <Input id="otp" inputMode="numeric" autoComplete="one-time-code" autoFocus required maxLength={7} value={otp}
              onChange={(e) => setOtp(e.target.value)} className="text-center font-serif text-2xl tracking-[0.4em]" />
          </Field>
          <Button type="submit" className="w-full" disabled={pending || otp.replace(/\D/g, "").length !== 6}>{t("confirm")}</Button>
        </form>
        {info && <Notice tone="success">{info}</Notice>}
        <p className="text-sm text-muted">{ta("spamHint")} {t("verifyExists")}</p>
        {devMailbox && (
          <Notice tone="info">
            {ta("devMailboxHint")}{" "}
            <a className="text-primary-strong underline underline-offset-4" href="/dev/mailbox" target="_blank" rel="noreferrer">{ta("devMailbox")}</a>
          </Notice>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={resend} disabled={pending || wait > 0}>{wait > 0 ? ta("resendIn", { seconds: wait }) : ta("resend")}</Button>
          <Button variant="ghost" onClick={() => go("details")}>{ta("useDifferent")}</Button>
        </div>
      </Card>
    );
  }

  // ── Optional photo ──────────────────────────────────────────────────────
  return (
    <Card className="space-y-5 fade-up">
      {progress}
      <h1 className="text-3xl">{t("photoTitle")}</h1>
      <p className="text-muted">{role === "client" ? t("photoClient") : t("photoTherapist")}</p>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} email={email} image={image} size={88} />
        <input ref={file} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label={tacc("addPhoto")} onChange={(e) => pick(e.target.files?.[0])} />
        <Button variant="secondary" onClick={() => file.current?.click()}><Camera size={16} aria-hidden /> {image ? tacc("changePhoto") : tacc("addPhoto")}</Button>
      </div>
      {error && <Notice tone="attention">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" onClick={() => finish(true)} disabled={pending || !image}>{tc("continue")}</Button>
        <Button variant="ghost" onClick={() => finish(false)} disabled={pending}>{t("skip")}</Button>
      </div>
    </Card>
  );
}
