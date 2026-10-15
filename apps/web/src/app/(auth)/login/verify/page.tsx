import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { isMfaPending } from "@/lib/mfa";
import { VerifyForm } from "./verify-form";

export async function generateMetadata() {
  return { title: (await getTranslations("auth"))("twoFactorTitle") };
}

export default async function VerifyPage({ searchParams }: PageProps<"/login/verify">) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/today";
  if (!(await isMfaPending(session))) redirect(next);
  return <VerifyForm next={next} justEnabled={sp.enabled === "1"} />;
}
