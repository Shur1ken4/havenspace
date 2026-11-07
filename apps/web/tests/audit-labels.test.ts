import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every action written to the audit log needs a plain-language label on Settings → Privacy,
// in every language; otherwise the therapist sees a code such as "messages.view".
const SRC = path.join(__dirname, "..", "src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? files(path.join(dir, f)) : [path.join(dir, f)]));
const actions = new Set(
  files(SRC).filter((f) => /\.tsx?$/.test(f))
    .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/audit\([^)]*?"([a-z_]+\.[a-z_]+)"/g)].map((m) => m[1])),
);

describe("activity labels", () => {
  it("finds the audit actions", () => expect(actions.size).toBeGreaterThan(20));
  for (const lang of ["en", "ru"]) {
    it(`has a label for every action in ${lang}`, () => {
      const labels = JSON.parse(readFileSync(path.join(__dirname, "..", "messages", `${lang}.json`), "utf8")).audit;
      expect([...actions].filter((a) => !labels[a.replace(".", "__")])).toEqual([]);
    });
  }
});
