"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Maximize, MessageCircleQuestion, Minus, Plus, Shuffle, Undo2, X, ZoomIn } from "lucide-react";
import { DECKS, cardView, deckRefs, isBuiltInDeck, pick } from "@/lib/tools/decks";
import { CARD_PROMPTS, CARD_SPREAD, fitCards, shuffle, type ToolAction, type ToolState } from "@/lib/tools/model";
import { LogoMark } from "@/components/illustrations";
import { CardFace } from "@/components/cards/card-face";
import { useCallDecks } from "./decks-context";
import type { Role } from "./use-tools";

type Cards = Extract<ToolState, { kind: "cards" }>;

/** The size of an element, kept up to date as the window or layout changes. */
function useBox<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

/** The back of a card: the same for every card, so a face-down choice is truly blind. */
function CardBack({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center justify-center rounded-inner border-[3px] border-surface bg-primary-strong shadow-[var(--shadow)] ${className}`}
      style={{
        backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,.18), transparent 55%), repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 6px, transparent 6px 12px)",
        ["--brand" as string]: "rgba(255,255,255,.85)",
      }}>
      <LogoMark className="h-1/3 w-1/3" />
    </span>
  );
}

/** The words for a card. Typed locally and shared after a short pause; they stay with the card for the call. */
function NoteField({ note, onNote, className = "" }: { note: string; onNote: (note: string) => void; className?: string }) {
  const t = useTranslations("tools");
  // While this person types, their own text shows; otherwise the shared note (which the other person may change).
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <input value={draft ?? note} maxLength={200} placeholder={t("notePlaceholder")} aria-label={t("notePlaceholder")}
      onFocus={() => setDraft(note)} onBlur={() => { if (timer.current) clearTimeout(timer.current); if (draft !== null && draft !== note) onNote(draft); setDraft(null); }}
      onChange={(e) => {
        setDraft(e.target.value);
        if (timer.current) clearTimeout(timer.current);
        const v = e.target.value;
        timer.current = setTimeout(() => onNote(v), 400);
      }}
      className={`min-h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink ${className}`} />
  );
}

/** One card on the table: tap to look closer; its words underneath. */
function DrawnCard({ id, note, width, keys, role, onNote, onZoom, onReturn }: {
  id: string; note: string; width: number; keys?: Record<string, string>; role: Role;
  onNote: (note: string) => void; onZoom: () => void; onReturn?: () => void;
}) {
  const t = useTranslations("tools");
  const locale = useLocale();
  const card = cardView(id, keys);
  if (!card) return null;
  return (
    <figure className="flip-in flex flex-col gap-1.5" style={{ width }}>
      <div className="group relative">
        <button type="button" onClick={onZoom} aria-label={t("zoomOpen")} className="block w-full rounded-inner focus-visible:outline-offset-2">
          <CardFace refId={id} keys={keys} className="aspect-[2/3] w-full border-[3px] border-surface shadow-[var(--shadow)]" />
          <span aria-hidden className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-80 transition-opacity group-hover:opacity-100">
            <ZoomIn size={15} />
          </span>
        </button>
        {onReturn && (
          <button type="button" onClick={onReturn} aria-label={t("returnCard")} title={t("returnCard")}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white opacity-80 transition-opacity hover:bg-black/65 group-hover:opacity-100">
            <X size={15} aria-hidden />
          </button>
        )}
      </div>
      {/* The card's own question, for the therapist only (Pathways and Inner resources). */}
      {role === "therapist" && card.question && <figcaption className="line-clamp-2 text-xs italic leading-snug text-muted">{pick(card.question, locale)}</figcaption>}
      <NoteField note={note} onNote={onNote} />
    </figure>
  );
}

const ZOOM_MIN = 0.5, ZOOM_MAX = 4, ZOOM_STEP = 0.25;

/** One drawn card, large, with its own zoom. Each person zooms on their own screen. */
function CardZoom({ tool, index, role, onIndex, onClose, act }: {
  tool: Cards; index: number; role: Role; onIndex: (i: number) => void; onClose: () => void; act: (a: ToolAction) => void;
}) {
  const t = useTranslations("tools");
  const locale = useLocale();
  const [zoom, setZoom] = useState(1);
  const [area, box] = useBox<HTMLDivElement>();
  const d = tool.drawn[index];
  const card = d ? cardView(d.id, tool.keys) : null;
  const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
  const step = useCallback((by: number) => setZoom((z) => clamp(z + by)), []);
  const total = tool.drawn.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") step(ZOOM_STEP);
      else if (e.key === "-") step(-ZOOM_STEP);
      else if (e.key === "0") setZoom(1);
      else if (e.key === "ArrowLeft" && index > 0) { onIndex(index - 1); setZoom(1); }
      else if (e.key === "ArrowRight" && index < total - 1) { onIndex(index + 1); setZoom(1); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, total, onIndex, onClose, step]);

  // Ctrl/⌘ + wheel (and a trackpad pinch) zooms the card, not the page.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.1 : 0.9)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [area]);

  if (!d || !card) return null;
  // "Fit" shows the whole card in the space; zoom grows it from there (scroll to look around).
  const fitW = Math.max(80, Math.min(box.w - 16, (box.h - 16) / 1.5));
  const w = Math.round(fitW * zoom);
  const go = (i: number) => { onIndex(i); setZoom(1); };
  const iconBtn = "flex h-9 w-9 items-center justify-center rounded-control border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-40";

  return (
    <div role="dialog" aria-modal="true" aria-label={t("zoomTitle", { n: index + 1, total })}
      className="fade-up absolute inset-0 z-20 flex flex-col gap-2 bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onClose} className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 text-sm text-ink hover:bg-surface-2">
          <ChevronLeft size={16} aria-hidden /> {t("zoomClose")}
        </button>
        <span className="text-sm text-muted">{t("zoomTitle", { n: index + 1, total })}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={iconBtn} onClick={() => go(index - 1)} disabled={index === 0} aria-label={t("prevCard")}><ChevronLeft size={17} aria-hidden /></button>
          <button type="button" className={iconBtn} onClick={() => go(index + 1)} disabled={index >= total - 1} aria-label={t("nextCard")}><ChevronRight size={17} aria-hidden /></button>
        </div>
      </div>
      <div ref={area} className="min-h-0 flex-1 overflow-auto rounded-inner bg-surface-2">
        <div className="flex min-h-full min-w-full items-center justify-center p-2" style={{ width: w + 16 > box.w ? w + 16 : undefined }}>
          <CardFace key={d.id} refId={d.id} keys={tool.keys} className="shrink-0 border-[3px] border-surface shadow-[var(--shadow)]"
            style={{ width: w, height: Math.round(w * 1.5) }} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("zoomLevel")} className="flex items-center gap-1.5">
          <button type="button" className={iconBtn} onClick={() => step(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label={t("zoomOut")}><Minus size={16} aria-hidden /></button>
          <input type="range" min={ZOOM_MIN * 100} max={ZOOM_MAX * 100} step={5} value={Math.round(zoom * 100)} onChange={(e) => setZoom(clamp(Number(e.target.value) / 100))}
            aria-label={t("zoomLevel")} aria-valuetext={`${Math.round(zoom * 100)}%`} className="w-28 accent-[var(--primary-strong)] sm:w-40" />
          <button type="button" className={iconBtn} onClick={() => step(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label={t("zoomIn")}><Plus size={16} aria-hidden /></button>
          <button type="button" onClick={() => setZoom(1)} className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-2.5 text-sm text-muted hover:text-ink">
            <Maximize size={14} aria-hidden /> {t("zoomFit")}
          </button>
          <span className="w-12 text-right text-sm tabular-nums text-muted">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="min-w-48 flex-1">
          <NoteField note={d.note} onNote={(note) => act({ a: "note", id: d.id, note })} />
        </div>
      </div>
      {role === "therapist" && card.question && <p className="text-sm italic text-muted">{pick(card.question, locale)}</p>}
    </div>
  );
}

export function CardsTool({ tool, role, act, set }: { tool: Cards; role: Role; act: (a: ToolAction) => void; set: (s: ToolState) => void }) {
  const t = useTranslations("tools");
  const td = useTranslations("decks");
  const mine = useCallDecks();
  const [zoomed, setZoomed] = useState<number | null>(null);
  const [spreadRef, spread] = useBox<HTMLDivElement>();
  const [tableRef, table] = useBox<HTMLDivElement>();
  const drawnIds = new Set(tool.drawn.map((d) => d.id));
  const left = tool.order.filter((id) => !drawnIds.has(id));
  const canDraw = left.length > 0;
  const hasDrawn = tool.drawn.length > 0;
  // A drawn card went back to the deck while it was open large.
  const zoomIndex = zoomed !== null && zoomed < tool.drawn.length ? zoomed : null;

  /** Cards of a deck, as refs; the therapist's own decks also hand over their key. */
  function deckCards(id: string): { refs: string[]; key?: string } {
    if (isBuiltInDeck(id)) return { refs: deckRefs(id) };
    const own = mine.find((d) => `u/${d.id}` === id);
    return { refs: own?.refs ?? [], key: own?.key };
  }
  function chooseDeck(id: string) {
    const { refs, key } = deckCards(id);
    const keys = key ? { ...tool.keys, [id.slice(2)]: key } : tool.keys;
    // Drawn cards stay, so a picture and a word can be drawn together.
    set({ ...tool, deck: id, order: shuffle(refs), keys });
  }
  // The words stay in `memo`, so a card put back and drawn again keeps them.
  const putBack = (id: string) => set({ ...tool, drawn: tool.drawn.filter((d) => d.id !== id) });

  // Sizes: the face-down spread always fits its area; the table fits too while cards stay a readable size.
  const showing = tool.mode === "blind" ? left.slice(0, CARD_SPREAD) : left;
  const spreadFit = fitCards(showing.length, spread.w, spread.h, { gap: 8, max: tool.mode === "blind" ? 150 : 170 });
  const spreadWidth = Math.max(tool.mode === "blind" ? 34 : 64, spreadFit.width);
  const noteSpace = role === "therapist" ? 84 : 50;
  const tableFit = fitCards(tool.drawn.length, table.w, table.h, { gap: 16, extra: noteSpace, max: 260 });
  const tableWidth = Math.max(92, tableFit.width);

  return (
    <div className="relative flex h-full flex-col gap-3">
      {role === "therapist" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex min-h-10 items-center gap-2 rounded-control border border-line px-2">
            <span className="text-muted">{t("deck")}</span>
            <select value={tool.deck} onChange={(e) => chooseDeck(e.target.value)} className="min-h-9 max-w-[52vw] bg-transparent font-medium text-ink sm:max-w-none">
              <optgroup label={td("oursTitle")}>
                {DECKS.map((d) => <option key={d.id} value={d.id}>{td(`name_${d.id}`)} · {d.count}</option>)}
              </optgroup>
              {mine.length > 0 && (
                <optgroup label={td("mineTitle")}>
                  {mine.map((d) => <option key={d.id} value={`u/${d.id}`} disabled={!d.refs.length}>{d.name} · {d.refs.length}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          <div role="group" aria-label={t("kind_cards")} className="flex rounded-control border border-line p-0.5">
            {(["blind", "open"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={tool.mode === m} onClick={() => set({ ...tool, mode: m })}
                className={`min-h-9 rounded-inner px-3 ${tool.mode === m ? "bg-primary-soft font-medium text-ink" : "text-muted"}`}>
                {m === "blind" ? t("modeBlind") : t("modeOpen")}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => set({ ...tool, order: shuffle(deckCards(tool.deck).refs) })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 text-muted hover:text-ink">
            <Shuffle size={15} aria-hidden /> {t("reshuffle")}
          </button>
          {hasDrawn && (
            <button type="button" onClick={() => set({ ...tool, drawn: [] })}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 text-muted hover:text-ink">
              <Undo2 size={15} aria-hidden /> {t("clearTable")}
            </button>
          )}
          <details className="relative">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-control border border-line px-3 text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              <MessageCircleQuestion size={15} aria-hidden /> {t("prompts")}
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-[min(86vw,360px)] rounded-card border border-line bg-surface p-3 shadow-[var(--shadow)]">
              <ul className="list-disc space-y-1 pl-5 text-ink">
                {CARD_PROMPTS.map((p) => <li key={p}>{t(`prompt_${p}`)}</li>)}
              </ul>
              <p className="mt-3 text-muted">{t("combineTip")}</p>
              {isBuiltInDeck(tool.deck) && <p className="mt-2 text-xs text-muted">{td(`credit_${tool.deck}`)}</p>}
            </div>
          </details>
        </div>
      )}

      {canDraw && (
        // The spread takes the whole space until a card is drawn, then shares it with the table.
        <div ref={spreadRef} className={`min-h-0 transition-[flex-basis] duration-300 ease-out ${hasDrawn ? "shrink-0 basis-[34%]" : "flex-1"} ${tool.mode === "open" ? "overflow-auto" : "overflow-hidden"}`}>
          <ul className="mx-auto grid w-fit gap-2" style={{ gridTemplateColumns: `repeat(${spreadFit.cols}, ${spreadWidth}px)` }}>
            {showing.map((id, i) => (
              <li key={id}>
                {tool.mode === "blind" ? (
                  <button type="button" aria-label={t("faceDown", { n: i + 1 })} onClick={() => act({ a: "draw", id })}
                    className="block w-full rounded-inner transition-transform hover:-translate-y-1 focus-visible:-translate-y-1">
                    <CardBack className="aspect-[2/3] w-full" />
                  </button>
                ) : (
                  <button type="button" onClick={() => act({ a: "draw", id })}
                    className="block w-full overflow-hidden rounded-inner border-2 border-surface bg-surface-2 hover:border-primary">
                    <CardFace refId={id} keys={tool.keys} fit="cover" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!canDraw && <p className="text-center text-sm text-muted">{t("allDrawn")}</p>}

      {hasDrawn && (
        <section ref={tableRef} aria-label={t("drawn")} className="min-h-0 flex-1 overflow-auto border-t border-line pt-3">
          <div className="flex flex-wrap items-start justify-center gap-4">
            {tool.drawn.map((d, i) => (
              <DrawnCard key={d.id} id={d.id} note={d.note} width={tableWidth} keys={tool.keys} role={role}
                onNote={(note) => act({ a: "note", id: d.id, note })} onZoom={() => setZoomed(i)}
                onReturn={role === "therapist" ? () => putBack(d.id) : undefined} />
            ))}
          </div>
        </section>
      )}

      {zoomIndex !== null && <CardZoom tool={tool} index={zoomIndex} role={role} onIndex={setZoomed} onClose={() => setZoomed(null)} act={act} />}
    </div>
  );
}
