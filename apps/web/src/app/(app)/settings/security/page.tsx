import { requireTherapist } from "@/lib/session";
import { pool } from "@/lib/db";
import { Security } from "./security";

export async function generateMetadata() {
  return { title: (await (await import("next-intl/server")).getTranslations("settings"))("security") };
}

export default async function SecuritySettings() {
  const { session } = await requireTherapist();
  // Auth tables are managed by the sign-in library; read only this user's flag.
  const { rows } = await pool.query('select "twoFactorEnabled" as on from "user" where id = $1', [session.user.id]);
  return <Security twoFactorOn={Boolean(rows[0]?.on)} />;
}
