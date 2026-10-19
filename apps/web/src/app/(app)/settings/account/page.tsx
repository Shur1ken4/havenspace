import { getTranslations } from "next-intl/server";
import { requireTherapist } from "@/lib/session";
import { hasPassword } from "@/lib/account-actions";
import { AccountSettings } from "@/components/account/account-settings";

export async function generateMetadata() {
  return { title: (await getTranslations("account"))("account") };
}

export default async function TherapistAccount() {
  const { session } = await requireTherapist();
  return <AccountSettings name={session.user.name ?? ""} email={session.user.email} image={session.user.image ?? null} hasPassword={await hasPassword()} />;
}
