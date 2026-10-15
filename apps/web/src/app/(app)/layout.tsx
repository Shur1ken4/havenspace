import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/illustrations";
import { AppNav } from "@/components/app/nav";
import { SignOutButton } from "@/components/app/sign-out";
import { FeedbackWidget } from "@/components/app/feedback-widget";
import { realDataAllowed, requireTherapist } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireTherapist();
  const t = await getTranslations();
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        {t("common.skipToContent")}
      </a>
      {!realDataAllowed() && (
        <div className="no-print border-b border-attention/30 bg-attention-soft px-4 py-2 text-center text-sm text-ink">
          {t("common.demoBanner")}
        </div>
      )}
      <header className="no-print border-b border-line bg-surface/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/today" className="flex items-center gap-2 text-ink">
            <LogoMark className="h-7 w-7" />
            <span className="font-serif text-lg">{t("common.appName")}</span>
          </Link>
          <div className="order-last -mx-1 w-full sm:order-none sm:mx-0 sm:w-auto"><AppNav /></div>
          <SignOutButton />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <FeedbackWidget />
    </div>
  );
}
