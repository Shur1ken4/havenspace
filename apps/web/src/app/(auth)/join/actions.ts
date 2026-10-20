"use server";
import { redirect } from "next/navigation";
import { withUser } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { allowJoinAttempt, hashInviteCode, normaliseInviteCode } from "@/lib/invites";

export type JoinError = "invalid" | "too_many" | "therapist_account" | "already_linked" | "generic";

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
