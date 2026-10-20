import { notFound } from "next/navigation";
import { devLoginEnabled } from "@/lib/dev-login";
import { Arch, type ArchMood } from "@/components/arch";

// Local development only: every mood of Arch side by side.
const MOODS: ArchMood[] = ["idle", "listening", "transcribing", "curious", "writing", "thinking", "done", "celebrate", "resting", "hello"];

export default function ArchGallery() {
  if (!devLoginEnabled()) notFound();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl">Arch moods</h1>
      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-5">
        {MOODS.map((m) => (
          <li key={m} className="flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-4">
            <Arch mood={m} alive={m === "idle"} className="h-32 w-32" />
            <span className="text-sm text-muted">{m}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
