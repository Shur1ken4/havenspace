import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { withUser } from "./db";
import { isMfaPending } from "./mfa";
import { VIEW_COOKIE } from "./view";

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
  access_status: "pending" | "approved" | "declined";
  professional_body: string | null;
  registration_number: string | null;
  country: string | null;
  full_name: string | null;
  is_admin: boolean;
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

/** "client" = linked to a therapist through the client app (ADR-14);
 *  "former_client" = their therapist disconnected them; anyone else is a therapist. */
export type Role = "therapist" | "client" | "former_client";

export const loadRole = cache(async (userId: string): Promise<Role> => {
  const view = (await cookies()).get(VIEW_COOKIE)?.value;
  return withUser(userId, async (db) => {
    const { rows } = await db.query(
      "select revoked_at, therapist_id = user_id as test_link, is_admin() as admin from client_accounts where user_id = $1", [userId]);
    if (!rows[0]) return "therapist";
    // An admin linked to their own test client: whichever view they switched to (lib/view.ts).
    if (rows[0].test_link) return rows[0].admin && !rows[0].revoked_at && view === "client" ? "client" : "therapist";
    return rows[0].revoked_at ? "former_client" : "client";
  });
});

/** Client app pages: signed-in clients only; therapists go to their own app. */
export async function requireClient() {
  const session = await requireUser();
  const role = await loadRole(session.user.id);
  if (role === "therapist") redirect("/today");
  return { session, role };
}

/** Signed-in therapist with a profile row; sends unfinished profiles to
 *  onboarding, and accounts still waiting for approval to /pending. */
export async function requireTherapist(opts: { allowIncomplete?: boolean; allowPending?: boolean } = {}) {
  const session = await requireUser();
  if ((await loadRole(session.user.id)) !== "therapist") redirect("/me");
  const therapist = await loadTherapist(session.user.id, session.user.email);
  if (!opts.allowIncomplete && !therapist.onboarding_completed_at) redirect("/onboarding");
  if (!opts.allowPending && therapist.onboarding_completed_at && therapist.access_status !== "approved") redirect("/pending");
  return { session, therapist };
}

/** Admin pages: approved admins only (the database checks this again). */
export async function requireAdmin() {
  const ctx = await requireTherapist();
  if (!ctx.therapist.is_admin) redirect("/today");
  return ctx;
}

export const loadTherapist = cache(async (userId: string, email: string): Promise<Therapist> => {
  return withUser(userId, async (db) => {
    await db.query("insert into therapists (id) values ($1) on conflict (id) do nothing", [userId]);
    const { rows } = await db.query(
      `select id, display_name, profession, accreditation_stage, modalities, note_format, language,
              audio_retention, voice_enrolled_at, onboarding_completed_at,
              access_status, professional_body, registration_number, country, full_name, is_admin() as is_admin
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

/** Live research mode (ADR-10): an experiment for the named founders only, never with real client data. */
export function liveResearchAllowed(email: string) {
  if (realDataAllowed()) return false;
  const allowed = (process.env.LIVE_RESEARCH_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
