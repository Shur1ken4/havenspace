import { describe, expect, it } from "vitest";
import { apply, fitCards, newTool, parseMessage, type ToolState } from "../src/lib/tools/model";
import { DECKS, cardView, customRef, deckRefs, isBuiltInRef } from "../src/lib/tools/decks";

// The rules both sides of a call follow for the shared therapy tools (ADR-21).
const deck = new Set(["01", "02", "03"]);
const tool = (kind: Parameters<typeof newTool>[0]) => newTool(kind, { deck: "pathways", deckIds: [...deck], question: "Q", low: "L", high: "H", areas: ["A", "B", "C"] });

describe("therapy tools", () => {
  it("scales take whole numbers from 0 to 10 only", () => {
    const s = tool("scale");
    expect((apply(s, { a: "scale", value: 7 }, "client") as Extract<ToolState, { kind: "scale" }>).value).toBe(7);
    for (const v of [-1, 11, 3.5, Number.NaN]) expect(apply(s, { a: "scale", value: v }, "client")).toBe(s);
  });

  it("the wheel of balance takes 1–10 for an existing area", () => {
    const b = tool("balance");
    const next = apply(b, { a: "balance", index: 1, value: 4 }, "client") as Extract<ToolState, { kind: "balance" }>;
    expect(next.areas.map((a) => a.value)).toEqual([null, 4, null]);
    expect(apply(b, { a: "balance", index: 5, value: 4 }, "client")).toBe(b);
    expect(apply(b, { a: "balance", index: 0, value: 0 }, "client")).toBe(b);
  });

  it("emotions accept only words from the wheel", () => {
    const e = tool("emotions");
    const on = apply(e, { a: "emotion", word: "joy.grateful", on: true }, "client") as Extract<ToolState, { kind: "emotions" }>;
    expect(on.picked).toEqual(["joy.grateful"]);
    expect(apply(e, { a: "emotion", word: "made.up", on: true }, "client")).toBe(e);
    expect((apply(on, { a: "emotion", word: "joy.grateful", on: false }, "client") as typeof on).picked).toEqual([]);
  });

  it("cards: only real cards, each once, as many as the client likes", () => {
    const c = tool("cards");
    const one = apply(c, { a: "draw", id: "02" }, "client") as Extract<ToolState, { kind: "cards" }>;
    expect(one.drawn).toEqual([{ id: "02", note: "" }]);
    expect(apply(one, { a: "draw", id: "02" }, "client")).toBe(one); // not twice
    const all = ["01", "03"].reduce((s, id) => apply(s, { a: "draw", id }, "client"), one as ToolState) as typeof one;
    expect(all.drawn.map((d) => d.id)).toEqual(["02", "01", "03"]); // no limit
    expect(apply(c, { a: "draw", id: "99" }, "client")).toBe(c);
    expect((apply(one, { a: "note", id: "02", note: "home" }, "client") as typeof one).drawn[0].note).toBe("home");
    expect(apply(one, { a: "note", id: "02", note: "x".repeat(201) }, "client")).toBe(one);
    expect(apply(one, { a: "note", id: "03", note: "not drawn" }, "client")).toBe(one);
  });

  it("cards: a card's words stay for the call, even after it goes back to the deck", () => {
    const one = apply(tool("cards"), { a: "draw", id: "02" }, "client") as Extract<ToolState, { kind: "cards" }>;
    const noted = apply(one, { a: "note", id: "02", note: "home" }, "therapist") as typeof one;
    const back = { ...noted, drawn: [] }; // the therapist clears the table
    expect((apply(back, { a: "draw", id: "02" }, "client") as typeof one).drawn).toEqual([{ id: "02", note: "home" }]);
  });

  it("cards are sized so the whole spread fits without scrolling", () => {
    const fit = fitCards(10, 900, 400, { gap: 8 });
    const rows = Math.ceil(10 / fit.cols);
    expect(fit.cols * fit.width + (fit.cols - 1) * 8).toBeLessThanOrEqual(900);
    expect(rows * fit.width * 1.5 + (rows - 1) * 8).toBeLessThanOrEqual(400);
    expect(fit.width).toBeGreaterThan(60);
    expect(fitCards(1, 2000, 2000, { max: 220 }).width).toBe(220);
  });

  it("decks: built-in and own cards resolve; unknown refs don't", () => {
    expect(cardView("pathways/01")).toMatchObject({ kind: "image", src: "/cards/pathways/01.jpg" });
    expect(cardView("words/60")).toMatchObject({ kind: "word", word: { en: "Me", ru: "Я" } });
    expect(cardView("resources/01")?.kind).toBe("word");
    expect(cardView("01")).toMatchObject({ src: "/cards/art/01.jpg" }); // saved before there were several decks
    expect(cardView("pathways/99")).toBeNull();
    expect(cardView("nope/01")).toBeNull();
    const own = customRef("11111111-2222-3333-4444-555555555555", "66666666-7777-8888-9999-000000000000");
    expect(cardView(own, { "11111111-2222-3333-4444-555555555555": "k" })).toMatchObject({ src: expect.stringContaining("?k=k") });
    expect(isBuiltInRef(own)).toBe(false);
    for (const d of DECKS) expect(deckRefs(d.id).every((r) => cardView(r) !== null)).toBe(true);
    expect(DECKS.map((d) => d.count)).toEqual([48, 24, 24, 56, 48, 40, 60, 36]);
    expect(deckRefs("work", 2)).toEqual(["work/07", "work/08", "work/09", "work/10", "work/11", "work/12"]);
    expect(cardView("family/24")).toMatchObject({ src: "/cards/pathways-family/24.jpg", block: 4 });
  });

  it("the board takes well-formed strokes and undoes only your own", () => {
    const b = tool("board");
    const stroke = (id: string) => ({ id, by: "client" as const, color: "#2F3A35", size: 6, pts: [10, 10, 500, 500] });
    const one = apply(b, { a: "stroke", stroke: stroke("a") }, "client") as Extract<ToolState, { kind: "board" }>;
    const two = apply(one, { a: "stroke", stroke: stroke("b") }, "therapist") as typeof one;
    expect(two.strokes.map((s) => s.by)).toEqual(["client", "therapist"]);
    expect((apply(two, { a: "undo" }, "client") as typeof one).strokes.map((s) => s.id)).toEqual(["b"]);
    for (const bad of [{ ...stroke("c"), color: "red" }, { ...stroke("d"), size: 50 }, { ...stroke("e"), pts: [1, 2, 3] }, { ...stroke("f"), pts: [0, 2000] }]) {
      expect(apply(b, { a: "stroke", stroke: bad }, "client")).toBe(b);
    }
  });

  it("ignores messages that aren't ours", () => {
    expect(parseMessage("not json")).toBeNull();
    expect(parseMessage(JSON.stringify({ t: "state", seq: 1, tool: { kind: "unknown" } }))).toBeNull();
    expect(parseMessage(JSON.stringify({ t: "hello" }))).toEqual({ t: "hello" });
  });
});
