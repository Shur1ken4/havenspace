import { describe, expect, it } from "vitest";
import { looksLikeFullName } from "@/lib/pseudonym";

describe("pseudonym check", () => {
  it.each(["John Murphy", "Mary Anne Kelly", "Олег Петров"])("flags %s as a likely full name", (v) => {
    expect(looksLikeFullName(v)).toBe(true);
  });
  it.each(["Client A", "J.M.", "JM-04", "Couple D", "Anna", "client 7", "Клиент А", "Клиент Анна"])("accepts %s", (v) => {
    expect(looksLikeFullName(v)).toBe(false);
  });
});
