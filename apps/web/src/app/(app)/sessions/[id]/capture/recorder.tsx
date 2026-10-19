"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pause, Play, Square, Headphones, MonitorSpeaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Notice } from "@/components/ui/notice";
import { Dialog } from "@/components/ui/dialog";
import { levelMeter, pickMimeType, recordClip } from "@/lib/client/audio";
import { canCaptureTabAudio, isMac } from "@/lib/client/browser";
import { UploadQueue, type QueueState } from "@/lib/client/upload-queue";
import { LiveClipper } from "@/lib/client/live";
import { Arch } from "@/components/arch";
import { LivePanel } from "./live-panel";

type Mode = "online_call" | "in_person";
type Phase = "setup" | "calibrate" | "recording" | "paused" | "ending" | "error";
type Track = { name: "mic" | "tab" | "room"; stream: MediaStream; recorder: MediaRecorder; seq: number };

const TIMESLICE_MS = 10_000;

function formatTime(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm text-muted"><span>{label}</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export function Recorder({ sessionId, mode, hasSavedVoice, interrupted, liveAllowed }: {
  sessionId: string; mode: Mode; hasSavedVoice: boolean; interrupted: boolean; liveAllowed: boolean;
}) {
  const t = useTranslations("session");
  const tc = useTranslations("common");
  const tk = useTranslations("consent");
  const tl = useTranslations("live");
  const a = useTranslations("arch");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [queue, setQueue] = useState<QueueState>({ pending: 0, behind: false, fatal: null });
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [liveOn, setLiveOn] = useState(false);
  // Known only in the browser; the server renders without the Mac hint.
  const onMac = useSyncExternalStore(() => () => {}, isMac, () => false);

  const tracks = useRef<Track[]>([]);
  const extraStreams = useRef<MediaStream[]>([]);
  const meters = useRef<(() => void)[]>([]);
  const uploader = useRef<UploadQueue | null>(null);
  const segment = useRef(0);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const clippers = useRef<LiveClipper[]>([]);
  const liveQueue = useRef<UploadQueue | null>(null);

  useEffect(() => {
    uploader.current = new UploadQueue(sessionId, (state) => {
      setQueue(state);
      // The server rejected the recording (e.g. consent was withdrawn): stop at once.
      if (state.fatal) {
        stopRef.current();
        setError(state.fatal === "consent_required" ? "consent" : "rejected");
        setPhase("error");
      }
    });
  }, [sessionId]);

  // Warn before closing the tab while recording.
  useEffect(() => {
    if (phase !== "recording" && phase !== "paused" && phase !== "ending") return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const stopEverything = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    clippers.current.forEach((c) => c.stop());
    meters.current.forEach((stop) => stop());
    meters.current = [];
    for (const tr of tracks.current) {
      if (tr.recorder.state !== "inactive") tr.recorder.stop();
      tr.stream.getTracks().forEach((x) => x.stop());
    }
    extraStreams.current.forEach((s) => s.getTracks().forEach((x) => x.stop()));
    wakeLock.current?.release().catch(() => {});
  }, []);

  const stopRef = useRef(stopEverything);
  useEffect(() => { stopRef.current = stopEverything; }, [stopEverything]);
  useEffect(() => stopEverything, [stopEverything]);

  async function nextSegment() {
    const res = await fetch(`/api/sessions/${sessionId}/status`, { cache: "no-store" });
    const data = await res.json();
    return Number(data.next_segment ?? 0);
  }

  function addTrack(name: Track["name"], stream: MediaStream) {
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 });
    const tr: Track = { name, stream, recorder, seq: 0 };
    recorder.ondataavailable = (e) => {
      uploader.current?.push({ track: name, segment: segment.current, seq: tr.seq++, blob: e.data });
    };
    tracks.current.push(tr);
    clippers.current.push(new LiveClipper(stream, (blob, seq) => {
      liveQueue.current?.push({ track: `live_${name}`, segment: segment.current, seq, blob });
    }));
    meters.current.push(levelMeter(stream, (l) => setLevels((prev) => ({ ...prev, [name]: l }))));
  }

  async function prepare() {
    setError(null);
    try {
      segment.current = await nextSegment();
      if (mode === "online_call") {
        if (!canCaptureTabAudio()) { setError("browser"); return; }
        const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        let display: MediaStream;
        try {
          display = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            // Chrome-specific hints: offer tabs first, include system audio on Windows.
            ...({ preferCurrentTab: false, selfBrowserSurface: "exclude", systemAudio: "include", surfaceSwitching: "include" } as object),
          } as DisplayMediaStreamOptions);
        } catch {
          mic.getTracks().forEach((x) => x.stop());
          setError("tab");
          return;
        }
        const tabAudio = display.getAudioTracks();
        if (tabAudio.length === 0) {
          display.getTracks().forEach((x) => x.stop());
          mic.getTracks().forEach((x) => x.stop());
          setError("tab");
          return;
        }
        // The video track must stay alive for the share to continue; we never record it.
        extraStreams.current.push(display);
        addTrack("mic", mic);
        addTrack("tab", new MediaStream(tabAudio));
        tabAudio[0].addEventListener("ended", () => setError("tabEnded"));
        begin();
      } else {
        const room = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
        addTrack("room", room);
        setPhase("calibrate");
      }
    } catch {
      setError("mic");
    }
  }

  async function calibrate() {
    setCalibrating(true);
    try {
      const clip = await recordClip(4);
      uploader.current?.push({ track: "calibration", segment: segment.current, seq: 0, blob: clip });
    } catch { /* fall back to saved voice or clustering */ }
    setCalibrating(false);
    begin();
  }

  async function startLive() {
    if (!liveOn) return;
    const res = await fetch(`/api/sessions/${sessionId}/live`, { method: "POST" }).catch(() => null);
    if (!res?.ok) { setLiveOn(false); return; }
    // A separate queue: if live clips fail, the real recording carries on untouched.
    liveQueue.current = new UploadQueue(sessionId, (state) => {
      if (state.fatal) { clippers.current.forEach((c) => c.stop()); setLiveOn(false); }
    });
    clippers.current.forEach((c) => c.start());
  }

  async function begin() {
    for (const tr of tracks.current) tr.recorder.start(TIMESLICE_MS);
    void startLive();
    setPhase("recording");
    tick.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    try { wakeLock.current = await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
  }

  function pause() {
    for (const tr of tracks.current) if (tr.recorder.state === "recording") tr.recorder.pause();
    clippers.current.forEach((c) => c.stop());
    if (tick.current) clearInterval(tick.current);
    setPhase("paused");
  }

  function resume() {
    for (const tr of tracks.current) if (tr.recorder.state === "paused") tr.recorder.resume();
    if (liveOn) clippers.current.forEach((c) => c.start());
    tick.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    setPhase("recording");
  }

  async function end() {
    setConfirmEnd(false);
    setPhase("ending");
    const stopped = tracks.current.map((tr) => new Promise<void>((resolve) => {
      if (tr.recorder.state === "inactive") return resolve();
      tr.recorder.addEventListener("stop", () => resolve(), { once: true });
    }));
    stopEverything();
    await Promise.all(stopped);
    await uploader.current?.drain();
    const res = await fetch(`/api/sessions/${sessionId}/end`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ durationSeconds: elapsed }),
    });
    if (res.ok) router.push(`/sessions/${sessionId}`);
    else { setError("end"); setPhase("error"); }
  }

  async function endInterrupted() {
    setPhase("ending");
    const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    if (res.ok) router.push(`/sessions/${sessionId}`);
    else { setError("end"); setPhase("error"); }
  }

  const errorText: Record<string, string> = {
    mic: t("micDenied"), tab: t("tabNoAudio"), tabEnded: t("tabNoAudio"), browser: t("browserCheckFail"),
    consent: tk("required"), rejected: tc("somethingWrong"), end: tc("somethingWrong"),
  };

  // ── Setup ────────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <Card className="mx-auto max-w-2xl space-y-5 sm:p-8">
        {interrupted && (
          <Notice tone="attention" title={t("recoverTitle")}>
            <p>{t("recoverBody")}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={endInterrupted}>{t("end")}</Button>
          </Notice>
        )}
        {mode === "online_call" ? (
          <>
            <h2 className="text-2xl">{t("onlineSteps")}</h2>
            <ol className="list-decimal space-y-2 pl-5 text-ink">
              <li>{t("onlineStep1")}</li>
              <li><Headphones size={16} className="mr-1 inline" aria-hidden />{t("onlineStep2")}</li>
              <li><MonitorSpeaker size={16} className="mr-1 inline" aria-hidden />{t("onlineStep3")}</li>
            </ol>
            {onMac && <p className="text-sm text-muted">{t("macZoomHint")}</p>}
          </>
        ) : (
          <p className="text-muted">{t("mode_in_person_body")}</p>
        )}
        {liveAllowed && !interrupted && (
          <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-4">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" checked={liveOn} onChange={(e) => setLiveOn(e.target.checked)} />
            <span className="space-y-1">
              <span className="flex flex-wrap items-center gap-2 font-medium text-ink">{tl("toggle")} <Chip tone="amber">{tl("badge")}</Chip></span>
              <span className="block text-sm text-muted">{tl("toggleBody")}</span>
            </span>
          </label>
        )}
        {error && <Notice tone="attention">{errorText[error]}</Notice>}
        <Button size="lg" onClick={prepare}>{interrupted ? t("continueRecording") : mode === "online_call" ? t("chooseTab") : t("begin")}</Button>
      </Card>
    );
  }

  // ── Voice check (in the room) ────────────────────────────────────────────
  if (phase === "calibrate") {
    return (
      <Card className="mx-auto max-w-2xl space-y-5 sm:p-8">
        <h2 className="text-2xl">{t("calibrateTitle")}</h2>
        <p className="text-muted">{t("calibrateBody")}</p>
        <Meter label={t("room")} value={levels.room ?? 0} color="var(--primary)" />
        <div className="flex flex-wrap gap-3">
          <Button onClick={calibrate} disabled={calibrating}>{calibrating ? <><span className="breathing-dot" /> …</> : t("begin")}</Button>
          {hasSavedVoice && <Button variant="secondary" onClick={begin} disabled={calibrating}>{t("calibrateSkip")}</Button>}
        </div>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card className="mx-auto max-w-2xl space-y-4">
        <Notice tone="attention">{errorText[error ?? "rejected"]}</Notice>
        <Button variant="secondary" onClick={() => router.push(`/sessions/${sessionId}`)}>{tc("continue")}</Button>
      </Card>
    );
  }

  // ── Recording ────────────────────────────────────────────────────────────
  const recording = (
    <Card className={liveOn ? "space-y-8 py-10 text-center sm:p-10" : "space-y-8 py-10 text-center sm:p-12"}>
      <div className="flex flex-col items-center gap-2">
        <Arch mood={phase === "recording" ? "listening" : phase === "ending" ? "working" : "resting"} className="h-20 w-20" />
        <div className="flex items-center justify-center gap-3">
          <span className="breathing-dot" data-paused={phase !== "recording"} />
          <span className="text-muted" aria-live="polite">{phase === "paused" ? t("paused") : phase === "ending" ? t("uploading") : t("recordingTitle")}</span>
        </div>
        <span className="text-sm text-muted">{a(phase === "recording" ? "recListening" : phase === "ending" ? "recEnding" : "recPaused")}</span>
      </div>
      <p className="font-serif text-7xl tabular-nums text-ink sm:text-8xl" aria-label={t("elapsed")}>{formatTime(elapsed)}</p>
      <div className="mx-auto grid max-w-md gap-4 text-left">
        {mode === "online_call" ? (
          <>
            <Meter label={t("you")} value={levels.mic ?? 0} color="var(--primary)" />
            <Meter label={t("client")} value={levels.tab ?? 0} color="var(--calm-blue)" />
          </>
        ) : (
          <Meter label={t("room")} value={levels.room ?? 0} color="var(--primary)" />
        )}
      </div>
      {error === "tabEnded" && <Notice tone="attention">{t("tabNoAudio")}</Notice>}
      <div className="flex flex-wrap justify-center gap-3">
        {phase === "recording" && <Button variant="secondary" size="lg" onClick={pause}><Pause size={18} aria-hidden /> {t("pause")}</Button>}
        {phase === "paused" && <Button variant="secondary" size="lg" onClick={resume}><Play size={18} aria-hidden /> {t("resume")}</Button>}
        <Button size="lg" onClick={() => setConfirmEnd(true)} disabled={phase === "ending"}><Square size={16} aria-hidden /> {t("end")}</Button>
      </div>
      <div className="text-sm text-muted">
        {queue.behind ? <Chip tone="amber">{t("uploadBehind")}</Chip> : queue.pending === 0 && elapsed > 12 ? <Chip tone="plain">{t("uploadSaved")}</Chip> : null}
      </div>
      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd} title={t("end")} description={t("endConfirm")}>
        <div className="flex gap-2">
          <Button onClick={end}>{t("end")}</Button>
          <Button variant="ghost" onClick={() => setConfirmEnd(false)}>{tc("cancel")}</Button>
        </div>
      </Dialog>
    </Card>
  );
  if (!liveOn) return <div className="mx-auto max-w-2xl">{recording}</div>;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {recording}
      <LivePanel sessionId={sessionId} active={phase === "recording" || phase === "paused"} />
    </div>
  );
}
