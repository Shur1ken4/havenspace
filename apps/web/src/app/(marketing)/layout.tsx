import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/illustrations";
import { buttonClass } from "@/components/ui/button";

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        {t("common.skipToContent")}
      </a>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink sm:gap-2.5">
          <LogoMark className="h-8 w-8" />
          <span className="whitespace-nowrap font-serif text-lg sm:text-xl">{t("common.appName")}</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 text-[15px] text-muted md:flex">
          <Link href="/#how" className="hover:text-ink">{t("nav.how")}</Link>
          <Link href="/#reflection" className="hover:text-ink">{t("nav.reflection")}</Link>
          <Link href="/privacy" className="hover:text-ink">{t("nav.privacy")}</Link>
          <Link href="/#pricing" className="hover:text-ink">{t("nav.pricing")}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={buttonClass("ghost", "sm")}>{t("nav.signIn")}</Link>
          <Link href="/#join" className={buttonClass("primary", "sm", "hidden sm:inline-flex")}>{t("nav.bookDemo")}</Link>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="mt-24 border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-2">
            <p className="flex items-center gap-2 text-ink"><LogoMark className="h-6 w-6" /> {t("common.appName")} <span className="text-muted">({t("common.workingName")})</span></p>
            <p>{t("landing.footerDisclaimer")}</p>
            <p>{t("landing.footerMade")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/privacy" className="hover:text-ink">{t("landing.footerPrivacy")}</Link>
            <Link href="/resources/consent-template" className="hover:text-ink">{t("landing.footerConsent")}</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
