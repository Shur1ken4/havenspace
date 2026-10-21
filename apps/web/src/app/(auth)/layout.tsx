import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/illustrations";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("common");
  return (
    // Short screens (a phone held sideways) get less space above the form.
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12 [@media(max-height:560px)]:py-4">
      <Link href="/" className="mb-10 self-center [@media(max-height:560px)]:mb-4">
        <Logo name={t("appName")} tagline={t("tagline")} size="lg" />
      </Link>
      {children}
      {/* Only in the HavenSpace apps: the website opens in the browser. */}
      <p className="app-only mt-8 text-center text-sm">
        <a href="/" target="_blank" rel="noopener" className="text-muted underline underline-offset-4 hover:text-ink">{t("website")} ↗</a>
      </p>
    </main>
  );
}
