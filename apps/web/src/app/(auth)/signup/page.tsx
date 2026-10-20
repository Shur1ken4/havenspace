import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { devLoginEnabled } from "@/lib/dev-login";
import { SignupWizard } from "./signup-wizard";

export async function generateMetadata() {
  const t = await getTranslations("register");
  return { title: t("title") };
}

/** Creating an account (ADR-18): therapist or client, password, email code, photo. */
export default async function SignupPage() {
  if (await getSession().catch(() => null)) redirect("/today");
  return <SignupWizard devMailbox={devLoginEnabled()} />;
}
