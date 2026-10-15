"use server";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { pool } from "@/lib/db";

const schema = z.object({
  interest: z.enum(["demo", "waitlist"]),
  name: z.string().trim().max(80),
  email: z.email().max(200),
  profession: z.enum(["counsellor", "psychotherapist", "psychologist", "student", "supervisor", "other"]),
  practiceSize: z.enum(["solo", "small_team", "organisation", "student"]).optional(),
  consent: z.literal("on"),
  website: z.string().max(0).optional(), // honeypot: real people leave this empty
});

export type SignupValues = { name: string; email: string; profession: string; practiceSize: string; interest: string };
export type SignupState = { status: "idle" | "ok" | "invalid" | "error"; interest?: "demo" | "waitlist"; values?: SignupValues };

export async function joinList(_prev: SignupState, form: FormData): Promise<SignupState> {
  const values: SignupValues = {
    name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), profession: String(form.get("profession") ?? ""),
    practiceSize: String(form.get("practiceSize") ?? ""), interest: String(form.get("interest") ?? "demo"),
  };
  const parsed = schema.safeParse({
    interest: form.get("interest"),
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    profession: form.get("profession"),
    practiceSize: form.get("practiceSize") || undefined,
    consent: form.get("consent"),
    website: String(form.get("website") ?? ""),
  });
  if (!parsed.success) return { status: "invalid", values };
  const d = parsed.data;
  try {
    await pool.query(
      "insert into pilot_signups (email, profession, interest, name, practice_size, language) values ($1, $2, $3, $4, $5, $6)",
      [d.email, d.profession, d.interest, d.name, d.practiceSize ?? null, await getLocale()],
    );
    return { status: "ok", interest: d.interest };
  } catch (err) {
    // Already on the list: that's fine (the app can't read the list, by design).
    if ((err as { code?: string }).code === "23505") return { status: "ok", interest: d.interest };
    return { status: "error", values };
  }
}

// Quiet language choice in the landing-page footer. Signed-in therapists keep their Settings language.
export async function setPublicLocale(form: FormData) {
  const lang = form.get("lang") === "ru" ? "ru" : "en";
  (await cookies()).set("locale", lang, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
}
