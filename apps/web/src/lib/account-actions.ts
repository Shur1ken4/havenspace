"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { isFresh, requireUser } from "@/lib/session";

// The person's own account (both therapists and clients): name, photo, password.

/** A small square photo, shrunk in the browser to ~160px JPEG (a few KB). */
const photo = z.string().max(80_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);

export async function updateAccount(input: { name: string; image: string | null }): Promise<{ ok?: boolean; error?: "invalid" }> {
  await requireUser();
  const parsed = z.object({ name: z.string().trim().min(1).max(80), image: photo.nullable() }).safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  await auth.api.updateUser({ body: { name: parsed.data.name, image: parsed.data.image }, headers: await headers() });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function hasPassword(): Promise<boolean> {
  const session = await requireUser();
  const { rowCount } = await pool.query(
    `select 1 from "account" where "userId" = $1 and "providerId" = 'credential' and password is not null`, [session.user.id]);
  return Boolean(rowCount);
}

export type PasswordResult = { ok?: boolean; error?: "short" | "mismatch" | "wrong_current" | "fresh" | "generic" };

/** Sets a first password, or changes it (then other devices are signed out). */
export async function savePassword(input: { current?: string; next: string; repeat: string }): Promise<PasswordResult> {
  const session = await requireUser();
  if (input.next.length < 10 || input.next.length > 128) return { error: "short" };
  if (input.next !== input.repeat) return { error: "mismatch" };
  const h = await headers();
  try {
    if (await hasPassword()) {
      if (!input.current) return { error: "wrong_current" };
      await auth.api.changePassword({ body: { currentPassword: input.current, newPassword: input.next, revokeOtherSessions: true }, headers: h });
    } else {
      if (!isFresh(session)) return { error: "fresh" };
      await auth.api.setPassword({ body: { newPassword: input.next }, headers: h });
    }
    return { ok: true };
  } catch (err) {
    const msg = String((err as { message?: string }).message ?? "");
    if (/invalid password|incorrect/i.test(msg)) return { error: "wrong_current" };
    if (/session.*(fresh|expired)/i.test(msg)) return { error: "fresh" };
    return { error: "generic" };
  }
}
