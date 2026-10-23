import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/illustrations";
import { AccountMenu } from "@/components/account/account-menu";
import { requireClient } from "@/lib/session";
import { setPublicLocale } from "@/app/(marketing)/actions";
import { ThemeSwitch } from "@/components/theme-switch";
import { currentTheme } from "@/lib/theme";
import { withUser } from "@/lib/db";
import { switchView } from "@/app/view/actions";
import { CallHost } from "@/components/video/call-host";

// The client app (ADR-14): deliberately small and separate from the therapist's workspace.
export default async function ClientLayout({ children }: LayoutProps<"/me">) {
  const { session } = await requireClient();
  // An admin looking at their own test client (lib/view.ts).
  const testView = await withUser(session.user.id, async (db) => (await db.query(
    "select is_admin() and exists (select 1 from client_accounts where user_id = $1 and therapist_id = user_id) as v", [session.user.id])).rows[0].v as boolean);
  const t = await getTranslations();
  const locale = await getLocale();
  const other = locale.startsWith("ru") ? "en" : "ru";
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/me" className="min-w-0"><Logo name={t("common.appName")} size="sm" compactBelow360 /></Link>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeSwitch initial={await currentTheme()} compact />
            <form action={setPublicLocale}>
              <input type="hidden" name="lang" value={other} />
              <button lang={other} aria-label={other === "ru" ? "Русский" : "English"} className="rounded-inner px-2 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink sm:px-3">
                <span className="sm:hidden" aria-hidden>{other.toUpperCase()}</span><span className="hidden sm:inline">{other === "ru" ? "Русский" : "English"}</span>
              </button>
            </form>
            <AccountMenu name={session.user.name ?? ""} email={session.user.email} image={session.user.image ?? null} accountHref="/me/settings" switchTo={testView ? "therapist" : undefined} />
          </div>
        </div>
      </header>
      {testView && (
        <form action={switchView.bind(null, "therapist")} className="border-b border-line bg-attention-soft">
          <p className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm text-ink sm:px-6">
            <span>{t("account.clientViewBanner")}</span>
            <button type="submit" className="font-medium text-primary-strong underline underline-offset-4">{t("account.switchToTherapist")}</button>
          </p>
        </form>
      )}
      <main id="main" className="mx-auto max-w-3xl px-4 py-8 sm:px-6"><CallHost>{children}</CallHost></main>
    </div>
  );
}
