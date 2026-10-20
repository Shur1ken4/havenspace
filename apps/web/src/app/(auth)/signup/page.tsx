import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { devLoginEnabled } from "@/lib/dev-login";
import { LoginForm } from "../login/login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signupTitle") };
}

/** Sign-up uses the same email code as sign-in: the first code creates the account,
 *  then onboarding asks for the therapist's details and an admin reviews them. */
export default async function SignupPage() {
  if (await getSession().catch(() => null)) redirect("/today");
  return <LoginForm next="/today" fresh={false} devMailbox={devLoginEnabled()} signup />;
}
