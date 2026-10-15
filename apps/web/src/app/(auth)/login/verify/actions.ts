"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { markVerified, verifySecondFactor } from "@/lib/mfa";

export type VerifyState = { error?: "invalid" | "locked" };

export async function verifyCode(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const result = await verifySecondFactor(session.user.id, String(form.get("code") ?? ""));
  if (result !== "ok") return { error: result };
  await markVerified(session.session.id);
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/today");
}
