import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireTherapist } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { SignOutButton } from "@/components/app/sign-out";
import { DocumentUpload } from "@/components/app/document-upload";

export async function generateMetadata() {
  return { title: (await getTranslations("pending"))("title") };
}

// Shown after onboarding until an admin approves the account (ADR-11).
export default async function PendingPage() {
  const { therapist } = await requireTherapist({ allowPending: true });
  if (therapist.access_status === "approved") redirect("/today");
  const t = await getTranslations("pending");
  const declined = therapist.access_status === "declined";
  return (
    <Card className="space-y-4 text-center sm:p-8">
      <h1 className="text-3xl">{declined ? t("declinedTitle") : t("title")}</h1>
      <p className="text-muted">{declined ? t("declinedBody") : t("body", { email: therapist.email })}</p>
      {!declined && <p className="text-sm text-muted">{t("meanwhile")}</p>}
      {!declined && <div className="rounded-card border border-line p-4 text-left"><DocumentUpload /></div>}
      <div className="flex justify-center pt-2"><SignOutButton /></div>
    </Card>
  );
}
