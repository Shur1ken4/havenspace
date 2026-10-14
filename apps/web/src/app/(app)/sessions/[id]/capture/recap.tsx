"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { pickMimeType } from "@/lib/client/audio";
import { UploadQueue } from "@/lib/client/upload-queue";
import { submitRecap } from "../../actions";

// Dictation records the therapist's own voice and transcribes it on our own
// EU speech-to-text — never the browser's cloud dictation.
export function RecapForm({ sessionId, today }: { sessionId: string; today: string }) {
  const t = useTranslations("session");
  const tc = useTranslations("common");
  const [text, setText] = useState("");
  const [dictation, setDictation] = useState<"idle" | "recording" | "transcribing" | "error">("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const queue = useRef<UploadQueue | null>(null);
  const seq = useRef(0);
  const segment = useRef(0);

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((x) => x.stop()), []);

  async function startDictation() {
    try {
      const status = await (await fetch(`/api/sessions/${sessionId}/status`, { cache: "no-store" })).json();
      segment.current = Number(status.next_segment ?? 0);
      seq.current = 0;
      queue.current = new UploadQueue(sessionId, () => {});
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      rec.ondataavailable = (e) => queue.current?.push({ track: "dictation", segment: segment.current, seq: seq.current++, blob: e.data });
      rec.start(5000);
      recorder.current = rec;
      setDictation("recording");
    } catch {
      setDictation("error");
    }
  }

  async function stopDictation() {
    const rec = recorder.current;
    if (!rec) return;
    setDictation("transcribing");
    await new Promise<void>((resolve) => { rec.addEventListener("stop", () => resolve(), { once: true }); rec.stop(); });
    rec.stream.getTracks().forEach((x) => x.stop());
    await queue.current?.drain();
    const res = await fetch(`/api/sessions/${sessionId}/dictation`, { method: "POST", body: JSON.stringify({ segment: segment.current }), headers: { "content-type": "application/json" } });
    if (!res.ok) { setDictation("error"); return; }
    for (let i = 0; i < 180; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const s = await (await fetch(`/api/sessions/${sessionId}/status`, { cache: "no-store" })).json();
      if (s.dictation_status === "ready") {
        setText((prev) => (prev.trim() ? `${prev.trim()}\n\n` : "") + (s.dictation_text ?? ""));
        await fetch(`/api/sessions/${sessionId}/dictation`, { method: "DELETE" });
        setDictation("idle");
        return;
      }
      if (s.dictation_status === "failed") break;
    }
    setDictation("error");
  }

  return (
    <Card className="space-y-5 sm:p-8">
      <h2 className="text-2xl">{t("recapTitle")}</h2>
      <p className="text-muted">{t("recapHint")}</p>
      <form action={submitRecap} className="space-y-5">
        <input type="hidden" name="sessionId" value={sessionId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("dateLabel")} htmlFor="date"><Input id="date" name="date" type="date" defaultValue={today} max={today} required /></Field>
          <Field label={t("durationLabel")} htmlFor="minutes"><Input id="minutes" name="minutes" type="number" min={5} max={240} defaultValue={50} required /></Field>
        </div>
        <Field label={t("recapTitle")} htmlFor="recap">
          <Textarea id="recap" name="text" rows={12} minLength={20} maxLength={20000} required placeholder={t("recapPlaceholder")} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          {dictation === "recording" ? (
            <Button type="button" variant="secondary" onClick={stopDictation}><Square size={16} aria-hidden /> {t("stopDictation")} <span className="breathing-dot ml-1" /></Button>
          ) : (
            <Button type="button" variant="secondary" onClick={startDictation} disabled={dictation === "transcribing"}>
              <Mic size={16} aria-hidden /> {dictation === "transcribing" ? tc("loading") : t("dictate")}
            </Button>
          )}
          <Button type="submit" size="lg" disabled={dictation === "recording" || dictation === "transcribing"}>{t("recapSubmit")}</Button>
        </div>
        {dictation === "error" && <Notice tone="attention">{tc("somethingWrong")}</Notice>}
      </form>
    </Card>
  );
}
