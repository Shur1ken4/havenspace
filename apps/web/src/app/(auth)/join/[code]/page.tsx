import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { getSession, loadRole } from "@/lib/session";
import { normaliseInviteCode } from "@/lib/invites";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { allowJoinAttempt, previewInvite } from "@/lib/invites";
import { JoinFlow } from "./join-flow";
import { SignupWizard } from "../../signup/signup-wizard";
import { devLoginEnabled } from "@/lib/dev-login";

export async function generateMetadata() {
  return { title: (await getTranslations("join"))("title"), robots: { index: false } };
}

export default async function JoinCodePage({ params }: PageProps<"/join/[code]">) {
  const t = await getTranslations("join");
  const code = normaliseInviteCode(decodeURIComponent((await params).code));
  const allowed = await allowJoinAttempt();
  const therapistName = code && allowed ? await previewInvite(code) : null;

  const session = await getSession();
  let who: "none" | "fresh" | "therapist" | "client" = "none";
  if (session) {
    const role = await loadRole(session.user.id);
    if (role === "client") who = "client";
    else {
      const done = await withUser(session.user.id, async (db) =>
        (await db.query("select onboarding_completed_at from therapists where id = $1", [session.user.id])).rows[0]?.onboarding_completed_at);
      who = done ? "therapist" : "fresh";
    }
  }

  if (who === "client") {
    return (
      <Card className="space-y-4 text-center">
        <h1 className="text-3xl">{t("alreadyTitle")}</h1>
        <p className="text-muted">{t("alreadyBody")}</p>
        <Link href="/me" className={buttonClass("primary")}>{t("openApp")}</Link>
      </Card>
    );
  }
  if (!therapistName) {
    return (
      <Card className="space-y-4">
        <h1 className="text-3xl">{t("invalidTitle")}</h1>
        <p className="text-muted">{allowed ? t("invalidBody") : t("tooMany")}</p>
        <Link href="/join" className={buttonClass("secondary")}>{t("typeCode")}</Link>
      </Card>
    );
  }
  // New here: create an account as this therapist's client. Already signed in: just connect.
  if (who === "none") return <SignupWizard invite={{ code: code!, therapistName }} devMailbox={devLoginEnabled()} />;
  return <JoinFlow code={code!} therapistName={therapistName} who={who} email={session?.user.email ?? null} />;
}
