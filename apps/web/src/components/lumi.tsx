"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { ArchMood } from "./arch";

/**
 * Lumi, the HavenSpace companion, replacing Arch. A soft oval light with a
 * gently raised top, a small light in its chest (the dot from the logo), no mouth.
 * Same moods and props as Arch, so it can stand in anywhere. Behaviour spec:
 * docs/companion-lumi.md.
 * CLINICAL-REVIEW: moods, when it goes quiet, what it never reacts to.
 */
// A rounded tip that leans only slightly, like a small flame when someone breathes near it: soft, never a point.
const BODY = "M102 66 Q 107 59, 112 64 C 122 78, 148 100, 148 138 C 148 166, 128 184, 100 184 C 72 184, 52 166, 52 138 C 52 104, 82 86, 102 66 Z";
const IDLE_ACTS = ["look-left", "look-right", "hop", "stretch", "blink2", "flicker"] as const;

type Eyes = "open" | "happy" | "closed" | "down" | "up" | "wide" | "soft";
function eyesFor(mood: ArchMood): Eyes {
  if (mood === "done" || mood === "celebrate" || mood === "hello") return "happy";
  if (mood === "resting") return "closed";
  if (mood === "writing" || mood === "working") return "down";
  if (mood === "thinking") return "up";
  if (mood === "curious") return "wide";
  if (mood === "listening") return "soft";
  return "open";
}

export function Lumi({ mood: given = "idle", className, label, followPointer = false, alive = false, onClick }: {
  mood?: ArchMood;
  className?: string;
  label?: string;
  followPointer?: boolean;
  alive?: boolean;
  onClick?: () => void;
}) {
  const uid = useId().replace(/:/g, "");
  const eyes = useRef<SVGGElement>(null);
  const lean = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [act, setAct] = useState<string | null>(null);
  const [poked, setPoked] = useState(false);
  const [near, setNear] = useState(false);
  const mood: ArchMood = poked ? "hello" : given === "working" ? "writing" : given;

  // Eyes follow the pointer; the whole light leans a little towards it and glows
  // warmer when the pointer comes close, like turning towards someone.
  useEffect(() => {
    if (!followPointer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = svg.current?.getBoundingClientRect();
        if (!box || !eyes.current) return;
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height * 0.6);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 360);
        eyes.current.style.transform = `translate(${((dx / d) * 5 * k).toFixed(2)}px, ${((dy / d) * 3.5 * k).toFixed(2)}px)`;
        if (lean.current) lean.current.style.transform = `rotate(${((dx / d) * 3 * k).toFixed(2)}deg)`;
        setNear(d < Math.max(box.width, 140));
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, [followPointer]);

  // Small idle behaviours every few seconds, only when nothing else is happening.
  useEffect(() => {
    if (!alive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setAct(IDLE_ACTS[Math.floor(Math.random() * IDLE_ACTS.length)]);
        timer = setTimeout(() => { setAct(null); schedule(); }, 1500);
      }, 4000 + Math.random() * 5000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [alive]);

  useEffect(() => {
    if (!poked) return;
    const id = setTimeout(() => setPoked(false), 1600);
    return () => clearTimeout(id);
  }, [poked]);

  const e = eyesFor(mood);
  const clickable = Boolean(onClick) || alive;
  const handleClick = () => { if (alive) setPoked(true); onClick?.(); };

  const picture = (
    <svg
      ref={svg}
      viewBox="20 30 160 170"
      className={`lumi ${className ?? ""}`}
      data-mood={mood}
      data-act={act ?? undefined}
      data-near={near || undefined}
      role={label && !clickable ? "img" : undefined}
      aria-label={clickable ? undefined : label}
      aria-hidden={label && !clickable ? undefined : true}
    >
      <defs>
        <radialGradient id={`lumi-halo-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--lumi-halo)" stopOpacity="0.75" />
          <stop offset="100%" stopColor="var(--lumi-halo)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`lumi-body-${uid}`} cx="45%" cy="40%" r="75%">
          <stop offset="0%" stopColor="var(--lumi-core)" />
          <stop offset="50%" stopColor="var(--lumi-mid)" />
          <stop offset="100%" stopColor="var(--lumi-edge)" />
        </radialGradient>
        <radialGradient id={`lumi-heart-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#FFF6DE" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FFF6DE" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="100" cy="194" rx="40" ry="4" className="lumi-shadow" />
      <circle cx="100" cy="132" r="76" fill={`url(#lumi-halo-${uid})`} className="lumi-halo" />

      {(mood === "listening" || mood === "transcribing") && (
        // Sound arriving from the left, where the person speaking is.
        <g className="lumi-waves">
          <path d="M44 120 q-7 12 0 24" /><path d="M34 114 q-11 18 0 36" /><path d="M24 108 q-15 24 0 48" />
        </g>
      )}
      {mood === "transcribing" && (
        // ...and coming out on the right as lines of text.
        <g className="lumi-lines">
          <rect x="152" y="112" width="24" height="5" rx="2.5" /><rect x="152" y="123" width="18" height="5" rx="2.5" />
          <rect x="152" y="134" width="22" height="5" rx="2.5" /><rect x="152" y="145" width="12" height="5" rx="2.5" />
        </g>
      )}
      {mood === "thinking" && (
        // Thoughts rising: two small bubbles, then a little cloud with dots inside.
        <g className="lumi-thoughts">
          <circle cx="136" cy="86" r="3.5" className="lumi-t1" />
          <circle cx="146" cy="72" r="5.5" className="lumi-t2" />
          <g className="lumi-t3">
            <path d="M150 58 a9 9 0 0 1 8 -12 a11 11 0 0 1 20 2 a8 8 0 0 1 2 15 a9 9 0 0 1 -14 3 a10 10 0 0 1 -16 -8 z" className="lumi-cloud" />
            <circle cx="158" cy="53" r="2" className="lumi-d1" /><circle cx="165" cy="53" r="2" className="lumi-d2" /><circle cx="172" cy="53" r="2" className="lumi-d3" />
          </g>
        </g>
      )}
      {mood === "resting" && (
        <g className="lumi-zzz"><text x="140" y="86">z</text><text x="152" y="70">z</text><text x="164" y="52">Z</text></g>
      )}
      {mood === "celebrate" && (
        <>
          <circle cx="100" cy="128" r="54" className="lumi-burst" />
          <g className="lumi-embers">
            <circle cx="44" cy="120" r="4" /><circle cx="160" cy="104" r="4" /><circle cx="168" cy="150" r="3" />
            <circle cx="34" cy="160" r="3" /><circle cx="64" cy="74" r="3" /><circle cx="140" cy="66" r="3.5" />
            <circle cx="100" cy="52" r="3" /><circle cx="176" cy="126" r="2.5" />
          </g>
        </>
      )}

      <g className="lumi-hop">
        <g ref={lean} className="lumi-lean">
          <g className="lumi-breath">
            <g className="lumi-flick">
              <path d={BODY} fill={`url(#lumi-body-${uid})`} className="lumi-body" />
              <ellipse cx="78" cy="112" rx="10" ry="5" className="lumi-shine" transform="rotate(-35 78 112)" />
              <ellipse cx="74" cy="146" rx="6.5" ry="3.8" className="lumi-cheek" />
              <ellipse cx="126" cy="146" rx="6.5" ry="3.8" className="lumi-cheek" />
              {/* The inner light (the dot from the logo): a soft glow with no edge, so it never reads as a mouth. */}
              <ellipse cx="100" cy="171" rx="13" ry="9" fill={`url(#lumi-heart-${uid})`} className="lumi-heart" />

              <g className="lumi-face">
                {(e === "open" || e === "wide") && (
                  <g ref={eyes} className="lumi-eyes">
                    <g className="lumi-blink">
                      <ellipse cx="88" cy="132" rx={e === "wide" ? 6 : 5} ry={e === "wide" ? 8 : 7} className="lumi-ink" />
                      <ellipse cx="112" cy="132" rx={e === "wide" ? 6 : 5} ry={e === "wide" ? 8 : 7} className="lumi-ink" />
                      <circle cx="90" cy="129" r="1.8" className="lumi-catch" />
                      <circle cx="114" cy="129" r="1.8" className="lumi-catch" />
                    </g>
                  </g>
                )}
                {e === "up" && (
                  <g className="lumi-glance">
                    <ellipse cx="90" cy="128" rx="5" ry="7" className="lumi-ink" />
                    <ellipse cx="114" cy="128" rx="5" ry="7" className="lumi-ink" />
                    <circle cx="92" cy="125" r="1.8" className="lumi-catch" />
                    <circle cx="116" cy="125" r="1.8" className="lumi-catch" />
                  </g>
                )}
                {e === "down" && (
                  // Looking down at the page beside him: the same round eyes, lowered and turned towards it.
                  <g transform="translate(4 4)">
                    <g className="lumi-blink">
                      <ellipse cx="88" cy="133" rx="5" ry="6.5" className="lumi-ink" />
                      <ellipse cx="112" cy="133" rx="5" ry="6.5" className="lumi-ink" />
                      <circle cx="89.5" cy="136" r="1.6" className="lumi-catch" />
                      <circle cx="113.5" cy="136" r="1.6" className="lumi-catch" />
                    </g>
                  </g>
                )}
                {e === "soft" && (
                  // Listening closely: eyes softly closed, content, like someone taking in every word.
                  <path d="M82 131 q6 4.5 12 0 M106 131 q6 4.5 12 0" className="lumi-line" />
                )}
                {e === "closed" && <path d="M82 133 q6 5 12 0 M106 133 q6 5 12 0" className="lumi-line" />}
                {e === "happy" && <path d="M82 135 q6 -8 12 0 M106 135 q6 -8 12 0" className="lumi-line" />}
              </g>

            </g>
          </g>
        </g>
      </g>

      {mood === "writing" && (
        <g className="lumi-desk">
          <rect x="140" y="152" width="30" height="36" rx="4" className="lumi-paper" />
          <path className="lumi-ink-line" d="M146 162 h18 M146 169 h14 M146 176 h10" />
        </g>
      )}
      {mood === "done" && (
        <g className="lumi-note">
          <rect x="128" y="120" width="18" height="22" rx="3" />
          <path d="M132 127 h10 M132 132 h10 M132 137 h6" />
        </g>
      )}
    </svg>
  );

  if (!clickable) return picture;
  return (
    <button type="button" onClick={handleClick} className="arch-button rounded-panel" aria-label={label ?? "Lumi"}>
      {picture}
    </button>
  );
}
