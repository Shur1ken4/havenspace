"use server";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { withUser } from "./db";
import { getSession, loadRole } from "./session";
import { audit } from "./audit";
import { sendEmail } from "./email";

// Messages between a therapist and their client (db/migrations/0020_messages.sql).
// Row-level security decides who can read and write which conversation; these
// actions only shape the data for the screen.

export type ChatMessage = { id: string; mine: boolean; body: string; at: string; read: boolean };

const MAX = 4000;
const appUrl = () => process.env.APP_URL ?? "http://localhost:3210";

async function who() {
  const session = await getSession();
  if (!session) throw new Error("unauthorised");
  const role = await loadRole(session.user.id);
  if (role === "former_client") throw new Error("forbidden");
  return { userId: session.user.id, asClient: role === "client" };
}

/** The conversation, oldest first: the latest 200, or only those newer than `after`. */
export async function loadMessages(clientId: string, afterIso?: string | null): Promise<ChatMessage[]> {
  z.uuid().parse(clientId);
  const since = afterIso ? z.iso.datetime().parse(afterIso) : null;
  const { userId, asClient } = await who();
  return withUser(userId, async (db) => {
    const { rows } = await db.query(
      `select * from (select id, from_client, body, created_at, read_at from messages
         where client_id = $1 and ($2::timestamptz is null or created_at > $2) order by created_at desc limit 200) m
        order by created_at`, [clientId, since]);
    if (rows.some((r) => r.from_client !== asClient && !r.read_at)) await db.query("select messages_mark_read($1)", [clientId]);
    return rows.map((r) => ({
      id: r.id, mine: r.from_client === asClient, body: r.body, at: r.created_at.toISOString(), read: Boolean(r.read_at),
    }));
  });
}

/** Has the other person read my messages yet? (For the "Read" tick.) */
export async function readUpTo(clientId: string): Promise<string | null> {
  z.uuid().parse(clientId);
  const { userId, asClient } = await who();
  return withUser(userId, async (db) => (await db.query(
    "select max(created_at) as at from messages where client_id = $1 and from_client = $2 and read_at is not null", [clientId, asClient],
  )).rows[0].at?.toISOString() ?? null);
}

export async function sendMessage(clientId: string, text: string): Promise<{ ok: true; message: ChatMessage } | { ok: false }> {
  z.uuid().parse(clientId);
  const body = z.string().trim().min(1).max(MAX).safeParse(text);
  if (!body.success) return { ok: false };
  const { userId, asClient } = await who();
  const row = await withUser(userId, async (db) => {
    const { rows: [r] } = asClient
      ? await db.query(
        `insert into messages (therapist_id, client_id, from_client, sender_id, body)
         select therapist_id, client_id, true, $1, $3 from client_accounts
          where user_id = $1 and client_id = $2 and revoked_at is null returning id, created_at`, [userId, clientId, body.data])
      : await db.query(
        `insert into messages (therapist_id, client_id, from_client, sender_id, body)
         values ($1, $2, false, $1, $3) returning id, created_at`, [userId, clientId, body.data]);
    if (!r) return null;
    if (!asClient) await audit(db, userId, "message.send", "client", clientId);
    const notice = (await db.query("select * from message_notice($1)", [r.id])).rows[0];
    return { ...r, notice };
  }).catch(() => null);
  if (!row) return { ok: false };
  if (row.notice?.email) {
    const n = row.notice;
    // After the reply has gone back, so sending never waits on email.
    after(() => notify(n).catch((err) => console.error(JSON.stringify({ event: "message.email_failed", code: err?.code ?? "unknown" }))));
  }
  return { ok: true, message: { id: row.id, mine: true, body: body.data, at: row.created_at.toISOString(), read: false } };
}

/** "You have a new message" — never the message itself. */
async function notify(n: { email: string; language: string; therapist_name: string; pseudonym: string; to_client: boolean; client_id: string }) {
  const locale = n.language === "ru" ? "ru" : "en";
  const t = await getTranslations({ locale, namespace: "messagesEmail" });
  const link = n.to_client ? `${appUrl()}/me/messages` : `${appUrl()}/messages/${n.client_id}`;
  await sendEmail(n.to_client
    ? { to: n.email, subject: t("toClientSubject", { name: n.therapist_name }), text: t("toClientBody", { name: n.therapist_name, link }) }
    : { to: n.email, subject: t("toTherapistSubject", { name: n.pseudonym }), text: t("toTherapistBody", { name: n.pseudonym, link }) });
}
