// Sends recorded audio pieces to the server one at a time, in order, retrying
// gently if the network drops. Pieces wait in memory until they are saved.

export type Piece = { track: string; segment: number; seq: number; blob: Blob };
export type QueueState = { pending: number; behind: boolean; fatal: string | null };

export class UploadQueue {
  private pending: Piece[] = [];
  private running = false;
  private failures = 0;
  private fatal: string | null = null;

  constructor(private sessionId: string, private onState: (s: QueueState) => void) {}

  push(piece: Piece) {
    if (piece.blob.size === 0) return;
    this.pending.push(piece);
    this.emit();
    void this.run();
  }

  get size() { return this.pending.length; }

  /** Resolves when everything recorded so far has been saved. */
  async drain(timeoutMs = 120_000) {
    const start = Date.now();
    while ((this.pending.length || this.running) && !this.fatal && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 250));
    }
    return this.pending.length === 0;
  }

  private emit() {
    this.onState({ pending: this.pending.length, behind: this.failures > 0 || this.pending.length > 3, fatal: this.fatal });
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    while (this.pending.length && !this.fatal) {
      const p = this.pending[0];
      try {
        const res = await fetch(
          `/api/sessions/${this.sessionId}/chunks?track=${p.track}&segment=${p.segment}&seq=${p.seq}`,
          { method: "POST", body: p.blob, headers: { "content-type": p.blob.type || "application/octet-stream" } },
        );
        if (res.status === 403 || res.status === 409 || res.status === 401) {
          this.fatal = (await res.json().catch(() => ({}))).error ?? "rejected";
          break;
        }
        if (!res.ok) throw new Error(String(res.status));
        this.pending.shift();
        this.failures = 0;
      } catch {
        this.failures++;
        this.emit();
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** Math.min(this.failures, 5))));
      }
      this.emit();
    }
    this.running = false;
    this.emit();
  }
}
