"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileCheck2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type Doc = { id: string; filename: string };

/** Phone photos are often 5–10 MB: shrink them in the browser before upload. */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("shrink"))), "image/jpeg", 0.85));
}

/** Optional licence / membership / student document for pilot verification (ADR-14). */
export function DocumentUpload() {
  const t = useTranslations("documents");
  const input = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/documents", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).then((d) => { if (alive) setDocs(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const body = file.type === "application/pdf" ? file : await shrinkImage(file);
      if (body.size > 4 * 1024 * 1024) { setError(t("tooBig")); return; }
      const res = await fetch("/api/documents", { method: "POST", body, headers: { "x-filename": encodeURIComponent(file.name) } });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))).error;
        setError(e === "bad_type" ? t("badType") : e === "too_many" ? t("tooMany") : e === "bad_size" ? t("tooBig") : t("failed"));
        return;
      }
      const doc = await res.json();
      setDocs((d) => [...d, doc]);
    } catch {
      setError(t("failed"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) setDocs((d) => d.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-medium text-ink">{t("title")} <span className="font-normal text-muted">· {t("optional")}</span></p>
        <p className="text-sm text-muted">{t("body")}</p>
      </div>
      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2 text-sm">
              <FileCheck2 size={16} className="shrink-0 text-primary-strong" aria-hidden />
              <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-ink hover:underline">{d.filename}</a>
              <button type="button" onClick={() => remove(d.id)} aria-label={t("remove")} className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink"><Trash2 size={15} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" id="doc-file"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      <Button type="button" variant="secondary" disabled={busy || docs.length >= 5} onClick={() => input.current?.click()}>
        <Upload size={16} aria-hidden /> {busy ? t("uploading") : t("add")}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted">{t("privacy")}</p>
    </div>
  );
}
