"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Arch, the CouchNote companion: a soft doorway with a little door on its chest.
 * Arch's moods only ever show Arch's own work or a reaction to the person using
 * the app (a click, a finished note), never a reaction to what a client said —
 * see docs/clinical-review.md item 14.
 * CLINICAL-REVIEW: the mood set and what each one means to a therapist.
 */
export type ArchMood =
  | "idle" | "listening" | "transcribing" | "writing" | "working" | "thinking"
  | "curious" | "done" | "celebrate" | "resting" | "hello";

const BODY = "M48 180 V96 A22 22 0 0 1 76 66 A30 30 0 0 1 124 66 A22 22 0 0 1 152 96 V180 Q152 186 146 186 H54 Q48 186 48 180 Z";
const DOOR = "M78 169 V146 a22 22 0 0 1 44 0 V169 Q122 172 119 172 H81 Q78 172 78 169 Z";
const IDLE_ACTS = ["look-left", "look-right", "hop", "stretch", "blink2"] as const;

function face(mood: ArchMood): "open" | "happy" | "closed" | "focused" | "up" {
  if (mood === "done" || mood === "celebrate" || mood === "hello") return "happy";
  if (mood === "resting") return "closed";
  if (mood === "writing" || mood === "working") return "focused";
  if (mood === "thinking") return "up";
  return "open";
}

export function Arch({ mood: given = "idle", className, label, followPointer = false, alive = false, onClick }: {
  mood?: ArchMood;
  className?: string;
  /** Accessible description; omit when the surrounding text already says it. */
  label?: string;
  /** Let the eyes gently follow the mouse. */
  followPointer?: boolean;
  /** Small idle behaviours (looking around, stretching) and a happy hop when clicked. */
  alive?: boolean;
  onClick?: () => void;
}) {
  const eyes = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [act, setAct] = useState<string | null>(null);
  const [poked, setPoked] = useState(false);
  const mood: ArchMood = poked ? "hello" : given === "working" ? "writing" : given;

  // Eyes follow the pointer.
  useEffect(() => {
    if (!followPointer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = svg.current?.getBoundingClientRect();
        if (!box || !eyes.current) return;
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height * 0.45);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 400);
        eyes.current.style.transform = `translate(${((dx / d) * 4 * k).toFixed(2)}px, ${((dy / d) * 3 * k).toFixed(2)}px)`;
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(frame); };
  }, [followPointer]);

  // Little idle behaviours every few seconds, only when calm.
  useEffect(() => {
    if (!alive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setAct(IDLE_ACTS[Math.floor(Math.random() * IDLE_ACTS.length)]);
        timer = setTimeout(() => { setAct(null); schedule(); }, 1400);
      }, 3500 + Math.random() * 4500);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [alive]);

  useEffect(() => {
    if (!poked) return;
    const id = setTimeout(() => setPoked(false), 1600);
    return () => clearTimeout(id);
  }, [poked]);

  const f = face(mood);
  const lightOn = mood !== "resting";
  const clickable = Boolean(onClick) || alive;
  const handleClick = () => { if (alive) setPoked(true); onClick?.(); };

  const picture = (
    <svg
      ref={svg}
      viewBox="20 30 160 170"
      className={`arch ${className ?? ""}`}
      data-mood={mood}
      data-act={act ?? undefined}
      role={label && !clickable ? "img" : undefined}
      aria-label={clickable ? undefined : label}
      aria-hidden={label && !clickable ? undefined : true}
    >
      <ellipse cx="100" cy="194" rx="58" ry="4.5" className="arch-shadow" />
      {mood === "celebrate" && (
        <g className="arch-sparkles">
          <path d="M34 70 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
          <path d="M162 56 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" />
          <path d="M168 128 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
          <path d="M28 138 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" />
        </g>
      )}
      {mood === "resting" && (
        <g className="arch-zzz"><text x="150" y="70">z</text><text x="160" y="56">z</text><text x="170" y="42">Z</text></g>
      )}
      {mood === "thinking" && (
        <g className="arch-dots"><circle cx="138" cy="52" r="4" /><circle cx="152" cy="42" r="5" /><circle cx="168" cy="34" r="6" /></g>
      )}
      <g className="arch-hop">
        <ellipse cx="74" cy="187" rx="15" ry="6" className="arch-feet arch-foot-l" />
        <ellipse cx="126" cy="187" rx="15" ry="6" className="arch-feet arch-foot-r" />
        <g className="arch-breath">
          <circle cx="100" cy="152" r="34" className="arch-aura" />
          <path d={BODY} className="arch-body" />
          <path d="M60 92 A14 14 0 0 1 74 76" className="arch-shine" />
          <path d={DOOR} className="arch-door" />
          <circle cx="100" cy="152" r="13" className="arch-glow" data-on={lightOn} />
          <circle cx="100" cy="152" r="7" className="arch-light" data-on={lightOn} />
          {(mood === "listening" || mood === "transcribing") && (
            <g className="arch-waves">
              <path d="M30 140 q-8 12 0 24" /><path d="M20 134 q-12 18 0 36" />
              <path d="M170 140 q8 12 0 24" /><path d="M180 134 q12 18 0 36" />
            </g>
          )}
          {(mood === "done" || mood === "celebrate") && (
            <g className="arch-note">
              <rect x="91" y="128" width="18" height="22" rx="3" />
              <path d="M95 135 h10 M95 140 h10 M95 145 h6" />
            </g>
          )}
          {mood === "writing" && (
            <g className="arch-desk">
              <rect x="80" y="150" width="40" height="26" rx="3" className="arch-paper" />
              <path className="arch-ink-line" d="M85 158 h28 M85 164 h22 M85 170 h16" />
              <g className="arch-pen"><path d="M112 146 l10 -14 4 3 -10 14 -5 2z" /></g>
            </g>
          )}
          <ellipse cx="73" cy="113" rx="7" ry="4" className="arch-cheek" />
          <ellipse cx="127" cy="113" rx="7" ry="4" className="arch-cheek" />
          <g className="arch-face">
            {f === "open" && (
              <g ref={eyes} className="arch-eyes">
                <g className="arch-blink">
                  <ellipse cx="86" cy="100" rx="5.5" ry="7" className="arch-ink arch-eye-l" />
                  <ellipse cx="114" cy="100" rx="5.5" ry="7" className="arch-ink arch-eye-r" />
                  <circle cx="88" cy="97" r="2" className="arch-catchlight" />
                  <circle cx="116" cy="97" r="2" className="arch-catchlight" />
                </g>
              </g>
            )}
            {f === "up" && (
              <g className="arch-blink">
                <ellipse cx="88" cy="97" rx="5.5" ry="7" className="arch-ink" />
                <ellipse cx="116" cy="97" rx="5.5" ry="7" className="arch-ink" />
                <circle cx="90" cy="93" r="2" className="arch-catchlight" />
                <circle cx="118" cy="93" r="2" className="arch-catchlight" />
              </g>
            )}
            {f === "focused" && (
              <g className="arch-blink">
                <ellipse cx="86" cy="104" rx="5" ry="4.5" className="arch-ink" />
                <ellipse cx="114" cy="104" rx="5" ry="4.5" className="arch-ink" />
                <path d="M79 98 q7 -3 14 0 M107 98 q7 -3 14 0" className="arch-line" />
              </g>
            )}
            {f === "closed" && <path d="M80 101 q6 5 12 0 M108 101 q6 5 12 0" className="arch-line" />}
            {f === "happy" && <path d="M80 102 q6 -7 12 0 M108 102 q6 -7 12 0" className="arch-line" />}
            <path
              d={mood === "thinking" ? "M98 115 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0"
                : mood === "writing" ? "M96 114 h8"
                : f === "happy" ? "M92 111 q8 8 16 0"
                : mood === "curious" ? "M95 113 q5 2 10 -1"
                : "M94 112 q6 5 12 0"}
              className="arch-line arch-mouth"
            />
          </g>
        </g>
      </g>
    </svg>
  );

  if (!clickable) return picture;
  return (
    <button type="button" onClick={handleClick} className="arch-button rounded-[24px]" aria-label={label}>
      {picture}
    </button>
  );
}
