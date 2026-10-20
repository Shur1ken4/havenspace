import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/illustrations";

/** Guest video page: just the logo and the call, no app navigation (and no
 *  therapist-facing tagline: the person here is a client). */
export default async function GuestLayout({ children }: LayoutProps<"/v">) {
  const t = await getTranslations("common");
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-8 flex justify-center">
        <Logo name={t("appName")} size="md" />
      </div>
      {children}
    </main>
  );
}
