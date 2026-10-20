"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { joinWithCode, type JoinError } from "../actions";

type Who = "none" | "fresh" | "therapist" | "client";

/** A signed-in person accepts a therapist's invite (new people use the sign-up wizard). */
export function JoinFlow({ code, therapistName, who, email: signedInEmail }: { code: string; therapistName: string; who: Who; email: string | null }) {
  const t = useTranslations("join");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const joinError = (e: JoinError) => setError(t(`error_${e}`));
  const connect = () => start(async () => {
    setError(null);
    const res = await joinWithCode(code); // redirects to the client app on success
    if (res?.error) joinError(res.error);
  });

  if (who === "therapist") {
    return (
      <Card className="space-y-4">
        <h1 className="text-3xl">{t("therapistTitle")}</h1>
        <p className="text-muted">{t("therapistBody", { email: signedInEmail ?? "" })}</p>
        <Button variant="secondary" onClick={async () => { await authClient.signOut(); window.location.reload(); }}>{t("signOutFirst")}</Button>
      </Card>
    );
  }

  {
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
        <label className="flex items-start gap-3 text-ui text-ink">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary-strong)]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{t.rich("agree", { privacy: (c) => <a href="/privacy" target="_blank" className="text-primary-strong underline underline-offset-4">{c}</a> })}</span>
        </label>
        {error && <Notice tone="attention">{error}</Notice>}
        <Button className="w-full" disabled={!agreed || pending} onClick={connect}>{t("connect")}</Button>
      </Card>
    );
  }

}
