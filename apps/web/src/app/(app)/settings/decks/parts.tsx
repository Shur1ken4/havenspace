"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { CardFace } from "@/components/cards/card-face";
import { parseCustomRef } from "@/lib/tools/decks";
import { createDeck, deleteDeck, deleteDeckCard, renameDeck, type DeckFormState } from "./actions";

const LONG_SIDE = 1200;

/** Shrinks a picture in the browser (long side 1200 px, JPEG), so uploads stay small. */
async function shrink(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, LONG_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(16, Math.round(bmp.width * s)), h = Math.max(16, Math.round(bmp.height * s));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("encode");
  return { blob, w, h };
}

/** "Add pictures": several files at once, uploaded one by one with progress. */
function Uploader({ deckId, room }: { deckId: string; room: number }) {
  const t = useTranslations("decks");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<"some" | "full" | null>(null);

  async function upload(files: File[]) {
    setProblem(null);
    const list = files.filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (files.length > room) setProblem("full");
    setProgress({ done: 0, total: list.length });
    let failed = 0;
    for (const [i, file] of list.entries()) {
      try {
        const { blob, w, h } = await shrink(file);
        const res = await fetch(`/api/decks/${deckId}/cards?w=${w}&h=${h}`, { method: "POST", body: blob, headers: { "content-type": "image/jpeg" } });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: list.length });
    }
    if (failed) setProblem("some");
    setProgress(null);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" tabIndex={-1}
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) void upload(f); }} />
      <Button variant="secondary" size="sm" disabled={!!progress || room <= 0} onClick={() => input.current?.click()}>
        <ImagePlus size={16} aria-hidden /> {progress ? t("uploading", { done: progress.done, total: progress.total }) : t("addPictures")}
      </Button>
      {problem === "some" && <p role="alert" className="text-sm text-ink">{t("someFailed")}</p>}
      {problem === "full" && <p role="alert" className="text-sm text-ink">{t("deckFull")}</p>}
    </div>
  );
}

export function MyDeckCard({ deck, max }: { deck: { id: string; name: string; refs: string[] }; max: number }) {
  const t = useTranslations("decks");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(deck.name);
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); start(async () => { await renameDeck(deck.id, name); setEditing(false); }); }}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label={t("name")} className="min-w-0 flex-1" autoFocus />
            <Button size="sm" disabled={pending || !name.trim()}>{t("save")}</Button>
          </form>
        ) : (
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-serif text-xl text-ink">
              {deck.name}
              <button type="button" onClick={() => setEditing(true)} aria-label={t("rename")} className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"><Pencil size={14} aria-hidden /></button>
            </h3>
            <p className="text-sm text-muted">{t("count", { count: deck.refs.length })}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Uploader deckId={deck.id} room={max - deck.refs.length} />
          {confirm ? (
            <span className="flex gap-1">
              <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(() => deleteDeck(deck.id))}>{t("deleteDeckConfirm")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>{t("cancel")}</Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}><Trash2 size={15} aria-hidden /> {t("deleteDeck")}</Button>
          )}
        </div>
      </div>
      {deck.refs.length === 0 ? <p className="text-sm text-muted">{t("emptyDeck")}</p> : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {deck.refs.map((r) => (
            <li key={r} className="group relative">
              <CardFace refId={r} fit="cover" />
              <button type="button" disabled={pending} onClick={() => start(() => deleteDeckCard(parseCustomRef(r)!.cardId))} aria-label={t("deleteCard")}
                className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-white opacity-100 hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function NewDeckForm({ first }: { first: boolean }) {
  const t = useTranslations("decks");
  const [open, setOpen] = useState(first);
  const [state, action, pending] = useActionState<DeckFormState, FormData>(createDeck, {});
  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}><ImagePlus size={17} aria-hidden /> {t("newDeck")}</Button>;
  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-serif text-xl text-ink">{t("newDeck")}</h3>
      <form action={action} className="space-y-4" key={state.id ?? "new"}>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">{t("name")}</span>
          <Input name="name" maxLength={60} required placeholder={t("namePlaceholder")} />
        </label>
        <label className="flex cursor-pointer gap-3 rounded-card border border-line p-3">
          <input type="checkbox" name="rights" required className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary-strong)]" />
          <span className="space-y-1">
            <span className="block text-sm text-ink">{t("rights")}</span>
            <span className="block text-xs text-muted">{t("rightsHint")}</span>
          </span>
        </label>
        {state.error && <Notice tone="attention">{t(`error_${state.error}`)}</Notice>}
        {state.id && <Notice tone="success">{t("created")}</Notice>}
        <Button disabled={pending}>{t("create")}</Button>
      </form>
    </Card>
  );
}
