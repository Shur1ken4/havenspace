"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectionState, RoomEvent } from "livekit-client";
import { useRoomContext } from "@livekit/components-react";
import { TOOLS_TOPIC, apply, parseMessage, type ToolAction, type ToolMessage, type ToolState } from "@/lib/tools/model";

export type Role = "therapist" | "client";

/**
 * Keeps the shared tool in step between the two people in the call (ADR-21).
 * The therapist's screen holds the true state and sends it on every change;
 * the client shows it and sends its own actions, which the therapist applies.
 */
export function useTools(role: Role) {
  const room = useRoomContext();
  const [tool, setTool] = useState<ToolState | null>(null);
  const current = useRef<ToolState | null>(null);
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
  }, [broadcast]);

  /** Therapist: open, change or close a tool. */
  const set = useCallback((next: ToolState | null) => {
    if (role === "therapist") commit(next);
  }, [role, commit]);

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

  return { tool, set, act, savedAt, notifySaved };
}
