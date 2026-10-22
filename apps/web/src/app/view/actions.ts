"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { VIEW_COOKIE } from "@/lib/view";

/** Admins only: switch between the therapist view and the view of their own test client. */
export async function switchView(view: "client" | "therapist") {
  const session = await requireUser();
  const name = (await getTranslations("account"))("testClientName");
  const admin = await withUser(session.user.id, async (db) => {
    if (!(await db.query("select is_admin() as a")).rows[0].a) return false;
    if (view === "client") await db.query("select admin_test_client($1)", [name]);
    await audit(db, session.user.id, `view.${view}`, "user", session.user.id);
    return true;
  });
  if (!admin) redirect("/today");
  const jar = await cookies();
  if (view === "client") jar.set(VIEW_COOKIE, "client", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  else jar.delete(VIEW_COOKIE);
  redirect(view === "client" ? "/me" : "/today");
}
