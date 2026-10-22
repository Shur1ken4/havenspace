import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/illustrations";
import { AppNav } from "@/components/app/nav";
import { AccountMenu } from "@/components/account/account-menu";
import { Arch } from "@/components/arch";
import { FeedbackWidget } from "@/components/app/feedback-widget";
import { realDataAllowed, requireTherapist } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { therapist, session } = await requireTherapist();
  const t = await getTranslations();
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        {t("common.skipToContent")}
      </a>
      {!realDataAllowed() && (
        <aside aria-label={t("common.demoLabel")} className="no-print border-b border-attention/30 bg-attention-soft px-4 py-2 text-center text-sm text-ink">
          {t("common.demoBanner")}
        </aside>
      )}
      <header className="no-print border-b border-line bg-surface/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/today">
            <Logo name={t("common.appName")} size="sm" />
          </Link>
          <div className="order-last -mx-1 w-full sm:order-none sm:mx-0 sm:w-auto"><AppNav isAdmin={therapist.is_admin} /></div>
          <div className="flex items-center gap-2">
            <Link href="/arch" data-paused="true"
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface p-1 text-sm font-medium min-[400px]:pr-3 text-ink hover:border-primary hover:bg-primary-soft/50">
              <Arch className="h-7 w-7" />
              <span className="sr-only min-[400px]:not-sr-only">{t("askArch.button")}</span>
            </Link>
            <AccountMenu name={session.user.name || therapist.display_name} email={session.user.email} image={session.user.image ?? null} accountHref="/settings/account" switchTo={therapist.is_admin ? "client" : undefined} />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <FeedbackWidget />
    </div>
  );
}
