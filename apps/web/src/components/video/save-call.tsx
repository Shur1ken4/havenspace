"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { HardDriveDownload, Square } from "lucide-react";
import { ConnectionState, RoomEvent, Track } from "livekit-client";
import { useRoomContext, useTracks, type TrackReference } from "@livekit/components-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { CallRecorder, callRecordingSupported, downloadFile, type CallSources } from "@/lib/client/call-recorder";
import { logCallSaving } from "@/app/(app)/video/actions";

// "Save to my computer" (ADR-24). The therapist asks; the client's screen asks them
// to agree; only then does the therapist's browser record, straight into a file on
// their own computer. The client sees it the whole time and can stop it.
const TOPIC = "hs-savecall";
type Msg = { t: "ask" | "cancel" | "yes" | "no" | "stop" };
const parse = (s: string): Msg | null => {
  try { const m = JSON.parse(s); return m && ["ask", "cancel", "yes", "no", "stop"].includes(m.t) ? m : null; } catch { return null; }
};

function useMessages(onMessage: (m: Msg, from: string) => void) {
  const room = useRoomContext();
  const handler = useRef(onMessage);
  useEffect(() => { handler.current = onMessage; });
  useEffect(() => {
    room.registerTextStreamHandler(TOPIC, (reader, { identity }) => {
      reader.readAll().then((text) => { const m = parse(text); if (m) handler.current(m, identity); }).catch(() => {});
    });
    return () => room.unregisterTextStreamHandler(TOPIC);
  }, [room]);
  return useCallback((m: Msg) => {
    if (room.state !== ConnectionState.Connected) return;
    void room.localParticipant.sendText(JSON.stringify(m), { topic: TOPIC }).catch(() => {});
  }, [room]);
}

const fileName = (ext: string, at: number) => {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `HavenSpace ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}.${ext}`;
};

/** Therapist: the button, the waiting state, the timer and the saved notice. */
export function TherapistSaveCall({ roomId, otherName }: { roomId: string; otherName: string }) {
  const t = useTranslations("video");
  const room = useRoomContext();
  const [state, setState] = useState<"idle" | "asking" | "on" | "saving">("idle");
  const [notice, setNotice] = useState<"declined" | "saved" | "withdrawn" | "failed" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<CallRecorder | null>(null);
  const supported = callRecordingSupported();

  // What goes into the file: a shared screen (theirs or mine), else their camera; my camera small; all voices.
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Microphone, Track.Source.ScreenShareAudio], { onlySubscribed: false });
  const media = (r: TrackReference | undefined) => r?.publication?.track?.mediaStreamTrack ?? null;
  const find = (src: Track.Source, local: boolean) => tracks.find((r) => r.source === src && r.participant.isLocal === local) as TrackReference | undefined;
  const sources: CallSources = {
    main: media(find(Track.Source.ScreenShare, false)) ?? media(find(Track.Source.ScreenShare, true)) ?? media(find(Track.Source.Camera, false)),
    small: media(find(Track.Source.Camera, true)),
    audio: tracks.filter((r) => r.source === Track.Source.Microphone || r.source === Track.Source.ScreenShareAudio)
      .map((r) => media(r as TrackReference)).filter((x): x is MediaStreamTrack => !!x),
  };
  const key = [sources.main?.id, sources.small?.id, ...sources.audio.map((a) => a.id)].join("|");
  const latest = useRef(sources);
  useEffect(() => { latest.current = sources; });
  useEffect(() => { recorder.current?.setSources(latest.current); }, [key]);

  const finish = useCallback(async (why: "saved" | "withdrawn") => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    setState("saving");
    try {
      const { blob, ext } = await r.stop();
      downloadFile(blob, fileName(ext, r.startedAt));
      setNotice(why);
    } catch {
      setNotice("failed");
    }
    setState("idle");
    void room.localParticipant.setAttributes({ savecall: "off" }).catch(() => {});
    void logCallSaving(roomId, why === "withdrawn" ? "withdrawn" : "stopped").catch(() => {});
  }, [room, roomId]);

  const send = useMessages((m, from) => {
    if (from === "therapist") return;
    if (m.t === "yes" && state === "asking") {
      void logCallSaving(roomId, "agreed").catch(() => {});
      try {
        const r = new CallRecorder(t("saveCallPlaceholder", { name: otherName }));
        r.setSources(latest.current);
        r.start();
        recorder.current = r;
        setElapsed(0);
        setState("on");
        void room.localParticipant.setAttributes({ savecall: "on" }).catch(() => {});
        void logCallSaving(roomId, "started").catch(() => {});
      } catch {
        setState("idle");
        setNotice("failed");
      }
    } else if (m.t === "no" && state === "asking") {
      setState("idle");
      setNotice("declined");
      void logCallSaving(roomId, "declined").catch(() => {});
    } else if (m.t === "stop" && state === "on") {
      void finish("withdrawn");
    }
  });

  useEffect(() => {
    if (state !== "on") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => { clearInterval(id); window.removeEventListener("beforeunload", warn); };
  }, [state]);

  // Leaving or ending the call saves the file first.
  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; });
  useEffect(() => () => { void finishRef.current("saved"); }, []);
  // If the client leaves while we're waiting for an answer, stop waiting.
  useEffect(() => {
    if (state !== "asking") return;
    const gone = () => { setState("idle"); };
    room.on(RoomEvent.ParticipantDisconnected, gone);
    return () => { room.off(RoomEvent.ParticipantDisconnected, gone); };
  }, [room, state]);

  if (!supported) return null;
  const minutes = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const otherHere = room.remoteParticipants.size > 0;

  return (
    <>
      {state === "idle" && (
        <Button variant="secondary" disabled={!otherHere} title={!otherHere ? t("saveCallNeedsClient") : undefined}
          onClick={() => { setNotice(null); setState("asking"); send({ t: "ask" }); void logCallSaving(roomId, "asked").catch(() => {}); }}>
          <HardDriveDownload size={17} aria-hidden /> {t("saveCall")}
        </Button>
      )}
      {state === "asking" && (
        <Button variant="secondary" onClick={() => { send({ t: "cancel" }); setState("idle"); }}>
          <span className="breathing-dot" data-paused="true" /> {t("saveCallAsking", { name: otherName })}
        </Button>
      )}
      {(state === "on" || state === "saving") && (
        <Button variant="secondary" disabled={state === "saving"} onClick={() => void finish("saved")}>
          <Square size={14} className="fill-current" aria-hidden /> {state === "saving" ? t("saveCallSaving") : t("saveCallStop", { time: minutes })}
        </Button>
      )}
      {notice && (
        <div className="w-full basis-full">
          <Notice tone={notice === "saved" ? "success" : "attention"}>{t(`saveCallNotice_${notice}`, { name: otherName })}</Notice>
        </div>
      )}
    </>
  );
}

/** Client: the question, and a visible notice with a Stop button while it's on. */
export function ClientSaveCall({ otherName, saving }: { otherName: string; saving: boolean }) {
  const t = useTranslations("video");
  const [asked, setAsked] = useState(false);
  const send = useMessages((m, from) => {
    if (from !== "therapist") return;
    if (m.t === "ask") setAsked(true);
    if (m.t === "cancel") setAsked(false);
  });
  const answer = (yes: boolean) => { send({ t: yes ? "yes" : "no" }); setAsked(false); };
  return (
    <>
      {saving && (
        <div className="flex w-full basis-full flex-wrap items-center justify-between gap-2 rounded-card border border-attention/40 bg-attention-soft px-4 py-2.5 text-sm text-ink" role="status">
          <span className="flex items-center gap-2"><span className="breathing-dot" /> {t("savingByOther", { name: otherName })}</span>
          <button type="button" onClick={() => send({ t: "stop" })} className="font-medium text-primary-strong underline underline-offset-4">{t("saveCallStopClient")}</button>
        </div>
      )}
      <Dialog open={asked} onOpenChange={(o) => { if (!o) answer(false); }} title={t("saveCallAskTitle")} description={t("saveCallAskBody", { name: otherName })}>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => answer(true)}>{t("saveCallAgree")}</Button>
          <Button variant="ghost" onClick={() => answer(false)}>{t("saveCallDecline")}</Button>
        </div>
      </Dialog>
    </>
  );
}
