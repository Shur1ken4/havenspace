"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pool, withUser } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { hashInviteCode, normaliseInviteCode } from "@/lib/invites";

export type JoinError = "invalid" | "too_many" | "therapist_account" | "already_linked" | "generic";

/** Counts a code attempt for this visitor; false when they've tried too often. */
export async function allowJoinAttempt(): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? "local").split(",")[0].trim().slice(0, 64);
  const { rows } = await pool.query("select note_join_attempt($1) as ok", [ip]);
  return Boolean(rows[0].ok);
}

/** Looks up an invite before sign-in: the inviting therapist's name, or null. */
export async function previewInvite(code: string): Promise<string | null> {
  const normal = normaliseInviteCode(code);
  if (!normal) return null;
  const { rows } = await pool.query("select client_invite_preview($1) as name", [hashInviteCode(normal)]);
  return rows[0].name ?? null;
}

/** After sign-in: links this account to the invited client, then opens the client app. */
export async function joinWithCode(code: string): Promise<{ error: JoinError }> {
  const session = await requireUser();
  const normal = normaliseInviteCode(code);
  if (!normal) return { error: "invalid" };
  if (!(await allowJoinAttempt())) return { error: "too_many" };
  try {
    await withUser(session.user.id, (db) => db.query("select redeem_client_invite($1)", [hashInviteCode(normal)]));
  } catch (err) {
    const m = (err as { message?: string }).message;
    if (m === "invite_invalid") return { error: "invalid" };
    if (m === "therapist_account") return { error: "therapist_account" };
    if (m === "already_linked") return { error: "already_linked" };
    return { error: "generic" };
  }
  redirect("/me?welcome=1");
}

/** The "I have a code" form on /join. */
export async function goToCode(form: FormData) {
  const normal = normaliseInviteCode(String(form.get("code") ?? ""));
  redirect(normal ? `/join/${normal}` : "/join?invalid=1");
}
