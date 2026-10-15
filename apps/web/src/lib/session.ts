import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { withUser } from "./db";
import { isMfaPending } from "./mfa";

export type Therapist = {
  id: string;
  email: string;
  display_name: string;
  profession: string | null;
  accreditation_stage: string | null;
  modalities: string[];
  note_format: "SOAP" | "DAP" | "BIRP" | "FREE";
  language: "en" | "ru";
  audio_retention: "delete_after_transcription" | "keep_7_days";
  voice_enrolled_at: string | null;
  onboarding_completed_at: string | null;
};

// One lookup per request, however many components ask.
const rawSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** The signed-in user, or null — also null while two-step verification is pending. */
export async function getSession() {
  const session = await rawSession();
  if (!session || (await isMfaPending(session))) return null;
  return session;
}

/** Like getSession, but sends people to sign in (or to the code step) instead of returning null. */
export async function requireUser() {
  const session = await rawSession();
  if (!session) redirect("/login");
  if (await isMfaPending(session)) redirect("/login/verify");
  return session;
}

/** Signed-in therapist with a profile row; sends unfinished profiles to onboarding. */
export async function requireTherapist(opts: { allowIncomplete?: boolean } = {}) {
  const session = await requireUser();
  const therapist = await loadTherapist(session.user.id, session.user.email);
  if (!opts.allowIncomplete && !therapist.onboarding_completed_at) redirect("/onboarding");
  return { session, therapist };
}

export const loadTherapist = cache(async (userId: string, email: string): Promise<Therapist> => {
  return withUser(userId, async (db) => {
    await db.query("insert into therapists (id) values ($1) on conflict (id) do nothing", [userId]);
    const { rows } = await db.query(
      `select id, display_name, profession, accreditation_stage, modalities, note_format, language,
              audio_retention, voice_enrolled_at, onboarding_completed_at
         from therapists where id = $1`,
      [userId],
    );
    return { ...rows[0], email } as Therapist;
  });
});

/** True when the user signed in recently enough for exports and deletions. */
export function isFresh(session: { session: { createdAt: Date | string } }, maxAgeMinutes = 15) {
  return Date.now() - new Date(session.session.createdAt).getTime() < maxAgeMinutes * 60_000;
}

export const realDataAllowed = () => process.env.ALLOW_REAL_CLIENT_DATA === "true";
