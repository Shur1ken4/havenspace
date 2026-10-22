// Therapy tools shared live in a video session (ADR-21). The therapist's screen holds
// the true state and sends it to the client; the client sends its actions back. Both
// sides run the same rules (apply), so what one person does shows up for the other.
// No AI reads or interprets anything here: these are the therapist's tools.

export type ToolKind = "scale" | "balance" | "emotions" | "cards" | "board";
export const TOOL_KINDS: ToolKind[] = ["scale", "balance", "emotions", "cards", "board"];

export type Stroke = {
  id: string;
  by: "therapist" | "client";
  color: string;
  size: number;
  /** x,y pairs on a 0–1000 board (scaled to any screen). */
  pts: number[];
};

export type ToolState =
  | { kind: "scale"; question: string; low: string; high: string; value: number | null }
  | { kind: "balance"; areas: { label: string; value: number | null }[] }
  | { kind: "emotions"; picked: string[] }
  | {
      kind: "cards"; mode: "blind" | "open"; max: number;
      /** The deck cards are drawn from now ("pathways", or "u/<uuid>" for the therapist's own). */
      deck: string;
      /** That deck's cards, shuffled (refs, see decks.ts). Drawn cards stay when the deck changes. */
      order: string[];
      drawn: { id: string; note: string }[];
      /** Short-lived keys that let the other person see the therapist's own deck images. */
      keys?: Record<string, string>;
    }
  | { kind: "board"; strokes: Stroke[] };

export type ToolAction =
  | { a: "scale"; value: number }
  | { a: "balance"; index: number; value: number }
  | { a: "emotion"; word: string; on: boolean }
  | { a: "draw"; id: string }
  | { a: "note"; id: string; note: string }
  | { a: "stroke"; stroke: Stroke }
  | { a: "undo" };

/** Messages on the call's data channel (topic TOOLS_TOPIC). */
export type ToolMessage =
  | { t: "state"; seq: number; tool: ToolState | null }
  | { t: "hello" }
  | { t: "act"; act: ToolAction }
  | { t: "saved" };

export const TOOLS_TOPIC = "hs-tools";

// ── Content (CLINICAL-REVIEW: docs/clinical-review.md item 19) ─────────────
// Wording lives in the messages files (tools.*); these are the ids.

/** Ready-made scale questions (0–10). Common, non-diagnostic scaling questions. */
export const SCALE_PRESETS = ["distress", "anxiety", "mood", "importance", "confidence", "readiness", "goal"] as const;

/** Wheel of balance: eight life areas, renamable by the therapist. */
export const BALANCE_AREAS = ["health", "work", "money", "family", "love", "friends", "rest", "growth"] as const;

/** Emotion wheel: families and their words (our own wording). */
export const EMOTION_FAMILIES = [
  { id: "joy", color: "#E3C16F", words: ["content", "proud", "grateful", "hopeful", "relieved", "excited"] },
  { id: "calm", color: "#8FB09D", words: ["peaceful", "safe", "accepting", "relaxed", "trusting", "tender"] },
  { id: "surprise", color: "#7FB7B0", words: ["amazed", "curious", "bewildered", "shocked", "awed"] },
  { id: "fear", color: "#A99BC4", words: ["anxious", "worried", "confused", "insecure", "panicky", "vulnerable"] },
  { id: "sad", color: "#8FA9B8", words: ["lonely", "disappointed", "longing", "guilty", "empty", "helpless"] },
  { id: "shame", color: "#C9A38A", words: ["embarrassed", "awkward", "humiliated", "worthless", "disgusted", "averse"] },
  { id: "anger", color: "#D08E6A", words: ["irritated", "resentful", "envious", "indignant", "frustrated", "furious"] },
] as const;
export const EMOTION_WORDS = new Set<string>(EMOTION_FAMILIES.flatMap((f) => f.words.map((w) => `${f.id}.${w}`)));

/** Questions the therapist may ask about a card (shown only to the therapist). */
export const CARD_PROMPTS = ["see", "first", "feel", "where", "before", "name", "link"] as const;
/** How many cards the client may draw at once. */
export const CARD_COUNTS = [1, 2, 3, 5, 7] as const;

export const BOARD_COLORS = ["#2F3A35", "#4A6D5B", "#527486", "#7A5C9E", "#A3573F", "#C98A5B"] as const;
export const BOARD_SIZES = [3, 6, 12] as const;

const MAX_STROKES = 1500;
const MAX_POINTS = 3000;

// ── Rules both sides follow ────────────────────────────────────────────────

/** Applies one action. Returns the same object when the action doesn't fit (ignored). */
export function apply(state: ToolState, act: ToolAction, by: "therapist" | "client"): ToolState {
  const int = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
  switch (act.a) {
    case "scale":
      return state.kind === "scale" && int(act.value, 0, 10) ? { ...state, value: act.value } : state;
    case "balance":
      if (state.kind !== "balance" || !int(act.index, 0, state.areas.length - 1) || !int(act.value, 1, 10)) return state;
      return { ...state, areas: state.areas.map((a, i) => (i === act.index ? { ...a, value: act.value } : a)) };
    case "emotion":
      if (state.kind !== "emotions" || !EMOTION_WORDS.has(act.word)) return state;
      return { ...state, picked: act.on ? [...new Set([...state.picked, act.word])] : state.picked.filter((w) => w !== act.word) };
    case "draw":
      if (state.kind !== "cards" || !state.order.includes(act.id) || state.drawn.length >= state.max || state.drawn.some((d) => d.id === act.id)) return state;
      return { ...state, drawn: [...state.drawn, { id: act.id, note: "" }] };
    case "note":
      if (state.kind !== "cards" || typeof act.note !== "string" || act.note.length > 200) return state;
      return { ...state, drawn: state.drawn.map((d) => (d.id === act.id ? { ...d, note: act.note } : d)) };
    case "stroke": {
      const s = act.stroke;
      if (state.kind !== "board" || state.strokes.length >= MAX_STROKES || !s || typeof s.id !== "string" || s.id.length > 40) return state;
      if (!(BOARD_COLORS as readonly string[]).includes(s.color) || !(BOARD_SIZES as readonly number[]).includes(s.size)) return state;
      if (!Array.isArray(s.pts) || s.pts.length < 2 || s.pts.length > MAX_POINTS || s.pts.length % 2 || !s.pts.every((p) => int(p, 0, 1000))) return state;
      if (state.strokes.some((x) => x.id === s.id)) return state;
      return { ...state, strokes: [...state.strokes, { ...s, by }] };
    }
    case "undo": {
      if (state.kind !== "board") return state;
      const last = state.strokes.map((s) => s.by).lastIndexOf(by);
      return last < 0 ? state : { ...state, strokes: state.strokes.filter((_, i) => i !== last) };
    }
    default:
      return state;
  }
}

/** A fresh tool, as the therapist opens it. Labels come in the therapist's language. */
export function newTool(kind: ToolKind, opts: { deck: string; deckIds: string[]; question?: string; low?: string; high?: string; areas?: string[] }): ToolState {
  switch (kind) {
    case "scale":
      return { kind, question: opts.question ?? "", low: opts.low ?? "", high: opts.high ?? "", value: null };
    case "balance":
      return { kind, areas: (opts.areas ?? []).map((label) => ({ label, value: null })) };
    case "emotions":
      return { kind, picked: [] };
    case "cards":
      return { kind, mode: "blind", max: 1, deck: opts.deck, order: shuffle(opts.deckIds), drawn: [] };
    case "board":
      return { kind, strokes: [] };
  }
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A message received from the other side, checked for shape before use. */
export function parseMessage(text: string): ToolMessage | null {
  try {
    const m = JSON.parse(text);
    if (!m || typeof m !== "object") return null;
    if (m.t === "state" && typeof m.seq === "number" && (m.tool === null || (typeof m.tool === "object" && TOOL_KINDS.includes(m.tool.kind)))) return m;
    if (m.t === "act" && m.act && typeof m.act.a === "string") return m;
    if (m.t === "hello" || m.t === "saved") return m;
    return null;
  } catch {
    return null;
  }
}
