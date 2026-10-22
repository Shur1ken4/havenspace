"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";
import { sendWelcome } from "@/lib/access";

/** Sends the "you're in" email; a failure is logged (no content) and shown on the Admin page. */
async function welcome(to: string, locale: "en" | "ru", kind: "approved" | "invited"): Promise<boolean> {
  try {
    await sendWelcome(to, locale, kind);
    return true;
  } catch (err) {
    const e = err as { code?: string; responseCode?: number };
    console.error(JSON.stringify({ event: "access.email_failed", kind, code: e?.code ?? null, smtp: e?.responseCode ?? null }));
    return false;
  }
}

// Admin actions (ADR-11). The database checks is_admin() again on every row.

const decideSchema = z.object({ therapistId: z.string().min(1).max(64), decision: z.enum(["approved", "declined", "pending"]) });

export async function decideAccess(form: FormData) {
  const { therapist: admin } = await requireAdmin();
  const d = decideSchema.parse({ therapistId: form.get("therapistId"), decision: form.get("decision") });
  const target = await withUser(admin.id, async (db) => {
    const { rows } = await db.query(
      `update therapists t set access_status = $2, access_decided_at = now() where t.id = $1
       returning t.language, (select email from "user" u where u.id = t.id) as email`, [d.therapistId, d.decision],
    );
    if (rows[0]) await audit(db, admin.id, `access.${d.decision}`, "therapist", d.therapistId);
    return rows[0];
  });
  const sent = target && d.decision === "approved" ? await welcome(target.email, target.language === "ru" ? "ru" : "en", "approved") : true;
  revalidatePath("/admin");
  if (!sent) redirect("/admin?mail=failed");
}

const inviteSchema = z.object({ email: z.email().max(200), language: z.enum(["en", "ru"]).catch("en") });

export async function inviteFromList(form: FormData) {
  const { therapist: admin } = await requireAdmin();
  const d = inviteSchema.parse({ email: String(form.get("email") ?? "").trim().toLowerCase(), language: form.get("language") });
  const fresh = await withUser(admin.id, async (db) => {
    const { rowCount } = await db.query("insert into access_invites (email) values ($1) on conflict do nothing", [d.email]);
    // Someone who already signed up and is waiting gets approved too.
    await db.query(
      `update therapists t set access_status = 'approved', access_decided_at = now()
        where t.access_status = 'pending' and t.id in (select id from "user" where lower(email) = $1)`, [d.email],
    );
    if (rowCount) await audit(db, admin.id, "access.invite", "invite", null);
    return Boolean(rowCount);
  });
  if (fresh && !(await welcome(d.email, d.language, "invited"))) redirect("/admin?mail=failed");
  revalidatePath("/admin");
}
