import "server-only";
import { createHash, randomInt } from "node:crypto";

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
