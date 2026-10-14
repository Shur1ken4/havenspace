"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { requireUser } from "@/lib/session";

const schema = z.object({
  displayName: z.string().trim().max(80),
  profession: z.enum(["counsellor", "psychotherapist", "psychologist", "other"]),
  accreditationStage: z.enum(["student", "pre_accredited", "accredited", "supervisor"]),
  modalities: z.array(z.enum(["cbt", "mi", "dbt", "person_centred", "solution_focused", "integrative", "psychodynamic", "systemic"])).min(1).max(8),
  noteFormat: z.enum(["SOAP", "DAP", "BIRP", "FREE"]),
  language: z.enum(["en", "ru"]),
});
export type OnboardingInput = z.infer<typeof schema>;

export async function completeOnboarding(input: OnboardingInput): Promise<{ ok: boolean }> {
  const session = await requireUser();
  const data = schema.safeParse(input);
  if (!data.success) return { ok: false };
  const d = data.data;
  await withUser(session.user.id, (db) =>
    db.query(
      `update therapists set display_name = $2, profession = $3, accreditation_stage = $4, modalities = $5,
              note_format = $6, language = $7, onboarding_completed_at = coalesce(onboarding_completed_at, now())
        where id = $1`,
      [session.user.id, d.displayName, d.profession, d.accreditationStage, d.modalities, d.noteFormat, d.language],
    ),
  );
  (await cookies()).set("locale", d.language, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return { ok: true };
}
