import "server-only";

// Outgoing email. In development ("console") links are printed to the
// terminal and kept in memory for the /dev/mailbox page, never sent.
export type OutgoingEmail = { to: string; subject: string; text: string; html?: string };

const globalForMail = globalThis as unknown as { __devMailbox?: (OutgoingEmail & { at: string })[] };
export const devMailbox = (globalForMail.__devMailbox ??= []);

export async function sendEmail(mail: OutgoingEmail): Promise<void> {
  const transport = process.env.EMAIL_TRANSPORT ?? "console";
  if (transport === "console") {
    if (process.env.NODE_ENV === "production") throw new Error("console email transport is not allowed in production");
    devMailbox.unshift({ ...mail, at: new Date().toISOString() });
    devMailbox.splice(20);
    console.log(`\n[dev email] to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
    return;
  }
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({ from: process.env.EMAIL_FROM, ...mail });
}
