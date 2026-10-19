import "server-only";
import { getTranslations } from "next-intl/server";
import { pool } from "./db";
import { sendEmail } from "./email";

// Pilot access emails (ADR-11). They contain no client data, and the admin
// notification doesn't even name the person: the details are on the Admin page.
const appUrl = () => process.env.APP_URL ?? "http://localhost:3210";

export async function notifyAdminsOfRequest() {
  const { rows } = await pool.query<{ email: string }>("select admin_emails() as email");
  await Promise.all(rows.map(({ email }) => sendEmail({
    to: email,
    subject: "CouchNote: a new access request is waiting",
    text: `A therapist has asked to join the CouchNote pilot.\n\nReview it here: ${appUrl()}/admin\n`,
  })));
}

/** "You're in" — sent when an admin approves an account, or invites someone from the waiting list. */
export async function sendWelcome(to: string, locale: "en" | "ru", kind: "approved" | "invited") {
  const t = await getTranslations({ locale, namespace: "accessEmail" });
  await sendEmail({
    to,
    subject: t(`${kind}Subject`),
    text: t(`${kind}Body`, { link: `${appUrl()}/login` }),
  });
}
