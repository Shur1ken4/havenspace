import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { cache } from "react";

export const locales = ["en", "ru"] as const;
export type Locale = (typeof locales)[number];

export function toLocale(value: string | undefined | null): Locale {
  return (locales as readonly string[]).includes(value ?? "") ? (value as Locale) : "en";
}

// Signed-in therapists see the language saved in Settings (on any device).
// Public pages follow the "locale" cookie, which Settings also sets.
const therapistLanguage = cache(async (): Promise<string | null> => {
  const h = await headers();
  if (!h.get("cookie")?.includes("better-auth")) return null;
  const { auth } = await import("@/lib/auth");
  const { withUser } = await import("@/lib/db");
  const session = await auth.api.getSession({ headers: h }).catch(() => null);
  if (!session) return null;
  return withUser(session.user.id, async (db) =>
    (await db.query("select language from therapists where id = $1", [session.user.id])).rows[0]?.language ?? null,
  ).catch(() => null);
});

export default getRequestConfig(async ({ locale: requested }) => {
  // An explicit locale (e.g. an email in the recipient's language) wins.
  const locale = requested ? toLocale(requested.slice(0, 2))
    : toLocale((await therapistLanguage()) ?? (await cookies()).get("locale")?.value);
  const en = (await import("../../messages/en.json")).default;
  const own = locale === "en" ? en : (await import(`../../messages/${locale}.json`)).default;
  // English uses Irish conventions for dates and times (15 Oct 2026, 14:30).
  return { locale: locale === "en" ? "en-IE" : locale, messages: deepMerge(en, own), timeZone: "Europe/Dublin" };
});

// Falls back to English for any string not yet translated.
function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && typeof base[k] === "object"
      ? deepMerge(base[k] as Record<string, unknown>, v as Record<string, unknown>)
      : v;
  }
  return out;
}
