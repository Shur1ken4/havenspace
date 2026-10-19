import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/illustrations";
import { buttonClass } from "@/components/ui/button";
import { setPublicLocale } from "./actions";

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations();
  const current = (await getLocale()).startsWith("ru") ? "ru" : "en";
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        {t("common.skipToContent")}
      </a>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="shrink-0" aria-label={t("common.appName")}>
          <Logo name={t("common.appName")} tagline={t("common.tagline")} taglineFrom="sm" />
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
            <Logo name={t("common.appName")} tagline={t("common.tagline")} size="sm" />
            <p>{t("landing.footerDisclaimer")}</p>
            <p>{t("landing.footerMade")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/privacy" className="hover:text-ink">{t("landing.footerPrivacy")}</Link>
            <Link href="/resources/consent-template" className="hover:text-ink">{t("landing.footerConsent")}</Link>
            <form action={setPublicLocale} aria-label={t("landing.footerLanguage")} className="flex items-center gap-1">
              {(["en", "ru"] as const).map((lang, i) => (
                <span key={lang} className="flex items-center gap-1">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <button
                    type="submit" name="lang" value={lang} lang={lang}
                    aria-current={current === lang ? "true" : undefined}
                    className={current === lang ? "font-medium text-ink" : "hover:text-ink"}
                  >
                    {lang === "en" ? "English" : "Русский"}
                  </button>
                </span>
              ))}
            </form>
          </div>
        </div>
      </footer>
    </>
  );
}
