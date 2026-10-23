"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, RotateCcw, Shapes, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveToolResult } from "@/app/(app)/video/tool-actions";
import { DEFAULT_DECK, deckRefs } from "@/lib/tools/decks";
import { BALANCE_AREAS, SCALE_PRESETS, TOOL_KINDS, newTool, type ToolAction, type ToolKind, type ToolState } from "@/lib/tools/model";
import { ScaleTool } from "./scale-tool";
import { BalanceTool } from "./balance-tool";
import { EmotionsTool } from "./emotions-tool";
import { CardsTool } from "./cards-tool";
import { BoardTool, boardPng } from "./board-tool";
import type { Role } from "./use-tools";
import { TOOL_ICONS } from "./icons";


/** What gets saved to the client's card; null while there's nothing to save yet. */
function resultOf(tool: ToolState, label: (key: string) => string): Record<string, unknown> | null {
  switch (tool.kind) {
    case "scale":
      return tool.value === null || !tool.question.trim() ? null : { kind: "scale", question: tool.question.trim(), low: tool.low.trim(), high: tool.high.trim(), value: tool.value };
    case "balance":
      return tool.areas.some((a) => a.value) ? { kind: "balance", areas: tool.areas.map((a) => ({ label: a.label.trim() || "—", value: a.value })) } : null;
    case "emotions":
      return tool.picked.length ? { kind: "emotions", picked: tool.picked, labels: tool.picked.map(label) } : null;
    case "cards":
      return tool.drawn.length ? { kind: "cards", mode: tool.mode, drawn: tool.drawn.map((d) => ({ id: d.id, note: d.note.trim() })) } : null;
    case "board":
      return tool.strokes.length ? {
        kind: "board", strokes: tool.strokes.length, colors: [...new Set(tool.strokes.map((s) => s.color))], sizes: [...new Set(tool.strokes.map((s) => s.size))],
      } : null;
  }
}

/** Therapist: the "Tools" button and its menu in the call's control bar. */
export function ToolMenu({ open, onOpen, onClose }: { open: ToolKind | null; onOpen: (kind: ToolKind) => void; onClose: () => void }) {
  const t = useTranslations("tools");
  const [shown, setShown] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!shown) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setShown(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setShown(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [shown]);
  return (
    <div ref={box} className="relative">
      <Button variant="secondary" onClick={() => setShown(!shown)} aria-expanded={shown} aria-haspopup="true">
        <Shapes size={18} aria-hidden /> <span className="sr-only sm:not-sr-only">{t("menu")}</span>
      </Button>
      {shown && (
        <div className="fade-up absolute bottom-full left-1/2 z-30 mb-2 w-[min(88vw,320px)] -translate-x-1/2 space-y-1 rounded-card border border-line bg-surface p-2 shadow-[var(--shadow)]">
          <p className="px-2 pb-1 pt-0.5 text-xs uppercase tracking-wide text-muted">{t("menuTitle")}</p>
          {TOOL_KINDS.map((k) => {
            const Icon = TOOL_ICONS[k];
            return (
              <button key={k} type="button" onClick={() => { onOpen(k); setShown(false); }} aria-current={open === k ? "true" : undefined}
                className={`flex w-full items-start gap-3 rounded-inner px-2 py-2 text-left hover:bg-surface-2 ${open === k ? "bg-primary-soft" : ""}`}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><Icon size={17} aria-hidden /></span>
                <span><span className="block font-medium text-ink">{t(`kind_${k}`)}</span><span className="block text-xs text-muted">{t(`body_${k}`)}</span></span>
              </button>
            );
          })}
          {open && (
            <button type="button" onClick={() => { onClose(); setShown(false); }} className="flex w-full items-center gap-3 rounded-inner px-2 py-2 text-left text-muted hover:bg-surface-2 hover:text-ink">
              <X size={17} aria-hidden className="ml-2" /> {t("close")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A fresh tool with labels in the therapist's language. */
export function useNewTool() {
  const t = useTranslations("tools");
  return (kind: ToolKind) => newTool(kind, {
    deck: DEFAULT_DECK, deckIds: deckRefs(DEFAULT_DECK),
    question: t(`scale_${SCALE_PRESETS[0]}`), low: t(`scale_${SCALE_PRESETS[0]}_low`), high: t(`scale_${SCALE_PRESETS[0]}_high`),
    areas: BALANCE_AREAS.map((a) => t(`area_${a}`)),
  });
}

/** The open tool, shared by both people, with the therapist's save and close. */
export function ToolStage({ tool, role, roomId, otherName, act, set, savedAt, notifySaved }: {
  tool: ToolState; role: Role; roomId: string; otherName: string;
  act: (a: ToolAction) => void; set: (s: ToolState | null) => void;
  /** Client: when the therapist last saved (shows a short notice). */
  savedAt: number;
  /** Therapist: tells the client's screen that the result was saved. */
  notifySaved?: () => void;
}) {
  const t = useTranslations("tools");
  const fresh = useNewTool();
  const [confirmFresh, setConfirmFresh] = useState(false);
  const Icon = TOOL_ICONS[tool.kind];
  const label = (key: string) => { const [f, w] = key.split("."); return t(`words.${f}.${w}`); };
  const result = role === "therapist" ? resultOf(tool, label) : null;
  const key = result ? JSON.stringify(result) : null;
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState(false);
  // Client: "saved to your notes" shows for a few seconds after each save.
  const [hiddenAt, setHiddenAt] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const id = setTimeout(() => setHiddenAt(savedAt), 6000);
    return () => clearTimeout(id);
  }, [savedAt]);
  const clientNotice = savedAt > hiddenAt;

  async function save() {
    if (!result) return;
    setSaving(true);
    setError(false);
    const res = await saveToolResult({ roomId, content: result, image: tool.kind === "board" ? boardPng(tool.strokes) : null }).catch(() => ({ ok: false as const }));
    setSaving(false);
    if (res.ok) { setSavedKey(key); notifySaved?.(); } else setError(true);
  }
  const hint = tool.kind === "cards" ? t(`hint_cards_${tool.mode}`) : t(`hint_${tool.kind}`);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><Icon size={18} aria-hidden /></span>
        {/* At least 12rem for the title, so on a phone the buttons wrap below instead of squeezing it. */}
        <div className="min-w-0 flex-1 basis-48">
          <p className="font-medium text-ink">{t(`kind_${tool.kind}`)}</p>
          <p className="text-sm text-muted" aria-live="polite">
            {role === "client" && clientNotice ? <span className="text-primary-strong">{t("savedClient")}</span>
              : role === "therapist" ? t("clientSees", { name: otherName }) : hint}
          </p>
        </div>
        {role === "therapist" && (
          <div className="flex flex-wrap items-center gap-2">
            {savedKey && savedKey === key ? (
              <span className="inline-flex items-center gap-1.5 text-sm text-primary-strong" aria-live="polite"><Check size={16} aria-hidden /> {t("saved", { name: otherName })}</span>
            ) : (
              <Button size="sm" onClick={save} disabled={!result || saving} title={!result ? t("needAnswer") : undefined}>
                {saving ? t("saving") : t("save")}
              </Button>
            )}
            {/* What a tool holds stays for the call; this empties it. Asks once, since it can't be undone. */}
            {confirmFresh ? (
              <span className="inline-flex items-center gap-1 text-sm">
                <Button size="sm" variant="secondary" onClick={() => { set(fresh(tool.kind)); setConfirmFresh(false); }}>{t("startOverYes")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmFresh(false)}>{t("startOverNo")}</Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmFresh(true)} title={t("startOverHint")}>
                <RotateCcw size={15} aria-hidden /> <span className="hidden sm:inline">{t("startOver")}</span><span className="sr-only sm:hidden">{t("startOver")}</span>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => set(null)} aria-label={t("close")}><X size={16} aria-hidden /> <span className="hidden sm:inline">{t("closeShort")}</span></Button>
          </div>
        )}
      </div>
      {error && <p className="border-b border-line bg-attention-soft px-4 py-2 text-sm text-ink" role="alert">{t("saveFailed")}</p>}
      <div className="relative min-h-0 flex-1 overflow-auto p-3 sm:p-4">
        {tool.kind === "scale" && <ScaleTool tool={tool} role={role} act={act} set={set} />}
        {tool.kind === "balance" && <BalanceTool tool={tool} role={role} act={act} set={set} />}
        {tool.kind === "emotions" && <EmotionsTool tool={tool} act={act} />}
        {tool.kind === "cards" && <CardsTool tool={tool} role={role} act={act} set={set} />}
        {tool.kind === "board" && <BoardTool tool={tool} role={role} act={act} set={set} />}
      </div>
    </div>
  );
}
