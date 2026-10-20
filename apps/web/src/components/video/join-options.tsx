"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Link2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createGuestLink } from "@/app/(app)/video/actions";

/** Therapist: how the client gets into this session (client app, or a one-time link). */
export function JoinOptions({ roomId, clientName, linked }: { roomId: string; clientName: string; linked: boolean }) {
  const t = useTranslations("video");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const make = () => start(async () => {
    setFailed(false);
    const res = await createGuestLink(roomId).catch(() => ({ error: "gone" as const }));
    if ("url" in res) { setUrl(res.url); setCopied(false); } else setFailed(true);
  });
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* the field stays selectable */ }
  };

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-4 text-left">
      <p className="font-medium text-ink">{t("howJoins", { name: clientName })}</p>
      {linked && (
        <p className="flex gap-2 text-sm text-ink"><Smartphone size={17} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden /> {t("joinsInApp", { name: clientName })}</p>
      )}
      <div className="space-y-2">
        <p className="flex gap-2 text-sm text-ink"><Link2 size={17} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden /> {linked ? t("orLink") : t("sendLink")}</p>
        {url ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label={t("linkLabel")}
              className="min-w-0 flex-1 rounded-control border border-line bg-surface-2 px-3 py-2 text-sm text-ink" />
            <Button variant="secondary" onClick={copy}>{copied ? <><Check size={16} aria-hidden /> {t("copied")}</> : <><Copy size={16} aria-hidden /> {t("copy")}</>}</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={make} disabled={pending}>{t("makeLink")}</Button>
        )}
        {url && <p className="text-xs text-muted">{t("linkNote")}</p>}
        {failed && <p className="text-sm text-attention-strong">{t("gone")}</p>}
      </div>
    </div>
  );
}
