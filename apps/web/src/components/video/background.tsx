"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ImagePlus, Sparkles } from "lucide-react";
import { Track, type LocalVideoTrack } from "livekit-client";
import { useLocalParticipant } from "@livekit/components-react";
import { Button } from "@/components/ui/button";

/**
 * Background for your own camera, as in Zoom: soft or strong blur, one of our calm
 * pictures, or your own. It all happens in this browser (MediaPipe, served from our
 * site); only the finished picture goes into the call. Your own picture stays on
 * this device and is never uploaded.
 */
export const BACKGROUNDS = ["warm", "sage", "window", "evening"] as const;
type Choice = { kind: "none" } | { kind: "blur"; strength: "light" | "strong" } | { kind: "image"; id: (typeof BACKGROUNDS)[number] } | { kind: "own" };

const CHOICE_KEY = "hs-video-bg";
const OWN_KEY = "hs-video-bg-own";
const BLUR = { light: 8, strong: 22 } as const;
const PROCESSOR_NAME = "hs-background";
const ASSETS = { tasksVisionFileSet: "/vendor/mediapipe/wasm", modelAssetPath: "/vendor/mediapipe/selfie_segmenter.tflite" };

// A remembered choice is a convenience for this viewer only; anything odd means "no background".
function readChoice(): Choice {
  try {
    const v = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? "null");
    if (v?.kind === "blur" && (v.strength === "light" || v.strength === "strong")) return v;
    if (v?.kind === "image" && BACKGROUNDS.includes(v.id)) return v;
    if (v?.kind === "own" && localStorage.getItem(OWN_KEY)) return v;
  } catch { /* storage unavailable */ }
  return { kind: "none" };
}
function readOwn(): string | null {
  try { return localStorage.getItem(OWN_KEY); } catch { return null; }
}

/** Shrinks a chosen picture to 1280 px and keeps it as a small JPEG on this device. */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

type Mode = { mode: "disabled" } | { mode: "background-blur"; blurRadius: number } | { mode: "virtual-background"; imagePath: string };
function modeOf(choice: Choice, own: string | null): Mode {
  if (choice.kind === "blur") return { mode: "background-blur", blurRadius: BLUR[choice.strength] };
  if (choice.kind === "image") return { mode: "virtual-background", imagePath: `/backgrounds/${choice.id}.jpg` };
  if (choice.kind === "own" && own) return { mode: "virtual-background", imagePath: own };
  return { mode: "disabled" };
}

/** Keeps the chosen background on the camera, including after it is switched off and on. */
export function useBackground() {
  const { localParticipant, isCameraEnabled } = useLocalParticipant();
  // Only used inside a joined call, which never renders on the server.
  const [choice, setChoice] = useState<Choice>(readChoice);
  const [own, setOwn] = useState<string | null>(readOwn);
  const [status, setStatus] = useState<"idle" | "busy" | "failed" | "unsupported">("idle");

  const track = isCameraEnabled ? localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined : undefined;
  const mode = modeOf(choice, own);
  const modeKey = JSON.stringify(mode);
  useEffect(() => {
    if (!track) return;
    let stale = false;
    const m = JSON.parse(modeKey) as Mode;
    (async () => {
      const current = track.getProcessor();
      if (m.mode === "disabled") {
        if (current) await track.stopProcessor();
        return;
      }
      setStatus("busy");
      const lib = await import("@livekit/track-processors");
      if (!lib.supportsBackgroundProcessors()) { if (!stale) setStatus("unsupported"); return; }
      if (stale) return;
      if (current?.name === PROCESSOR_NAME) await (current as unknown as InstanceType<typeof lib.BackgroundProcessorWrapper>).switchTo(m);
      else await track.setProcessor(lib.BackgroundProcessor({ ...m, assetPaths: ASSETS }, PROCESSOR_NAME));
      if (!stale) setStatus("idle");
    })().catch(() => { if (!stale) setStatus("failed"); });
    return () => { stale = true; };
  }, [track, modeKey]);

  function choose(next: Choice) {
    setChoice(next);
    setStatus("idle");
    try { localStorage.setItem(CHOICE_KEY, JSON.stringify(next)); } catch { /* not remembered, still applied */ }
  }
  async function chooseOwn(file: File) {
    try {
      const url = await shrink(file);
      setOwn(url);
      try { localStorage.setItem(OWN_KEY, url); } catch { /* too big to remember: used for this call only */ }
      choose({ kind: "own" });
    } catch {
      setStatus("failed");
    }
  }
  return { choice, own, status, cameraOn: !!track, choose, chooseOwn };
}

/** The "Background" button and its panel in the call's control bar. */
export function BackgroundButton({ bg }: { bg: ReturnType<typeof useBackground> }) {
  const t = useTranslations("video");
  const [shown, setShown] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shown) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setShown(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setShown(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [shown]);

  const same = (c: Parameters<typeof bg.choose>[0]) => JSON.stringify(c) === JSON.stringify(bg.choice);
  const tile = (selected: boolean) =>
    `relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-inner border-2 text-xs ${selected ? "border-primary-strong" : "border-line hover:border-primary"}`;
  const mark = <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-strong text-white"><Check size={13} aria-hidden /></span>;

  return (
    <div ref={box} className="relative">
      <Button variant="secondary" onClick={() => setShown(!shown)} aria-expanded={shown} aria-haspopup="true">
        <Sparkles size={18} aria-hidden /> <span className="sr-only sm:not-sr-only">{t("background")}</span>
      </Button>
      {shown && (
        <div role="group" aria-label={t("background")}
          className="fade-up absolute bottom-full left-1/2 z-30 mb-2 w-[min(92vw,360px)] -translate-x-1/2 space-y-3 rounded-card border border-line bg-surface p-3 shadow-[var(--shadow)]">
          <p className="text-xs uppercase tracking-wide text-muted">{t("bgTitle")}</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              [{ kind: "none" }, t("bgNone")],
              [{ kind: "blur", strength: "light" }, t("bgBlurLight")],
              [{ kind: "blur", strength: "strong" }, t("bgBlurStrong")],
            ] as const).map(([c, label]) => (
              <button key={label} type="button" onClick={() => bg.choose(c)} aria-pressed={same(c)} className="space-y-1 text-center">
                <span className={`${tile(same(c))} bg-surface-2`}>
                  {c.kind === "blur" && <span aria-hidden className="h-8 w-8 rounded-full bg-primary-soft" style={{ filter: `blur(${c.strength === "light" ? 2 : 5}px)` }} />}
                  {same(c) && mark}
                </span>
                <span className="block text-xs text-ink">{label}</span>
              </button>
            ))}
            {BACKGROUNDS.map((id) => {
              const c = { kind: "image", id } as const;
              return (
                <button key={id} type="button" onClick={() => bg.choose(c)} aria-pressed={same(c)} className="space-y-1 text-center">
                  <span className={tile(same(c))}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- small static thumbnails */}
                    <img src={`/backgrounds/${id}.jpg`} alt="" className="h-full w-full object-cover" />
                    {same(c) && mark}
                  </span>
                  <span className="block text-xs text-ink">{t(`bg_${id}`)}</span>
                </button>
              );
            })}
            <button type="button" onClick={() => (bg.own && bg.choice.kind !== "own" ? bg.choose({ kind: "own" }) : file.current?.click())}
              aria-pressed={bg.choice.kind === "own"} className="space-y-1 text-center">
              <span className={`${tile(bg.choice.kind === "own")} bg-surface-2`}>
                {bg.own
                  // eslint-disable-next-line @next/next/no-img-element -- the person's own picture, from this device
                  ? <img src={bg.own} alt="" className="h-full w-full object-cover" />
                  : <ImagePlus size={18} aria-hidden className="text-muted" />}
                {bg.choice.kind === "own" && mark}
              </span>
              <span className="block text-xs text-ink">{t("bgOwn")}</span>
            </button>
          </div>
          <input ref={file} type="file" accept="image/*" className="hidden" aria-hidden tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void bg.chooseOwn(f); }} />
          {bg.own && <button type="button" onClick={() => file.current?.click()} className="text-sm text-primary-strong underline underline-offset-4">{t("bgOwnChange")}</button>}
          <p className="text-xs text-muted" aria-live="polite">
            {!bg.cameraOn ? t("bgCameraOff")
              : bg.status === "busy" ? t("bgPreparing")
              : bg.status === "unsupported" ? t("bgUnsupported")
              : bg.status === "failed" ? t("bgFailed")
              : t("bgPrivacy")}
          </p>
        </div>
      )}
    </div>
  );
}
