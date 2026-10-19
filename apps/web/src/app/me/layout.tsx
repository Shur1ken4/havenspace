import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/illustrations";
import { AccountMenu } from "@/components/account/account-menu";
import { requireClient } from "@/lib/session";
import { setPublicLocale } from "@/app/(marketing)/actions";
import { ThemeSwitch } from "@/components/theme-switch";
import { currentTheme } from "@/lib/theme";

// The client app (ADR-14): deliberately small and separate from the therapist's workspace.
export default async function ClientLayout({ children }: LayoutProps<"/me">) {
  const { session } = await requireClient();
  const t = await getTranslations();
  const locale = await getLocale();
  const other = locale.startsWith("ru") ? "en" : "ru";
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/me" aria-label={t("common.appName")}><Logo name={t("common.appName")} size="sm" /></Link>
          <div className="flex items-center gap-1">
            <ThemeSwitch initial={await currentTheme()} compact />
            <form action={setPublicLocale}>
              <input type="hidden" name="lang" value={other} />
              <button className="rounded-[10px] px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink">{other === "ru" ? "Русский" : "English"}</button>
            </form>
            <AccountMenu name={session.user.name ?? ""} email={session.user.email} image={session.user.image ?? null} accountHref="/me/settings" />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
