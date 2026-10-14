import { getTranslations } from "next-intl/server";
import { requireTherapist } from "@/lib/session";
import { ProfileForm } from "./profile-form";

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("title") };
}

export default async function ProfileSettings() {
  const { therapist } = await requireTherapist();
  return <ProfileForm therapist={therapist} />;
}
