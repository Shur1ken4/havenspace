import "server-only";
import { createHash, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { pool } from "./db";

// Client invite codes (ADR-14): 8 characters without look-alikes (no 0/O, 1/I/L),
// shown as "K7P4-QM2X". About 40 bits of randomness, valid for 7 days, single use,
// and only a hash is stored.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newInviteCode(): string {
  const raw = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** Accepts any spacing, dashes or case the person typed. */
export function normaliseInviteCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 8 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export const hashInviteCode = (code: string) => createHash("sha256").update(`client-invite:${code}`).digest("hex");

// Kept here, not in a "use server" file, so they can't be called directly from a browser.
/** Counts a code attempt for this visitor; false when they've tried too often. */
export async function allowJoinAttempt(): Promise<boolean> {
  const h = await headers();
  const ip = (h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for") ?? "local").split(",")[0].trim().slice(0, 64);
  const { rows } = await pool.query("select note_join_attempt($1) as ok", [ip]);
  return Boolean(rows[0].ok);
}

/** Looks up an invite before sign-in: the inviting therapist's name, or null. */
export async function previewInvite(code: string): Promise<string | null> {
  const normal = normaliseInviteCode(code);
  if (!normal) return null;
  const { rows } = await pool.query("select client_invite_preview($1) as name", [hashInviteCode(normal)]);
  return rows[0].name ?? null;
}

