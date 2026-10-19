"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DISMISS_KEY = "passkey-prompt-dismissed";

/** A gentle one-time offer to add a passkey, so the next sign-in is one tap. */
export function PasskeyPrompt() {
  const t = useTranslations("passkeyPrompt");
  const tc = useTranslations("common");
  const [state, setState] = useState<"hidden" | "offer" | "added">("hidden");
  const [error, setError] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch {}
    if (dismissed || typeof window.PublicKeyCredential === "undefined") return;
    let alive = true;
    authClient.$fetch<unknown[]>("/passkey/list-user-passkeys", { method: "GET" }).then((res) => {
      if (alive && Array.isArray(res.data) && res.data.length === 0) setState("offer");
    });
    return () => { alive = false; };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setState("hidden");
  };
  async function add() {
    setError(false);
    const res = await authClient.passkey.addPasskey({ name: navigator.platform || "Passkey" });
    if (res?.error) setError(true);
    else setState("added");
  }

  if (state === "hidden") return null;
  return (
    <Card className="flex flex-wrap items-center gap-4 fade-up">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><KeyRound size={20} aria-hidden /></span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-ink">{t("title")}</p>
        <p className="text-sm text-muted" aria-live="polite">{state === "added" ? t("added") : error ? tc("somethingWrong") : t("body")}</p>
      </div>
      {state === "offer" ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={add}>{t("add")}</Button>
          <Button variant="ghost" onClick={dismiss}>{t("notNow")}</Button>
        </div>
      ) : (
        <Button variant="ghost" onClick={dismiss}>{tc("close")}</Button>
      )}
    </Card>
  );
}
