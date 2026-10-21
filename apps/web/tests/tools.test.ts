import { describe, expect, it } from "vitest";
import { apply, newTool, parseMessage, type ToolState } from "../src/lib/tools/model";

// The rules both sides of a call follow for the shared therapy tools (ADR-21).
const deck = new Set(["01", "02", "03"]);
const tool = (kind: Parameters<typeof newTool>[0]) => newTool(kind, { deckIds: [...deck], question: "Q", low: "L", high: "H", areas: ["A", "B", "C"] });

describe("therapy tools", () => {
  it("scales take whole numbers from 0 to 10 only", () => {
    const s = tool("scale");
    expect((apply(s, { a: "scale", value: 7 }, "client", deck) as Extract<ToolState, { kind: "scale" }>).value).toBe(7);
    for (const v of [-1, 11, 3.5, Number.NaN]) expect(apply(s, { a: "scale", value: v }, "client", deck)).toBe(s);
  });

  it("the wheel of balance takes 1–10 for an existing area", () => {
    const b = tool("balance");
    const next = apply(b, { a: "balance", index: 1, value: 4 }, "client", deck) as Extract<ToolState, { kind: "balance" }>;
    expect(next.areas.map((a) => a.value)).toEqual([null, 4, null]);
    expect(apply(b, { a: "balance", index: 5, value: 4 }, "client", deck)).toBe(b);
    expect(apply(b, { a: "balance", index: 0, value: 0 }, "client", deck)).toBe(b);
  });

  it("emotions accept only words from the wheel", () => {
    const e = tool("emotions");
    const on = apply(e, { a: "emotion", word: "joy.grateful", on: true }, "client", deck) as Extract<ToolState, { kind: "emotions" }>;
    expect(on.picked).toEqual(["joy.grateful"]);
    expect(apply(e, { a: "emotion", word: "made.up", on: true }, "client", deck)).toBe(e);
    expect((apply(on, { a: "emotion", word: "joy.grateful", on: false }, "client", deck) as typeof on).picked).toEqual([]);
  });

  it("cards: only real cards, each once, no more than the therapist allows", () => {
    const c = tool("cards");
    const one = apply(c, { a: "draw", id: "02" }, "client", deck) as Extract<ToolState, { kind: "cards" }>;
    expect(one.drawn).toEqual([{ id: "02", note: "" }]);
    expect(apply(one, { a: "draw", id: "03" }, "client", deck)).toBe(one); // max is 1
    expect(apply({ ...one, max: 3 }, { a: "draw", id: "02" }, "client", deck)).toEqual({ ...one, max: 3 }); // not twice
    expect(apply(c, { a: "draw", id: "99" }, "client", deck)).toBe(c);
    expect((apply(one, { a: "note", id: "02", note: "home" }, "client", deck) as typeof one).drawn[0].note).toBe("home");
    expect(apply(one, { a: "note", id: "02", note: "x".repeat(201) }, "client", deck)).toBe(one);
  });

  it("the board takes well-formed strokes and undoes only your own", () => {
    const b = tool("board");
    const stroke = (id: string) => ({ id, by: "client" as const, color: "#2F3A35", size: 6, pts: [10, 10, 500, 500] });
    const one = apply(b, { a: "stroke", stroke: stroke("a") }, "client", deck) as Extract<ToolState, { kind: "board" }>;
    const two = apply(one, { a: "stroke", stroke: stroke("b") }, "therapist", deck) as typeof one;
    expect(two.strokes.map((s) => s.by)).toEqual(["client", "therapist"]);
    expect((apply(two, { a: "undo" }, "client", deck) as typeof one).strokes.map((s) => s.id)).toEqual(["b"]);
    for (const bad of [{ ...stroke("c"), color: "red" }, { ...stroke("d"), size: 50 }, { ...stroke("e"), pts: [1, 2, 3] }, { ...stroke("f"), pts: [0, 2000] }]) {
      expect(apply(b, { a: "stroke", stroke: bad }, "client", deck)).toBe(b);
    }
  });

  it("ignores messages that aren't ours", () => {
    expect(parseMessage("not json")).toBeNull();
    expect(parseMessage(JSON.stringify({ t: "state", seq: 1, tool: { kind: "unknown" } }))).toBeNull();
    expect(parseMessage(JSON.stringify({ t: "hello" }))).toEqual({ t: "hello" });
  });
});
