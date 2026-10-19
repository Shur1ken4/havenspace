import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/illustrations";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("common");
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-10 self-center" aria-label={t("appName")}>
        <Logo name={t("appName")} tagline={t("tagline")} size="lg" />
      </Link>
      {children}
    </main>
  );
}
