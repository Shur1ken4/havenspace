import "server-only";
import { headers } from "next/headers";
import type { Country } from "./professional";

const EU = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"];

/** The visitor's first browser language and region, e.g. ["ru", "RU"]. */
async function firstTag(): Promise<[string, string | undefined]> {
  const tag = ((await headers()).get("accept-language") ?? "").split(",")[0].trim();
  const [lang, region] = tag.split("-");
  return [lang.toLowerCase(), region?.toUpperCase()];
}

/** Russian for browsers set to Russian, English otherwise (until someone chooses). */
export async function browserLanguage(): Promise<"en" | "ru"> {
  const [lang] = await firstTag();
  return lang === "ru" ? "ru" : "en";
}

/** A first guess for the sign-up country; the person can change it. */
export async function browserCountry(): Promise<Country> {
  const [lang, region] = await firstTag();
  if (region === "IE" || region === "GB" || region === "UA" || region === "RU") return region;
  if (region && EU.includes(region)) return "EU";
  if (lang === "ru") return "RU";
  if (lang === "uk") return "UA";
  return lang === "en" ? "IE" : "other";
}
