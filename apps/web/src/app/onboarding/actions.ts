"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { MODALITIES } from "@/lib/modality-list";
import { withUser } from "@/lib/db";
import { loadRole, requireUser } from "@/lib/session";
import { notifyAdminsOfRequest } from "@/lib/access";
import { COUNTRIES, PROFESSIONAL_BODIES } from "@/lib/professional";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  displayName: z.string().trim().max(80),
  profession: z.enum(["counsellor", "psychotherapist", "psychologist", "other"]),
  accreditationStage: z.enum(["student", "pre_accredited", "accredited", "supervisor"]),
  professionalBody: z.enum(PROFESSIONAL_BODIES),
  professionalBodyOther: z.string().trim().max(120),
  registrationNumber: z.string().trim().max(60),
  country: z.enum(COUNTRIES),
  modalities: z.array(z.enum(MODALITIES)).min(1).max(MODALITIES.length),
  noteFormat: z.enum(["SOAP", "DAP", "BIRP", "FREE"]),
  language: z.enum(["en", "ru"]),
});
export type OnboardingInput = z.infer<typeof schema>;

export async function completeOnboarding(input: OnboardingInput): Promise<{ ok: boolean; status?: string }> {
  const session = await requireUser();
  if ((await loadRole(session.user.id)) !== "therapist") return { ok: false };
  const data = schema.safeParse(input);
  if (!data.success) return { ok: false };
  const d = data.data;
  const student = d.accreditationStage === "student" || d.professionalBody === "none_student";
  if (!student && d.registrationNumber.length < 2) return { ok: false };
  if (d.professionalBody === "other" && d.professionalBodyOther.length < 2) return { ok: false };
  // "What should we call you" defaults to the first name.
  if (!d.displayName) d.displayName = d.fullName.split(/\s+/)[0];
  const status = await withUser(session.user.id, async (db) => {
    const { rows: [before] } = await db.query("select onboarding_completed_at from therapists where id = $1", [session.user.id]);
    await db.query(
      `update therapists set display_name = $2, profession = $3, accreditation_stage = $4, modalities = $5,
              note_format = $6, language = $7, professional_body = $8, registration_number = nullif($9, ''), country = $10, full_name = $11,
              professional_body_other = case when $8 = 'other' then nullif($12, '') end,
              onboarding_completed_at = coalesce(onboarding_completed_at, now())
        where id = $1`,
      [session.user.id, d.displayName, d.profession, d.accreditationStage, d.modalities, d.noteFormat, d.language,
       d.professionalBody, d.registrationNumber, d.country, d.fullName, d.professionalBodyOther],
    );
    const { rows: [r] } = await db.query("select request_access() as status");
    return { status: r.status as string, isNew: !before?.onboarding_completed_at };
  });
  if (status.status === "pending" && status.isNew) await notifyAdminsOfRequest().catch(() => {});
  (await cookies()).set("locale", d.language, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return { ok: true, status: status.status };
}
