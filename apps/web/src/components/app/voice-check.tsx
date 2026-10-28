"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mic } from "lucide-react";
import { recordClip } from "@/lib/client/audio";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { DevicePicker } from "@/components/app/device-picker";

export function VoiceCheck({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("onboarding");
  const [state, setState] = useState<"idle" | "recording" | "done" | "error">("idle");
  const [level, setLevel] = useState(0);

  async function start() {
    setState("recording");
    try {
      const blob = await recordClip(5, setLevel);
      const res = await fetch("/api/voice", { method: "POST", body: blob, headers: { "content-type": blob.type || "audio/webm" } });
      if (!res.ok) throw new Error("upload");
      setState("done");
      onDone?.();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-4">
      <blockquote className="rounded-card border border-line bg-surface-2 px-5 py-4 font-serif text-xl text-ink">
        “{t("voiceSentence")}”
      </blockquote>
      {state === "recording" && (
        <div className="flex items-center gap-3" aria-live="polite">
          <span className="breathing-dot" />
          <span>{t("voiceRecording")}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(level * 100)}%` }} />
          </span>
        </div>
      )}
      {state === "done" && <Notice tone="success">{t("voiceDone")}</Notice>}
      {state === "error" && <Notice tone="attention">{t("voiceNoMic")}</Notice>}
      {state !== "recording" && state !== "done" && <DevicePicker kind="audioinput" />}
      {state !== "recording" && state !== "done" && (
        <Button onClick={start} variant={state === "error" ? "secondary" : "primary"}>
          <Mic size={18} aria-hidden /> {state === "error" ? t("voiceRetry") : t("voiceStart")}
        </Button>
      )}
    </div>
  );
}
