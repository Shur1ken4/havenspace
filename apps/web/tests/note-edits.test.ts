import { describe, expect, it } from "vitest";
import { editShare } from "@/lib/note-edits";

const note = (...texts: string[]) => ({ sections: texts.map((text, i) => ({ key: `s${i}`, text })) });

describe("note edit share", () => {
  it("is 0 when the draft is approved as written", () => {
    expect(editShare(note("Client A reported poor sleep.", "Plan: review."), note("Client A reported poor sleep.", "Plan: review."))).toBe(0);
  });
  it("is 1 when every word is replaced", () => {
    expect(editShare(note("one two three"), note("four five six"))).toBe(1);
  });
  it("grows with the amount changed", () => {
    const draft = note("Client A said the week was up and down and sleep was poor");
    const small = editShare(draft, note("Client A said the week was up and down and sleep was bad"))!;
    const big = editShare(draft, note("Client A described a difficult week with broken sleep"))!;
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(small);
  });
  it("is unknown for notes drafted before it was measured", () => {
    expect(editShare(null, note("text"))).toBeNull();
  });
});
