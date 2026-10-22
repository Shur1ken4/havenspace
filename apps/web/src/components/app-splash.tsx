import { getTranslations } from "next-intl/server";

/**
 * The opening screen of the HavenSpace apps (ADR-20): the mark draws itself,
 * then the name and a short line appear, and it all fades into the app.
 * Shown once each time the app opens, and only in an app window; the script in
 * lib/app-window.ts switches it on before the page paints, so nothing flashes.
 */
export async function AppSplash() {
  const t = await getTranslations("common");
  return (
    <div className="app-splash" aria-hidden="true">
      <div className="app-splash-inner">
        <svg viewBox="0 0 32 32" className="app-splash-mark">
          <path className="app-splash-door" pathLength={1} d="M8.5 28 V15.5 a7.5 7.5 0 0 1 15 0 V28" fill="none" stroke="var(--brand)" strokeWidth="2.6" strokeLinecap="round" />
          <circle className="app-splash-dot" cx="16" cy="19.5" r="3.4" fill="var(--brand)" />
        </svg>
        <p className="app-splash-name font-serif text-brand-ink">{t("appName")}</p>
        <p className="app-splash-tagline text-muted">{t("tagline")}</p>
        <p className="app-splash-line text-ink">{t("splashLine")}</p>
      </div>
    </div>
  );
}
