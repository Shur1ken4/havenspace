import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

// In-app video (ADR-17). LiveKit carries the audio and video; HavenSpace decides
// who may enter which room and hands out short-lived entry passes (tokens).

export function videoEnabled(): boolean {
  return Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

export function videoServerUrl(): string {
  return process.env.LIVEKIT_URL!;
}

/** An entry pass for one person to one room, valid long enough for a session. */
export async function videoToken(room: string, identity: string, name: string): Promise<string> {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity, name, ttl: "3h" });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false });
  return at.toJwt();
}

/** Ends the call for everyone still in it. A room that no longer exists is fine. */
export async function closeVideoRoom(room: string): Promise<void> {
  const host = process.env.LIVEKIT_URL!.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  const svc = new RoomServiceClient(host, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  await svc.deleteRoom(room).catch(() => {});
}

/** One-time join links: 32 random bytes in the link, only a hash in the database. */
export const newGuestToken = () => randomBytes(32).toString("base64url");
export const hashGuestToken = (token: string) => createHash("sha256").update(`video-guest:${token}`).digest("hex");
export const isGuestToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);
export const guestLinkUrl = (token: string) => `${process.env.APP_URL ?? "http://localhost:3210"}/v/${token}`;
