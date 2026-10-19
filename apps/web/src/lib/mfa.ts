import "server-only";
import { createOTP } from "@better-auth/utils/otp";
import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { auth } from "./auth";
import { pool } from "./db";

// Two-step verification gate, enforced by the app for every sign-in method
// (the sign-in library's plugin only covers password sign-ins, and we use
// email codes). A session with 2FA pending is treated as not signed in.

type RawSession = { user: { id: string; twoFactorEnabled?: boolean | null }; session: { id: string } };

export async function isMfaPending(s: RawSession): Promise<boolean> {
  if (!s.user.twoFactorEnabled) return false;
  const { rowCount } = await pool.query("select 1 from mfa_verified_sessions where session_id = $1", [s.session.id]);
  return !rowCount;
}

export async function markVerified(sessionId: string) {
  await pool.query("insert into mfa_verified_sessions (session_id) values ($1) on conflict do nothing", [sessionId]);
}

const MAX_FAILURES = 5;

/** Checks an authenticator code (6 digits) or a one-time backup code. */
export async function verifySecondFactor(userId: string, input: string): Promise<"ok" | "invalid" | "locked"> {
  const { rows: [{ n }] } = await pool.query(
    "select count(*)::int as n from mfa_attempts where user_id = $1 and at > now() - interval '15 minutes'", [userId],
  );
  if (n >= MAX_FAILURES) return "locked";
  const { rows } = await pool.query('select id, secret, "backupCodes" from "twoFactor" where "userId" = $1 and verified is not false', [userId]);
  const row = rows[0];
  if (!row) return "invalid";
  const key = (await auth.$context).secretConfig;
  const code = input.trim().replace(/\s+/g, "");
  let ok = false;
  if (/^\d{6}$/.test(code)) {
    const secret = await symmetricDecrypt({ key, data: row.secret });
    ok = await createOTP(secret, { period: 30, digits: 6 }).verify(code);
  } else if (code.length >= 8) {
    // Backup codes are single-use: remove the one used.
    const codes: string[] = JSON.parse(await symmetricDecrypt({ key, data: row.backupCodes }));
    const idx = codes.indexOf(code);
    if (idx >= 0) {
      codes.splice(idx, 1);
      await pool.query('update "twoFactor" set "backupCodes" = $2 where id = $1', [row.id, await symmetricEncrypt({ key, data: JSON.stringify(codes) })]);
      ok = true;
    }
  }
  if (!ok) {
    await pool.query("insert into mfa_attempts (user_id) values ($1)", [userId]);
    return "invalid";
  }
  await pool.query("delete from mfa_attempts where user_id = $1", [userId]);
  return "ok";
}
