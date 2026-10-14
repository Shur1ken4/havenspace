"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";

const PART = 4 * 1024 * 1024;
const MAX = 300 * 1024 * 1024;
const OK_TYPES = /^(audio\/|video\/webm|video\/mp4|video\/ogg)/;

export function Uploader({ sessionId }: { sessionId: string }) {
  const t = useTranslations("session");
  const tc = useTranslations("common");
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setError(null);
    const parts = Math.ceil(file.size / PART);
    for (let i = 0; i < parts; i++) {
      const blob = file.slice(i * PART, Math.min(file.size, (i + 1) * PART), file.type);
      let ok = false;
      for (let attempt = 0; attempt < 5 && !ok; attempt++) {
        const res = await fetch(`/api/sessions/${sessionId}/chunks?track=upload&segment=0&seq=${i}`, {
          method: "POST", body: blob, headers: { "content-type": file.type || "application/octet-stream" },
        }).catch(() => null);
        ok = Boolean(res?.ok);
        if (!ok) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
      if (!ok) { setError(tc("somethingWrong")); setProgress(null); return; }
      setProgress(Math.round(((i + 1) / parts) * 100));
    }
    const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (res.ok) router.push(`/sessions/${sessionId}`);
    else setError(tc("somethingWrong"));
  }

  const invalid = file && (file.size > MAX || !OK_TYPES.test(file.type || "audio/"));
  return (
    <Card className="space-y-5 sm:p-8">
      <h2 className="text-2xl">{t("uploadTitle")}</h2>
      <p className="text-muted">{t("uploadHint")}</p>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[14px] border-2 border-dashed border-line bg-surface-2 px-6 py-10 text-center hover:border-primary">
        <Upload className="text-primary-strong" aria-hidden />
        <span className="font-medium">{file ? file.name : t("uploadChoose")}</span>
        {file && <span className="text-sm text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>}
        <input type="file" accept="audio/*,video/webm,video/mp4" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {invalid && <Notice tone="attention">{t("uploadHint")}</Notice>}
      {error && <Notice tone="attention">{error}</Notice>}
      {progress !== null ? (
        <div className="space-y-2" aria-live="polite">
          <p>{t("uploadProgress", { percent: progress })}</p>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
        </div>
      ) : (
        <Button size="lg" disabled={!file || Boolean(invalid)} onClick={() => { setProgress(0); upload(); }}>{t("uploadStart")}</Button>
      )}
    </Card>
  );
}
