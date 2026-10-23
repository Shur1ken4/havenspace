"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, RoomEvent } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import { TOOLS_TOPIC, TOOL_KINDS, apply, parseMessage, type ToolAction, type ToolKind, type ToolMessage, type ToolState } from "@/lib/tools/model";

export type Role = "therapist" | "client";

/**
 * Therapist: what each tool held in this call (cards with their words, a drawing…),
 * so switching tools, closing one or reloading the page brings it back. Kept in this
 * browser tab only (sessionStorage) and cleared when the call ends or the tab closes.
 */
type Kept = { open: ToolKind | null; tools: Partial<Record<ToolKind, ToolState>> };
const keptKey = (roomId: string) => `hs-tools:${roomId}`;
function readKept(roomId: string): Kept {
  try {
    const v = JSON.parse(sessionStorage.getItem(keptKey(roomId)) ?? "null");
    if (v && typeof v === "object" && v.tools && typeof v.tools === "object") {
      const tools = Object.fromEntries(Object.entries(v.tools).filter(([k, s]) => TOOL_KINDS.includes(k as ToolKind) && (s as ToolState)?.kind === k));
      return { open: TOOL_KINDS.includes(v.open) && tools[v.open] ? v.open : null, tools };
    }
  } catch { /* storage unavailable: nothing kept */ }
  return { open: null, tools: {} };
}
function writeKept(roomId: string, kept: Kept) {
  try { sessionStorage.setItem(keptKey(roomId), JSON.stringify(kept)); } catch { /* full or unavailable: the call carries on */ }
}
/** Forgets what the tools held in this call (when it ends). */
export function forgetTools(roomId: string) {
  try { sessionStorage.removeItem(keptKey(roomId)); } catch { /* nothing to do */ }
}

/**
 * Keeps the shared tool in step between the two people in the call (ADR-21).
 * The therapist's screen holds the true state and sends it on every change;
 * the client shows it and sends its own actions, which the therapist applies.
 */
export function useTools(role: Role, roomId: string) {
  const room = useRoomContext();
  // The therapist's screen picks up where it was (e.g. after a reload); the client waits for the therapist.
  const [tool, setTool] = useState<ToolState | null>(() => {
    if (role !== "therapist" || typeof window === "undefined") return null;
    const k = readKept(roomId);
    return k.open ? k.tools[k.open] ?? null : null;
  });
  const kept = useRef<Kept | null>(null);
  const current = useRef<ToolState | null>(tool);
  const seq = useRef(0);
  const lastSeq = useRef(0);
  const [savedAt, setSavedAt] = useState(0);

  const send = useCallback((m: ToolMessage) => {
    // Only on a live connection; whoever is missing gets the state when they (re)connect.
    if (room.state !== ConnectionState.Connected) return;
    void room.localParticipant.sendText(JSON.stringify(m), { topic: TOOLS_TOPIC }).catch(() => {});
  }, [room]);

  // The therapist sends the whole state, at most every 60 ms, so quick changes stay light.
  const queued = useRef(false);
  const broadcast = useCallback(() => {
    if (role !== "therapist" || queued.current) return;
    queued.current = true;
    setTimeout(() => {
      queued.current = false;
      seq.current = Math.max(Date.now(), seq.current + 1); // keeps rising even if the page reloads
      send({ t: "state", seq: seq.current, tool: current.current });
    }, 60);
  }, [role, send]);

  const commit = useCallback((next: ToolState | null) => {
    current.current = next;
    setTool(next);
    broadcast();
    if (role === "therapist") {
      const k = (kept.current ??= readKept(roomId));
      if (next) k.tools[next.kind] = next;
      k.open = next?.kind ?? null;
      writeKept(roomId, k);
    }
  }, [broadcast, role, roomId]);

  /** Therapist: open, change or close a tool. */
  const set = useCallback((next: ToolState | null) => {
    if (role === "therapist") commit(next);
  }, [role, commit]);

  /** Therapist: open a tool as it was left earlier in this call, or `fresh` the first time. */
  const open = useCallback((kind: ToolKind, fresh: () => ToolState) => {
    if (role === "therapist") commit((kept.current ??= readKept(roomId)).tools[kind] ?? fresh());
  }, [role, roomId, commit]);

  /** Either person acts on the open tool (a number, a word, a card, a stroke…). */
  const act = useCallback((action: ToolAction) => {
    const state = current.current;
    if (!state) return;
    const next = apply(state, action, role);
    if (next === state) return;
    if (role === "therapist") commit(next);
    else {
      // Shown at once; the therapist's screen confirms it a moment later.
      current.current = next;
      setTool(next);
      send({ t: "act", act: action });
    }
  }, [role, commit, send]);

  const notifySaved = useCallback(() => send({ t: "saved" }), [send]);

  useEffect(() => {
    room.registerTextStreamHandler(TOOLS_TOPIC, (reader, { identity }) => {
      reader.readAll().then((text) => {
        const m = parseMessage(text);
        if (!m) return;
        if (role === "therapist") {
          if (identity === "therapist") return;
          if (m.t === "hello") broadcast();
          else if (m.t === "act" && current.current) {
            const next = apply(current.current, m.act, "client");
            if (next !== current.current) commit(next);
          }
        } else if (identity === "therapist") {
          if (m.t === "state" && m.seq > lastSeq.current) {
            lastSeq.current = m.seq;
            current.current = m.tool;
            setTool(m.tool);
          } else if (m.t === "saved") setSavedAt(Date.now());
        }
      }).catch(() => {});
    });
    return () => room.unregisterTextStreamHandler(TOOLS_TOPIC);
  }, [room, role, broadcast, commit]);

  // Whoever arrives (or comes back) gets the current tool.
  useEffect(() => {
    const onArrive = () => (role === "therapist" ? broadcast() : send({ t: "hello" }));
    if (role === "client") onArrive();
    for (const e of [RoomEvent.Connected, RoomEvent.ParticipantConnected, RoomEvent.Reconnected] as const) room.on(e, onArrive);
    return () => {
      for (const e of [RoomEvent.Connected, RoomEvent.ParticipantConnected, RoomEvent.Reconnected] as const) room.off(e, onArrive);
    };
  }, [room, role, broadcast, send]);

  return { tool, set, open, act, savedAt, notifySaved };
}
