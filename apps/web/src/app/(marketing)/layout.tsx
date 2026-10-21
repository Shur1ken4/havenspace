import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/illustrations";
import { buttonClass } from "@/components/ui/button";
import { setPublicLocale } from "./actions";
import { ThemeSwitch } from "@/components/theme-switch";
import { currentTheme } from "@/lib/theme";
import { getSession } from "@/lib/session";

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations();
  const current = (await getLocale()).startsWith("ru") ? "ru" : "en";
  // People who are already signed in go straight to their work; no need to sign in again.
  // A database hiccup must never take the public homepage down.
  const signedIn = await getSession().then(Boolean).catch(() => false);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        {t("common.skipToContent")}
      </a>
      <aside aria-label={t("landing.announceLabel")} className="border-b border-line bg-primary-soft/60 px-4 py-2 text-center text-sm text-ink">
        <span className="breathing-dot mr-2 !h-2 !w-2 align-middle" aria-hidden />
        <span className="sm:hidden">{t("landing.announceShort")}</span>
        <span className="hidden sm:inline">{t("landing.announce")}</span>{" "}
        <Link href="/signup" className="whitespace-nowrap font-medium text-primary-strong underline-offset-4 hover:underline">{t("landing.announceCta")} →</Link>
      </aside>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-5 sm:gap-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo name={t("common.appName")} tagline={t("common.tagline")} taglineFrom="sm" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-6 text-ui text-muted md:flex">
          <Link href="/#how" className="hover:text-ink">{t("nav.how")}</Link>
          <Link href="/#arch" className="hover:text-ink">{t("nav.arch")}</Link>
          <Link href="/privacy" className="hover:text-ink">{t("nav.privacy")}</Link>
          <Link href="/#pricing" className="hover:text-ink">{t("nav.pricing")}</Link>
          <Link href="/#devices" className="hover:text-ink">{t("nav.devices")}</Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          {signedIn ? (
            <Link href="/today" className={buttonClass("primary", "sm", "px-3.5")}>{t("nav.openApp")}</Link>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm", "px-2.5 sm:px-3")}>{t("nav.signIn")}</Link>
              <Link href="/signup" className={buttonClass("primary", "sm", "px-3.5")}>{t("nav.getStarted")}</Link>
            </>
          )}
        </div>
      </header>
      <main id="main" className="overflow-x-clip">{children}</main>
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
                    className={`inline-flex min-h-11 items-center rounded-inner px-1.5 ${current === lang ? "font-medium text-ink" : "hover:text-ink"}`}
                  >
                    {lang === "en" ? "English" : "Русский"}
                  </button>
                </span>
              ))}
            </form>
            <ThemeSwitch initial={await currentTheme()} compact />
          </div>
        </div>
      </footer>
    </>
  );
}
