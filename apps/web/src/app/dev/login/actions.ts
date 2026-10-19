"use server";
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { devLoginEnabled } from "@/lib/dev-login";
import { devMailbox } from "@/lib/email";

// One-click sign-in for local testing. It goes through the real sign-in path
// (a code is "emailed" to the dev mailbox, then used), it just skips the typing.
export async function devSignIn(form: FormData) {
  if (!devLoginEnabled()) notFound();
  const raw = String(form.get("email") ?? "").trim().toLowerCase();
  const email = z.email().parse(raw === "new" ? `new-${randomBytes(3).toString("hex")}@psych.test` : raw);
  await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
  const otp = devMailbox.find((m) => m.to === email)?.text.match(/\b(\d{6})\b/)?.[1];
  if (!otp) throw new Error("no code in the dev mailbox");
  await auth.api.signInEmailOTP({ body: { email, otp }, headers: await headers() });
  redirect("/today");
}
