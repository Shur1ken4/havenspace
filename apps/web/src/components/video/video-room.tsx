"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Circle } from "lucide-react";
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

type Role = "therapist" | "client";
type Stage = "lobby" | "joining" | "in" | "ended" | "error";

/**
 * A video session inside HavenSpace (ADR-17). LiveKit carries the call; the screen
 * is ours. The therapist can record for notes: their microphone and the client's
 * audio are saved as two separate tracks, exactly like an online-call recording.
 */
export function VideoRoom({ roomId, role, otherName, clientId, consent = false, linked = false, guestToken, liveAllowed = false }: {
  roomId: string; role: Role; otherName: string; clientId?: string; consent?: boolean;
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
  // Therapist's choices before joining: record automatically, live suggestions (research).
  const [autoRecord, setAutoRecord] = useState(consent);
  const [liveOn, setLiveOn] = useState(false);
  const leaving = useRef(false);

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
            <label className={`flex gap-3 ${consent ? "cursor-pointer" : "opacity-70"}`}>
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary-strong)]" checked={autoRecord && consent} disabled={!consent} onChange={(e) => setAutoRecord(e.target.checked)} />
              <span className="space-y-0.5">
                <span className="block font-medium text-ink">{t("autoRecord", { name: otherName })}</span>
                <span className="block text-sm text-muted">{consent ? t("autoRecordHint", { name: otherName }) : t("autoRecordNoConsent", { name: otherName })}</span>
              </span>
            </label>
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
      className="mx-auto max-w-5xl"
    >
      <InCall
        roomId={roomId} role={role} otherName={otherName} consent={consent} clientId={clientId} linked={linked}
        autoRecord={autoRecord && consent} liveOn={liveOn && liveAllowed}
        deviceError={error === "noDevices"}
        onLeave={(to) => { leaving.current = true; if (to) router.push(to); else setStage("ended"); }}
        back={back}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

const TIMESLICE_MS = 10_000;

function InCall({ roomId, role, otherName, consent, clientId, linked, autoRecord, liveOn, deviceError, onLeave, back }: {
  roomId: string; role: Role; otherName: string; consent: boolean; clientId?: string; linked: boolean;
  autoRecord: boolean; liveOn: boolean;
  deviceError: boolean; onLeave: (to: string | null) => void; back: string | null;
}) {
  const t = useTranslations("video");
  const tc = useTranslations("common");
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants({ updateOnlyOn: [
    RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantAttributesChanged, RoomEvent.ConnectionStateChanged,
  ] });
  // Client side: the therapist's screen tells everyone in the room when it records.
  const otherRecording = remotes.some((p) => p.attributes?.recording === "on");
  const cams = useTracks([Track.Source.Camera]);
  const mics = useTracks([Track.Source.Microphone]);
  const remoteCam = cams.find((c) => !c.participant.isLocal);
  const localCam = cams.find((c) => c.participant.isLocal);
  const remoteMic = mics.find((m) => !m.participant.isLocal);
  const otherHere = remotes.length > 0;

  // ── Recording for notes (therapist only) ────────────────────────────────
  const [rec, setRec] = useState<{ sessionId: string } | null>(null);
  const [recState, setRecState] = useState<"off" | "on" | "waiting">("off");
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

  // "Record automatically": start as soon as the therapist is in the room; the
  // recorders themselves wait for the client's audio, so recording begins when
  // the client joins.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (role !== "therapist" || !autoRecord || autoStarted.current) return;
    autoStarted.current = true;
    void Promise.resolve().then(startRecording);
  }, [role, autoRecord, startRecording]);

  // Tell the other person's screen whether this session is being recorded.
  useEffect(() => {
    if (role !== "therapist") return;
    localParticipant.setAttributes({ recording: recState === "on" ? "on" : "off" }).catch(() => {});
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

  async function endSession() {
    setEnding(true);
    let to = back;
    if (rec) {
      await stopRecorders();
      await queue.current?.drain();
      const res = await fetch(`/api/sessions/${rec.sessionId}/end`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ durationSeconds: elapsed }),
      }).catch(() => null);
      if (res?.ok) to = `/sessions/${rec.sessionId}`;
    }
    await endVideo(roomId).catch(() => {});
    onLeave(to);
  }

  function leave() {
    onLeave(back);
  }


  const minutes = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl">{t("with", { name: otherName })}</h1>
        {role === "client" && otherRecording && (
          <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
            <span className="breathing-dot" /> {t("beingRecorded", { name: otherName })}
          </p>
        )}
        {recState !== "off" && (
          <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
            <span className="breathing-dot" data-paused={recState !== "on"} />
            {recState === "on" ? `${t("recording")} · ${minutes}` : t("recordingWaiting", { name: otherName })}
          </p>
        )}
      </div>

      <div className={liveActive ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" : ""}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-panel border border-line bg-[#1E2421] sm:aspect-video">
        {remoteCam ? (
          <VideoTrack trackRef={remoteCam as TrackReference} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <Arch mood={otherHere ? "listening" : "idle"} className="h-28 w-28" />
            <p className="max-w-xs text-[#E4E7E2]">{otherHere ? t("cameraOffOther", { name: otherName }) : t("waiting", { name: otherName })}</p>
          </div>
        )}
        {localCam && isCameraEnabled && (
          <div className="absolute bottom-3 right-3 w-28 overflow-hidden rounded-xl border border-white/20 shadow-lg sm:w-48">
            <VideoTrack trackRef={localCam as TrackReference} className="aspect-video w-full -scale-x-100 object-cover" />
          </div>
        )}
        {(recState === "on" || (role === "client" && otherRecording)) && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white">
            <Arch mood="listening" className="h-6 w-6" /> {t("recordingBadge")}
          </div>
        )}
      </div>
      {liveActive && rec && <LivePanel sessionId={rec.sessionId} active={recState === "on"} />}
      </div>

      {deviceError && <Notice tone="attention">{t("noDevices")}</Notice>}
      {recError === "consent" && (
        <Notice tone="attention">
          {t("consentNeeded")}{" "}
          {clientId && <Link href={`/clients/${clientId}/consent`} target="_blank" className="underline">{t("consentLink")}</Link>}
        </Notice>
      )}
      {recError === "failed" && <Notice tone="attention">{tc("somethingWrong")}</Notice>}

      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <Button variant="secondary" onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)} aria-pressed={!isMicrophoneEnabled}>
          {isMicrophoneEnabled ? <Mic size={18} aria-hidden /> : <MicOff size={18} aria-hidden />}
          <span className="hidden sm:inline">{isMicrophoneEnabled ? t("mute") : t("unmute")}</span>
        </Button>
        <Button variant="secondary" onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)} aria-pressed={!isCameraEnabled}>
          {isCameraEnabled ? <Video size={18} aria-hidden /> : <VideoOff size={18} aria-hidden />}
          <span className="hidden sm:inline">{isCameraEnabled ? t("cameraOff") : t("cameraOn")}</span>
        </Button>
        {role === "therapist" && recState === "off" && (
          <Button variant="secondary" onClick={startRecording} disabled={!consent} title={!otherHere ? t("recordNeedsClient") : undefined}>
            <Circle size={16} className="text-destructive" aria-hidden /> {t("record")}
          </Button>
        )}
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
  );
}
