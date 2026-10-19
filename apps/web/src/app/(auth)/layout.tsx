import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/illustrations";
import { Arch } from "@/components/arch";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("common");
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 self-center" aria-label={t("appName")}>
        <Logo name={t("appName")} tagline={t("tagline")} size="lg" />
      </Link>
      <Arch className="mx-auto mb-2 h-28 w-28" />
      {children}
    </main>
  );
}
