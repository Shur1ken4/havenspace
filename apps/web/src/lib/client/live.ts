// Live research mode (ADR-10): records short, self-contained clips next to the
// normal recording, so the worker can transcribe each one on its own straight
// away. Restarting the recorder gives every clip its own file header.

export const LIVE_CLIP_MS = 8000; // must match LIVE_CLIP_MS in services/worker/worker/config.py

export class LiveClipper {
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seq = 0;

  constructor(private stream: MediaStream, private onClip: (blob: Blob, seq: number) => void) {}

  start() {
    if (this.timer) return;
    this.open();
    this.timer = setInterval(() => { this.flush(); this.open(); }, LIVE_CLIP_MS);
  }

  /** Sends what has been heard so far and stops listening (pause / end). */
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.flush();
  }

  private open() {
    if (this.stream.getAudioTracks().every((t) => t.readyState === "ended")) return;
    const types = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(this.stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 });
    const seq = this.seq++;
    rec.ondataavailable = (e) => { if (e.data.size) this.onClip(e.data, seq); };
    rec.start();
    this.recorder = rec;
  }

  private flush() {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = null;
  }
}
