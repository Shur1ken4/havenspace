"use client";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Shuffle } from "lucide-react";
import { DECKS, cardView, deckRefs, isBuiltInDeck, pick } from "@/lib/tools/decks";
import { CARD_COUNTS, CARD_PROMPTS, shuffle, type ToolAction, type ToolState } from "@/lib/tools/model";
import { LogoMark } from "@/components/illustrations";
import { CardFace } from "@/components/cards/card-face";
import { useCallDecks } from "./decks-context";
import type { Role } from "./use-tools";

type Cards = Extract<ToolState, { kind: "cards" }>;

/** The back of a card: the same for every card, so a face-down choice is truly blind. */
function CardBack({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center justify-center rounded-inner border-4 border-surface bg-primary-strong shadow-[var(--shadow)] ${className}`}
      style={{
        backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,255,255,.18), transparent 55%), repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 6px, transparent 6px 12px)",
        ["--brand" as string]: "rgba(255,255,255,.85)",
      }}>
      <LogoMark className="h-1/3 w-1/3" />
    </span>
  );
}

/** One drawn card with its note. The note is typed locally and shared after a pause. */
function DrawnCard({ id, note, onNote, index, keys, role }: {
  id: string; note: string; index: number; keys?: Record<string, string>; role: Role; onNote: (note: string) => void;
}) {
  const t = useTranslations("tools");
  const locale = useLocale();
  const card = cardView(id, keys);
  // While this person types, their own text shows; otherwise the shared note (which the other person may change).
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!card) return null;
  return (
    <figure className="flip-in flex w-[min(100%,240px)] flex-col gap-2" style={{ animationDelay: `${index * 80}ms` }}>
      <CardFace refId={id} keys={keys} className="max-h-[38vh] w-full border-4 border-surface shadow-[var(--shadow)]" />
      {/* The card's own question, for the therapist only (Pathways and Inner resources). */}
      {role === "therapist" && card.question && <figcaption className="text-sm italic text-muted">{pick(card.question, locale)}</figcaption>}
      <input value={draft ?? note} maxLength={200} placeholder={t("notePlaceholder")} aria-label={t("notePlaceholder")}
        onFocus={() => setDraft(note)} onBlur={() => { if (draft !== null) onNote(draft); setDraft(null); }}
        onChange={(e) => {
          setDraft(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          const v = e.target.value;
          timer.current = setTimeout(() => onNote(v), 400);
        }}
        className="min-h-10 rounded-control border border-line bg-surface px-3 text-sm text-ink" />
    </figure>
  );
}

export function CardsTool({ tool, role, act, set }: { tool: Cards; role: Role; act: (a: ToolAction) => void; set: (s: ToolState) => void }) {
  const t = useTranslations("tools");
  const td = useTranslations("decks");
  const mine = useCallDecks();
  const drawn = new Set(tool.drawn.map((d) => d.id));
  const left = tool.order.filter((id) => !drawn.has(id));
  const canDraw = tool.drawn.length < tool.max;

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

  return (
    <div className="flex h-full flex-col gap-5">
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
          <div role="group" aria-label={t("howMany")} className="flex items-center gap-0.5 rounded-control border border-line p-0.5">
            <span className="px-2 text-muted">{t("howMany")}</span>
            {CARD_COUNTS.map((n) => (
              <button key={n} type="button" aria-pressed={tool.max === n} onClick={() => set({ ...tool, max: Math.max(n, tool.drawn.length) })}
                className={`min-h-9 min-w-8 rounded-inner ${tool.max === n ? "bg-primary-soft font-medium text-ink" : "text-muted"}`}>{n}</button>
            ))}
          </div>
          <button type="button" onClick={() => set({ ...tool, order: shuffle(deckCards(tool.deck).refs), drawn: [] })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 text-muted hover:text-ink">
            <Shuffle size={15} aria-hidden /> {t("reshuffle")}
          </button>
        </div>
      )}

      {tool.drawn.length > 0 && (
        <section aria-label={t("drawn")} className="flex flex-wrap justify-center gap-5">
          {tool.drawn.map((d, i) => (
            <DrawnCard key={d.id} id={d.id} note={d.note} index={i} keys={tool.keys} role={role} onNote={(note) => act({ a: "note", id: d.id, note })} />
          ))}
        </section>
      )}

      {canDraw && (tool.mode === "blind" ? (
        <ul className="mx-auto grid w-full max-w-3xl grid-cols-5 gap-2 sm:gap-3">
          {left.slice(0, 10).map((id, i) => (
            <li key={id}>
              <button type="button" aria-label={t("faceDown", { n: i + 1 })} onClick={() => act({ a: "draw", id })}
                className="block w-full rounded-inner transition-transform hover:-translate-y-1 focus-visible:-translate-y-1">
                <CardBack className="aspect-[2/3] w-full" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {left.map((id) => (
            <li key={id}>
              <button type="button" onClick={() => act({ a: "draw", id })}
                className="block w-full overflow-hidden rounded-inner border-2 border-surface bg-surface-2 hover:border-primary">
                <CardFace refId={id} keys={tool.keys} fit="cover" />
              </button>
            </li>
          ))}
        </ul>
      ))}
      {!canDraw && tool.drawn.length > 0 && role === "therapist" && tool.max < CARD_COUNTS.at(-1)! && <p className="text-center text-sm text-muted">{t("allDrawn")}</p>}

      {role === "therapist" && (
        <details className="mt-auto rounded-card border border-line bg-surface-2 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-ink">{t("prompts")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink">
            {CARD_PROMPTS.map((p) => <li key={p}>{t(`prompt_${p}`)}</li>)}
          </ul>
          <p className="mt-3 text-muted">{t("combineTip")}</p>
          {isBuiltInDeck(tool.deck) && <p className="mt-2 text-xs text-muted">{td(`credit_${tool.deck}`)}</p>}
        </details>
      )}
    </div>
  );
}
