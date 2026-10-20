import "server-only";
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
