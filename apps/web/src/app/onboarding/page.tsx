import { redirect } from "next/navigation";
import { requireTherapist } from "@/lib/session";
import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const { therapist } = await requireTherapist({ allowIncomplete: true });
  if (therapist.onboarding_completed_at) redirect("/today");
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <OnboardingWizard initialLanguage={therapist.language === "ru" ? "ru" : "en"} />
    </main>
  );
}
