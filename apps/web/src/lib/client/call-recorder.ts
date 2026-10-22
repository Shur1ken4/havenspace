// "Save to my computer" (ADR-24): records the video call in the therapist's own
// browser and hands them the file. Nothing is uploaded; HavenSpace never holds it.
//
// The picture is drawn into one canvas: the other person's camera (or a shared
// screen) large, the therapist's own camera small in the corner. Both voices
// (and a shared tab's sound) are mixed into one track.

export type CallSources = {
  /** Shown large: a shared screen, else the other person's camera. */
  main: MediaStreamTrack | null;
  /** Shown small in the corner: the therapist's own camera. */
  small: MediaStreamTrack | null;
  audio: MediaStreamTrack[];
};

const W = 1280, H = 720, FPS = 25;

const MIME_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"];
export const callRecordingSupported = () =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function"
  && MIME_TYPES.some((m) => MediaRecorder.isTypeSupported(m));

export class CallRecorder {
  private canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d")!;
  private audio = new AudioContext();
  private dest = this.audio.createMediaStreamDestination();
  private silence = this.audio.createConstantSource();
  private inputs = new Map<string, MediaStreamAudioSourceNode>();
  private videos = new Map<string, HTMLVideoElement>();
  private sources: CallSources = { main: null, small: null, audio: [] };
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  private ticker: Worker;
  readonly mimeType: string;
  readonly startedAt = Date.now();

  constructor(private placeholder: string) {
    this.canvas.width = W;
    this.canvas.height = H;
    this.mimeType = MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m))!;
    // Silence underneath the voices: with no microphone on, the sound track would
    // otherwise stay empty, and the browser then writes no video at all.
    this.silence.offset.value = 0;
    this.silence.connect(this.dest);
    this.silence.start();
    const stream = new MediaStream([...this.canvas.captureStream(FPS).getVideoTracks(), ...this.dest.stream.getAudioTracks()]);
    this.recorder = new MediaRecorder(stream, { mimeType: this.mimeType, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 96_000 });
    this.recorder.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    // A worker keeps the drawing going even when the therapist switches to another
    // tab (the browser slows timers on the page itself, not in workers).
    const code = `setInterval(() => postMessage(0), ${Math.round(1000 / FPS)});`;
    this.ticker = new Worker(URL.createObjectURL(new Blob([code], { type: "text/javascript" })));
    this.ticker.onmessage = () => this.draw();
  }

  start() {
    void this.audio.resume();
    this.draw();
    this.recorder.start(5000);
  }

  /** Call whenever the people, cameras or shared screen change. */
  setSources(next: CallSources) {
    this.sources = next;
    const want = new Set([next.main, next.small].filter(Boolean).map((t) => t!.id));
    for (const [id, v] of this.videos) if (!want.has(id)) { v.srcObject = null; this.videos.delete(id); }
    for (const t of [next.main, next.small]) {
      if (!t || this.videos.has(t.id)) continue;
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.srcObject = new MediaStream([t]);
      void v.play().catch(() => {});
      this.videos.set(t.id, v);
    }
    const audioIds = new Set(next.audio.map((t) => t.id));
    for (const [id, node] of this.inputs) if (!audioIds.has(id)) { node.disconnect(); this.inputs.delete(id); }
    for (const t of next.audio) {
      if (this.inputs.has(t.id) || t.readyState === "ended") continue;
      const node = this.audio.createMediaStreamSource(new MediaStream([t]));
      node.connect(this.dest);
      this.inputs.set(t.id, node);
    }
  }

  private frame(t: MediaStreamTrack | null) {
    const v = t ? this.videos.get(t.id) : undefined;
    return v && v.readyState >= 2 && v.videoWidth ? v : null;
  }

  private draw() {
    const c = this.ctx;
    c.fillStyle = "#1E2421";
    c.fillRect(0, 0, W, H);
    const main = this.frame(this.sources.main);
    if (main) {
      // Whole picture, letterboxed.
      const s = Math.min(W / main.videoWidth, H / main.videoHeight);
      const w = main.videoWidth * s, h = main.videoHeight * s;
      c.drawImage(main, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      c.fillStyle = "#E4E7E2";
      c.font = "28px Inter, system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(this.placeholder, W / 2, H / 2);
    }
    const small = this.frame(this.sources.small);
    if (small) {
      const w = 288, h = 162, x = W - w - 24, y = H - h - 24;
      // Fill the corner box (cropped), mirrored like the therapist sees themselves.
      const s = Math.max(w / small.videoWidth, h / small.videoHeight);
      const sw = w / s, sh = h / s;
      c.save();
      c.beginPath();
      c.roundRect(x, y, w, h, 12);
      c.clip();
      c.translate(x + w, y);
      c.scale(-1, 1);
      c.drawImage(small, (small.videoWidth - sw) / 2, (small.videoHeight - sh) / 2, sw, sh, 0, 0, w, h);
      c.restore();
    }
  }

  /** Stops and returns the finished file. */
  async stop(): Promise<{ blob: Blob; ext: "webm" | "mp4" }> {
    if (this.recorder.state !== "inactive") {
      await new Promise<void>((resolve) => { this.recorder.addEventListener("stop", () => resolve(), { once: true }); this.recorder.stop(); });
    }
    this.ticker.terminate();
    this.silence.stop();
    for (const node of this.inputs.values()) node.disconnect();
    for (const v of this.videos.values()) v.srcObject = null;
    void this.audio.close().catch(() => {});
    const type = this.mimeType.split(";")[0];
    return { blob: new Blob(this.chunks, { type }), ext: type === "video/mp4" ? "mp4" : "webm" };
  }
}

/** Hands the file to the browser as a download (it goes to the Downloads folder). */
export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
