import { getTranslations } from "next-intl/server";
import { devLoginEnabled } from "@/lib/dev-login";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") && !sp.next.startsWith("/\\") ? sp.next : "/today";
  return <LoginForm next={next} fresh={sp.reason === "fresh"} devMailbox={devLoginEnabled()} />;
}
