"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Circle, ScreenShare, ScreenShareOff, Maximize2, Minimize2, Pause, Play, Square, CornerUpLeft } from "lucide-react";
import { RoomEvent, Track } from "livekit-client";
import {
  LiveKitRoom, RoomAudioRenderer, VideoTrack, useLocalParticipant, useRemoteParticipants, useTracks,
  type TrackReference,
} from "@livekit/components-react";
import { Arch } from "@/components/arch";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { pickMimeType } from "@/lib/client/audio";
import { UploadQueue } from "@/lib/client/upload-queue";
import { LiveClipper } from "@/lib/client/live";
import { Chip } from "@/components/ui/chip";
import { LivePanel } from "@/app/(app)/sessions/[id]/capture/live-panel";
import { endVideo, startVideoRecording } from "@/app/(app)/video/actions";
import { JoinOptions } from "./join-options";
import { forgetTools, useTools } from "./tools/use-tools";
import { ToolMenu, ToolStage, useNewTool } from "./tools/tool-stage";
import { CallDecks, type CallDeck } from "./tools/decks-context";
import { ClientSaveCall, TherapistSaveCall } from "./save-call";
import { BackgroundButton, useBackground } from "./background";

type Role = "therapist" | "client";
type Stage = "lobby" | "joining" | "in" | "ended" | "error";

/**
 * A video session inside HavenSpace (ADR-17). LiveKit carries the call; the screen
 * is ours. The therapist can record for notes: their microphone and the client's
 * audio are saved as two separate tracks, exactly like an online-call recording.
 */
export function VideoRoom({ roomId, role, otherName, clientId, consent = false, linked = false, guestToken, liveAllowed = false, decks = [], mini = false, callPath, onActive }: {
  roomId: string; role: Role; otherName: string; clientId?: string; consent?: boolean;
  /** Shown small in the corner while the person is elsewhere in the app (CallHost). */
  mini?: boolean;
  /** The call's own page, for "Back to the call". */
  callPath?: string;
  /** Tells the host whether the call is on (so it stays when the person moves to another page). */
  onActive?: (on: boolean) => void;
  /** Therapist: their own card decks, for the cards tool. */
  decks?: CallDeck[];
  /** Therapist: live research mode is switched on for this account (ADR-10, role-play only). */
  liveAllowed?: boolean;
  /** Therapist: the client uses the client app and gets "Join now" there. */
  linked?: boolean;
  /** Someone joining from a one-time link, without an account. */
  guestToken?: string;
}) {
  const t = useTranslations("video");
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("lobby");
  const [conn, setConn] = useState<{ url: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Therapist's choice before joining: live suggestions (research). Recording is
  // never automatic: the therapist starts, pauses and finishes it in the call.
  const [liveOn, setLiveOn] = useState(false);
  const leaving = useRef(false);
  const reportActive = useRef(onActive);
  useEffect(() => { reportActive.current = onActive; });
  useEffect(() => { reportActive.current?.(stage === "in"); }, [stage]);
  // Closing or reloading the tab would drop the call: the browser asks first.
  useEffect(() => {
    if (stage !== "in") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  async function join() {
    setStage("joining");
    setError(null);
    const res = await (guestToken
      ? fetch("/api/video/guest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: guestToken }), cache: "no-store" })
      : fetch(`/api/video/${roomId}/token`, { cache: "no-store" })).catch(() => null);
    if (!res?.ok) {
      setError(res?.status === 410 ? "gone" : res?.status === 503 ? "notConfigured" : "failed");
      setStage(res?.status === 410 ? "ended" : "error");
      return;
    }
    setConn(await res.json());
    setStage("in");
  }

  // Guests have no space in HavenSpace to go back to.
  const back = role === "therapist" ? (clientId ? `/clients/${clientId}` : "/today") : guestToken ? null : "/me";

  if (stage === "ended") {
    return (
      <Card className="mx-auto max-w-lg space-y-4 text-center sm:p-10">
        <Arch mood="resting" className="mx-auto h-24 w-24" />
        <h1 className="text-3xl">{t("ended")}</h1>
        <p className="text-muted">{role === "client" ? t("endedBodyClient") : t("endedBody")}</p>
        {back ? <Link href={back} className={buttonClass("primary")}>{role === "client" ? t("backClient") : t("back")}</Link>
          : <p className="text-sm text-muted">{t("canClose")}</p>}
      </Card>
    );
  }

  if (stage !== "in" || !conn) {
    return (
      <Card className="mx-auto max-w-lg space-y-5 sm:p-10">
        <div className="flex items-center gap-4">
          <Arch mood="hello" className="h-20 w-20 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm text-muted">{t("title")}</p>
            <h1 className="text-3xl">{t("with", { name: otherName })}</h1>
          </div>
        </div>
        <p className="text-ink">{role === "therapist" ? t("lobbyTherapist") : t("lobbyClient")}</p>
        <p className="text-sm text-muted">{role === "therapist" ? t("privacyTherapist") : t("privacyClient")}</p>
        {role === "therapist" && (
          <div className="space-y-3 rounded-card border border-line p-4">
            <p className="text-sm text-muted">{consent ? t("recordHowTo", { name: otherName }) : t("autoRecordNoConsent", { name: otherName })}</p>
            {liveAllowed && consent && (
              <label className="flex cursor-pointer gap-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary-strong)]" checked={liveOn} onChange={(e) => setLiveOn(e.target.checked)} />
                <span className="space-y-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-ink">{t("live")} <Chip tone="amber">{t("liveBadge")}</Chip></span>
                  <span className="block text-sm text-muted">{t("liveHint")}</span>
                </span>
              </label>
            )}
          </div>
        )}
        {error && <Notice tone="attention">{t(error)}</Notice>}
        <Button size="lg" className="w-full" onClick={join} disabled={stage === "joining"}>
          {stage === "joining" ? t("joining") : t("join")}
        </Button>
        {role === "therapist" && <JoinOptions roomId={roomId} clientName={otherName} linked={linked} />}
      </Card>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={conn.url}
      token={conn.token}
      connect
      audio
      video
      options={{ adaptiveStream: true, dynacast: true }}
      onDisconnected={() => { if (!leaving.current) setStage("ended"); }}
      onMediaDeviceFailure={() => setError("noDevices")}
      className={mini ? "" : "mx-auto max-w-5xl"}
    >
      <CallDecks value={decks}>
      <InCall
        roomId={roomId} role={role} otherName={otherName} consent={consent} clientId={clientId} linked={linked}
        liveOn={liveOn && liveAllowed}
        deviceError={error === "noDevices"}
        onLeave={(to) => {
          leaving.current = true;
          if (to) { reportActive.current?.(false); router.push(to); } else setStage("ended");
        }}
        back={back} mini={mini} callPath={callPath}
      />
      </CallDecks>
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

const TIMESLICE_MS = 10_000;

function InCall({ roomId, role, otherName, consent, clientId, linked, liveOn, deviceError, onLeave, back, mini, callPath }: {
  roomId: string; role: Role; otherName: string; consent: boolean; clientId?: string; linked: boolean;
  liveOn: boolean;
  deviceError: boolean; onLeave: (to: string | null) => void; back: string | null;
  mini: boolean; callPath?: string;
}) {
  const t = useTranslations("video");
  const tc = useTranslations("common");
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants({ updateOnlyOn: [
    RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantAttributesChanged, RoomEvent.ConnectionStateChanged,
  ] });
  // Client side: the therapist's screen tells everyone in the room when it records.
  const otherRecording = remotes.some((p) => p.attributes?.recording === "on");
  const otherPaused = remotes.some((p) => p.attributes?.recording === "paused");
  // Client side: the therapist is saving the call to their computer (ADR-24).
  const otherSaving = remotes.some((p) => p.attributes?.savecall === "on");
  const cams = useTracks([Track.Source.Camera]);
  const mics = useTracks([Track.Source.Microphone]);
  const remoteCam = cams.find((c) => !c.participant.isLocal);
  const localCam = cams.find((c) => c.participant.isLocal);
  const remoteMic = mics.find((m) => !m.participant.isLocal);
  const otherHere = remotes.length > 0;
  const remoteShare = useTracks([Track.Source.ScreenShare]).find((s) => !s.participant.isLocal);
  // Therapy tools shared on the call (ADR-21): opened by the therapist, used by both.
  const tools = useTools(role, roomId);
  const freshTool = useNewTool();
  // Blur or a picture behind your own camera, done in this browser.
  const bg = useBackground();

  // ── Recording for notes (therapist only) ────────────────────────────────
  const [rec, setRec] = useState<{ sessionId: string } | null>(null);
  const [recState, setRecState] = useState<"off" | "on" | "paused" | "waiting">("off");
  // The last recording finished during this call (its note is being prepared).
  const [finished, setFinished] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [recError, setRecError] = useState<"consent" | "failed" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const recorders = useRef<{ recorder: MediaRecorder; track: string; seq: number }[]>([]);
  const queue = useRef<UploadQueue | null>(null);
  const segment = useRef(0);
  const remoteTrackId = useRef<string | null>(null);
  // Live research mode: short clips next to the real recording (ADR-10).
  const clippers = useRef<LiveClipper[]>([]);
  const liveQueue = useRef<UploadQueue | null>(null);
  const [liveActive, setLiveActive] = useState(false);

  const stopRecorders = useCallback(async () => {
    const stopped = recorders.current.map(({ recorder }) => new Promise<void>((resolve) => {
      if (recorder.state === "inactive") return resolve();
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    }));
    recorders.current = [];
    clippers.current.forEach((c) => c.stop());
    clippers.current = [];
    await Promise.all(stopped);
  }, []);

  const startRecorders = useCallback((): boolean => {
    const mine = localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
    const theirs = (remoteMic as TrackReference | undefined)?.publication?.track?.mediaStreamTrack;
    if (!mine || !theirs) return false;
    const mimeType = pickMimeType();
    for (const [name, track] of [["mic", mine], ["tab", theirs]] as const) {
      const recorder = new MediaRecorder(new MediaStream([track]), { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 });
      const entry = { recorder, track: name, seq: 0 };
      const seg = segment.current;
      recorder.ondataavailable = (e) => queue.current?.push({ track: name, segment: seg, seq: entry.seq++, blob: e.data });
      recorder.start(TIMESLICE_MS);
      recorders.current.push(entry);
    }
    if (liveQueue.current) {
      const seg = segment.current;
      clippers.current = (["mic", "tab"] as const).map((name) => new LiveClipper(new MediaStream([name === "mic" ? mine : theirs]),
        (blob, seq) => liveQueue.current?.push({ track: `live_${name}`, segment: seg, seq, blob })));
      clippers.current.forEach((c) => c.start());
    }
    remoteTrackId.current = theirs.id;
    return true;
  }, [localParticipant, remoteMic]);

  const startRecording = useCallback(async () => {
    setRecError(null);
    setFinished(null);
    const res = await startVideoRecording(roomId).catch(() => ({ error: "failed" as const }));
    if ("error" in res) { setRecError(res.error === "consent" ? "consent" : "failed"); return; }
    const status = await fetch(`/api/sessions/${res.sessionId}/status`, { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    segment.current = Number(status.next_segment ?? 0);
    queue.current = new UploadQueue(res.sessionId, (s) => {
      if (s.fatal) { void stopRecorders(); setRecState("off"); setRecError(s.fatal === "consent_required" ? "consent" : "failed"); }
    });
    if (liveOn) {
      // A separate queue: if live clips fail, the real recording carries on untouched.
      const ok = await fetch(`/api/sessions/${res.sessionId}/live`, { method: "POST" }).then((r) => r.ok).catch(() => false);
      if (ok) {
        liveQueue.current = new UploadQueue(res.sessionId, (s) => { if (s.fatal) { clippers.current.forEach((c) => c.stop()); setLiveActive(false); } });
        setLiveActive(true);
      }
    }
    setRec({ sessionId: res.sessionId });
    setRecState(startRecorders() ? "on" : "waiting");
  }, [roomId, liveOn, startRecorders, stopRecorders]);

  /** Pause: nothing is recorded (or sent) until Resume. */
  function pauseRecording() {
    for (const { recorder } of recorders.current) if (recorder.state === "recording") recorder.pause();
    clippers.current.forEach((c) => c.stop());
    setRecState("paused");
  }

  function resumeRecording() {
    // The client's audio changed while paused (they dropped out and came back): start a new segment.
    if (!recorders.current.length || remoteId !== remoteTrackId.current) {
      void stopRecorders().then(() => {
        segment.current += 1;
        setRecState(startRecorders() ? "on" : "waiting");
      });
      return;
    }
    for (const { recorder } of recorders.current) if (recorder.state === "paused") recorder.resume();
    clippers.current.forEach((c) => c.start());
    setRecState("on");
  }

  /** Finish recording but stay in the call: the note starts being prepared now. */
  async function finishRecording(): Promise<string | null> {
    if (!rec) return null;
    setFinishing(true);
    await stopRecorders();
    await queue.current?.drain();
    await liveQueue.current?.drain();
    const res = await fetch(`/api/sessions/${rec.sessionId}/end`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ durationSeconds: elapsed }),
    }).catch(() => null);
    const done = res?.ok ? rec.sessionId : null;
    queue.current = null;
    liveQueue.current = null;
    setLiveActive(false);
    setRec(null);
    setRecState("off");
    setElapsed(0);
    setFinishing(false);
    setFinished(done);
    return done;
  }

  // Tell the other person's screen whether this session is being recorded.
  useEffect(() => {
    if (role !== "therapist") return;
    localParticipant.setAttributes({ recording: recState === "on" ? "on" : recState === "paused" ? "paused" : "off" }).catch(() => {});
  }, [role, recState, localParticipant]);

  // If the client drops out and comes back, both tracks restart together in a
  // new segment so they stay in step.
  const remoteId = (remoteMic as TrackReference | undefined)?.publication?.track?.mediaStreamTrack?.id ?? null;
  useEffect(() => {
    if (!rec || recState === "off") return;
    if (recState === "on" && remoteId !== remoteTrackId.current) {
      remoteTrackId.current = remoteId; // handle each change once
      void stopRecorders().then(() => {
        segment.current += 1;
        setRecState(startRecorders() ? "on" : "waiting");
      });
    } else if (recState === "waiting" && remoteId) {
      // The client's audio just arrived: start both recorders (outside the render pass).
      void Promise.resolve().then(() => setRecState(startRecorders() ? "on" : "waiting"));
    }
  }, [rec, recState, remoteId, startRecorders, stopRecorders]);

  useEffect(() => {
    if (recState !== "on") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recState]);

  useEffect(() => () => { void stopRecorders(); }, [stopRecorders]);

  // ── Screen sharing (either person; computers only, phones can watch) ─────
  // Only the shared picture and a shared tab's sound go to the other person;
  // recording for notes stays the two microphones.
  const canShare = !!navigator.mediaDevices?.getDisplayMedia;
  const [shareError, setShareError] = useState<"failed" | "system" | null>(null);
  async function toggleShare() {
    setShareError(null);
    if (isScreenShareEnabled) { await localParticipant.setScreenShareEnabled(false).catch(() => {}); return; }
    // Like Zoom or Teams: the browser's picker offers the entire screen (shown first),
    // any app window, or a single tab, and the choice can be switched while sharing.
    const opts = {
      video: { displaySurface: "monitor" }, audio: true, systemAudio: "exclude", selfBrowserSurface: "exclude", surfaceSwitching: "include", contentHint: "detail",
    } as const;
    try {
      await localParticipant.setScreenShareEnabled(true, opts).catch((err: Error) => {
        // Browsers that can't share sound with the picture (Safari): picture only.
        if (err?.name === "TypeError" || err?.name === "NotSupportedError") return localParticipant.setScreenShareEnabled(true, { ...opts, audio: false });
        throw err;
      });
    } catch (err) {
      const e = err as Error;
      const system = /system/i.test(e?.message ?? "");
      if (e?.name === "NotAllowedError" && !system) return; // they closed the picker
      setShareError(system ? "system" : "failed");
    }
  }

  const stage = useRef<HTMLDivElement>(null);
  const [fullScreen, setFullScreen] = useState(false);
  useEffect(() => {
    const onChange = () => setFullScreen(!!stage.current && document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  function toggleFullScreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void stage.current?.requestFullscreen().catch(() => {});
  }

  async function endSession() {
    setEnding(true);
    let to = back;
    const done = rec ? await finishRecording() : finished;
    if (done) to = `/sessions/${done}`;
    await endVideo(roomId).catch(() => {});
    forgetTools(roomId);
    onLeave(to);
  }

  function leave() {
    onLeave(back);
  }


  const minutes = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <>
    {mini && (
      <MiniCall otherName={otherName} callPath={callPath} remoteCam={remoteCam as TrackReference | undefined} otherHere={otherHere}
        recording={recState === "on" || recState === "paused" || (role === "client" && (otherRecording || otherPaused))} paused={recState === "paused" || otherPaused}
        time={recState !== "off" ? minutes : null}
        mic={isMicrophoneEnabled} onMic={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        cam={isCameraEnabled} onCam={() => localParticipant.setCameraEnabled(!isCameraEnabled)} />
    )}
    {/* Elsewhere in the app the full call stays in place, hidden, so recording, tools and sharing carry on. */}
    <div className={mini ? "hidden" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl">{t("with", { name: otherName })}</h1>
        {tools.tool && (
          // With a tool open, both cameras stay in view, small, beside the title (so the tool gets the height).
          <div className="order-last ml-auto flex gap-2">
            <div className="flex aspect-video h-16 items-center justify-center overflow-hidden rounded-xl border border-line bg-[#1E2421] sm:h-20">
              {remoteCam ? <VideoTrack trackRef={remoteCam as TrackReference} className="h-full w-full object-cover" />
                : <Arch mood={otherHere ? "listening" : "idle"} className="h-10 w-10" />}
            </div>
            {localCam && isCameraEnabled && (
              <div className="aspect-video h-16 overflow-hidden rounded-xl border border-line sm:h-20">
                <VideoTrack trackRef={localCam as TrackReference} className="h-full w-full -scale-x-100 object-cover" />
              </div>
            )}
          </div>
        )}
        {role === "client" && (otherRecording || otherPaused) && (
          <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
            <span className="breathing-dot" data-paused={otherPaused} /> {otherPaused ? t("recordingPausedOther", { name: otherName }) : t("beingRecorded", { name: otherName })}
          </p>
        )}
        {recState !== "off" && (
          <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
            <span className="breathing-dot" data-paused={recState !== "on"} />
            {recState === "on" ? `${t("recording")} · ${minutes}` : recState === "paused" ? `${t("recordingPaused")} · ${minutes}` : t("recordingWaiting", { name: otherName })}
          </p>
        )}
      </div>

      <div className={liveActive ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" : ""}>
      {tools.tool ? (
        // A tool takes the stage, sized to the screen so it's seen whole (the cameras are beside the title).
        <div>
          <div className="h-[clamp(440px,calc(100dvh-15rem),820px)] overflow-hidden rounded-panel border border-line bg-surface">
            <ToolStage tool={tools.tool} role={role} roomId={roomId} otherName={otherName} act={tools.act} set={tools.set}
              savedAt={tools.savedAt} notifySaved={tools.notifySaved} />
          </div>
        </div>
      ) : (
      <div ref={stage} className={`relative overflow-hidden rounded-panel border border-line bg-[#1E2421] [&:fullscreen]:rounded-none [&:fullscreen]:border-0 ${remoteShare ? "aspect-video" : "aspect-[3/4] sm:aspect-video"}`}>
        {remoteShare ? (
          // The other person's shared screen takes the stage, shown whole.
          <VideoTrack trackRef={remoteShare as TrackReference} className="h-full w-full object-contain" />
        ) : remoteCam ? (
          <VideoTrack trackRef={remoteCam as TrackReference} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <Arch mood={otherHere ? "listening" : "idle"} className="h-28 w-28" />
            <p className="max-w-xs text-[#E4E7E2]">{otherHere ? t("cameraOffOther", { name: otherName }) : t("waiting", { name: otherName })}</p>
          </div>
        )}
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2">
          {remoteShare && remoteCam && (
            <div className="w-24 overflow-hidden rounded-xl border border-white/20 shadow-lg sm:w-40">
              <VideoTrack trackRef={remoteCam as TrackReference} className="aspect-video w-full object-cover" />
            </div>
          )}
          {localCam && isCameraEnabled && (
            <div className={`overflow-hidden rounded-xl border border-white/20 shadow-lg ${remoteShare ? "w-24 sm:w-40" : "w-28 sm:w-48"}`}>
              <VideoTrack trackRef={localCam as TrackReference} className="aspect-video w-full -scale-x-100 object-cover" />
            </div>
          )}
        </div>
        {(recState === "on" || recState === "paused" || (role === "client" && (otherRecording || otherPaused))) && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white">
            <Arch mood={recState === "paused" || otherPaused ? "resting" : "listening"} className="h-6 w-6" /> {recState === "paused" || otherPaused ? t("recordingPaused") : t("recordingBadge")}
          </div>
        )}
        {(remoteShare || isScreenShareEnabled) && (
          <div className="absolute right-3 top-3 flex max-w-[70%] items-center gap-2 rounded-full bg-black/55 py-1 pl-3 pr-1 text-xs text-white" aria-live="polite">
            <ScreenShare size={14} className="shrink-0" aria-hidden />
            <span className="truncate py-1">{isScreenShareEnabled ? t("youAreSharing") : t("otherSharing", { name: otherName })}</span>
            {isScreenShareEnabled && (
              <button type="button" onClick={toggleShare} className="shrink-0 rounded-full bg-white/90 px-2.5 py-1 font-medium text-[#1E2421] hover:bg-white">{t("stopSharing")}</button>
            )}
          </div>
        )}
        {remoteShare && typeof document !== "undefined" && document.fullscreenEnabled && (
          <button type="button" onClick={toggleFullScreen} className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs text-white hover:bg-black/70">
            {fullScreen ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
            {fullScreen ? t("exitFullScreen") : t("fullScreen")}
          </button>
        )}
      </div>
      )}
      {liveActive && rec && <LivePanel sessionId={rec.sessionId} active={recState === "on"} />}
      </div>

      {role === "client" && <ClientSaveCall otherName={otherName} saving={otherSaving} />}
      {deviceError && <Notice tone="attention">{t("noDevices")}</Notice>}
      {recError === "consent" && (
        <Notice tone="attention">
          {t("consentNeeded")}{" "}
          {clientId && <Link href={`/clients/${clientId}/consent`} target="_blank" className="underline">{t("consentLink")}</Link>}
        </Notice>
      )}
      {recError === "failed" && <Notice tone="attention">{tc("somethingWrong")}</Notice>}
      {role === "therapist" && finished && recState === "off" && (
        <Notice tone="success">
          {t("recordingFinished")}{" "}
          <Link href={`/sessions/${finished}`} target="_blank" className="underline">{t("recordingFinishedLink")}</Link>
        </Notice>
      )}
      {shareError && <Notice tone="attention">{shareError === "system" ? t("shareBlocked") : t("shareFailed")}</Notice>}

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <Button variant="secondary" onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)} aria-pressed={!isMicrophoneEnabled}>
          {isMicrophoneEnabled ? <Mic size={18} aria-hidden /> : <MicOff size={18} aria-hidden />}
          <span className="sr-only sm:not-sr-only">{isMicrophoneEnabled ? t("mute") : t("unmute")}</span>
        </Button>
        <Button variant="secondary" onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)} aria-pressed={!isCameraEnabled}>
          {isCameraEnabled ? <Video size={18} aria-hidden /> : <VideoOff size={18} aria-hidden />}
          <span className="sr-only sm:not-sr-only">{isCameraEnabled ? t("cameraOff") : t("cameraOn")}</span>
        </Button>
        <BackgroundButton bg={bg} />
        {canShare && (
          <Button variant="secondary" onClick={toggleShare} aria-pressed={isScreenShareEnabled} disabled={!!remoteShare && !isScreenShareEnabled}>
            {isScreenShareEnabled ? <ScreenShareOff size={18} aria-hidden /> : <ScreenShare size={18} aria-hidden />}
            <span className="sr-only sm:not-sr-only">{isScreenShareEnabled ? t("stopSharing") : t("shareScreen")}</span>
          </Button>
        )}
        {role === "therapist" && (
          <ToolMenu open={tools.tool?.kind ?? null} onOpen={(kind) => tools.open(kind, () => freshTool(kind))} onClose={() => tools.set(null)} />
        )}
        {role === "therapist" && recState === "off" && (
          <Button variant="secondary" onClick={startRecording} disabled={!consent || finishing} title={!otherHere ? t("recordNeedsClient") : undefined}>
            <Circle size={16} className="fill-current text-destructive" aria-hidden /> {t("record")}
          </Button>
        )}
        {role === "therapist" && recState === "on" && (
          <Button variant="secondary" onClick={pauseRecording}><Pause size={16} aria-hidden /> {t("pauseRecording")}</Button>
        )}
        {role === "therapist" && recState === "paused" && (
          <Button variant="secondary" onClick={resumeRecording}><Play size={16} aria-hidden /> {t("resumeRecording")}</Button>
        )}
        {role === "therapist" && recState !== "off" && (
          <Button variant="secondary" onClick={() => void finishRecording()} disabled={finishing}>
            <Square size={14} className="fill-current" aria-hidden /> {finishing ? t("finishingRecording") : t("finishRecording")}
          </Button>
        )}
        {role === "therapist" && <TherapistSaveCall roomId={roomId} otherName={otherName} />}
        {role === "therapist" ? (
          <Button onClick={() => setConfirmEnd(true)} disabled={ending}><PhoneOff size={18} aria-hidden /> {t("end")}</Button>
        ) : (
          <Button onClick={leave}><PhoneOff size={18} aria-hidden /> {t("leave")}</Button>
        )}
      </div>
      {role === "therapist" && !consent && recState === "off" && <p className="text-center text-sm text-muted">{t("consentHint")}</p>}
      {role === "therapist" && !otherHere && <div className="mx-auto max-w-xl"><JoinOptions roomId={roomId} clientName={otherName} linked={linked} /></div>}

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd} title={t("end")} description={rec ? t("endConfirmRecording") : t("endConfirm")}>
        <div className="flex gap-2">
          <Button onClick={endSession} disabled={ending}>{ending ? t("ending") : t("end")}</Button>
          <Button variant="ghost" onClick={() => setConfirmEnd(false)}>{tc("cancel")}</Button>
        </div>
      </Dialog>
    </div>
    </>
  );
}

/** The call, small in a corner, while the person is on another page of the app. */
function MiniCall({ otherName, callPath, remoteCam, otherHere, recording, paused, time, mic, onMic, cam, onCam }: {
  otherName: string; callPath?: string; remoteCam?: TrackReference; otherHere: boolean;
  recording: boolean; paused: boolean; time: string | null;
  mic: boolean; onMic: () => void; cam: boolean; onCam: () => void;
}) {
  const t = useTranslations("video");
  return (
    <section aria-label={t("callContinues", { name: otherName })} className="fade-up overflow-hidden rounded-card border border-line bg-surface shadow-[var(--shadow)]">
      <div className="relative aspect-video bg-[#1E2421]">
        {remoteCam ? <VideoTrack trackRef={remoteCam} className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center"><Arch mood={otherHere ? "listening" : "idle"} className="h-16 w-16" /></div>}
        {recording && (
          <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs text-white">
            <span className="breathing-dot" data-paused={paused} /> {paused ? t("recordingPaused") : t("recordingBadge")}{time ? ` · ${time}` : ""}
          </span>
        )}
        <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/45 px-2.5 py-1 text-xs text-white">{t("callContinues", { name: otherName })}</span>
      </div>
      <div className="flex items-center justify-end gap-1.5 p-2">
        <Button size="sm" variant="secondary" onClick={onMic} aria-pressed={!mic} aria-label={mic ? t("mute") : t("unmute")} title={mic ? t("mute") : t("unmute")} className="px-2.5">
          {mic ? <Mic size={16} aria-hidden /> : <MicOff size={16} aria-hidden />}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCam} aria-pressed={!cam} aria-label={cam ? t("cameraOff") : t("cameraOn")} title={cam ? t("cameraOff") : t("cameraOn")} className="px-2.5">
          {cam ? <Video size={16} aria-hidden /> : <VideoOff size={16} aria-hidden />}
        </Button>
        {callPath && (
          <Link href={callPath} className={buttonClass("primary", "sm", "px-3")}>
            <CornerUpLeft size={15} aria-hidden /> {t("returnToCall")}
          </Link>
        )}
      </div>
    </section>
  );
}
