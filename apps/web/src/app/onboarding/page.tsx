import { redirect } from "next/navigation";
import { requireTherapist } from "@/lib/session";
import { getLocale } from "next-intl/server";
import { browserCountry } from "@/lib/browser-locale";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const { therapist, session } = await requireTherapist({ allowIncomplete: true });
  if (therapist.onboarding_completed_at) redirect("/today");
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <OnboardingWizard initialLanguage={(await getLocale()).startsWith("ru") ? "ru" : "en"} initialCountry={await browserCountry()} initialName={therapist.full_name ?? session.user.name ?? ""} />
    </main>
  );
}
