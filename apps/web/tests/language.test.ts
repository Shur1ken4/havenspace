import { describe, expect, it } from "vitest";
import { pickLanguage } from "../src/lib/language";

// The app opens in the device's language until the person chooses one.
describe("device language", () => {
  it("takes the first language we have, in the device's order", () => {
    expect(pickLanguage("ru-RU,ru;q=0.9,en-US;q=0.8")).toBe("ru");
    expect(pickLanguage("en-IE,en;q=0.9,ru;q=0.8")).toBe("en");
    expect(pickLanguage("uk-UA,uk;q=0.9,ru;q=0.8,en;q=0.7")).toBe("ru");
    expect(pickLanguage("de-DE,de;q=0.9,en;q=0.8,ru;q=0.7")).toBe("en");
    expect(pickLanguage("en;q=0.5,ru;q=0.9")).toBe("ru");
  });
  it("falls back to English", () => {
    expect(pickLanguage(null)).toBe("en");
    expect(pickLanguage("")).toBe("en");
    expect(pickLanguage("fr-FR,fr;q=0.9")).toBe("en");
  });
});
