"use client";
import { useEffect, useRef } from "react";

/**
 * Arch, the CouchNote companion: a soft doorway with a little door on its chest.
 * Its moods only ever show Arch's own work (listening, working, done, resting),
 * never a reaction to what a client said — see docs/clinical-review.md item 14.
 * CLINICAL-REVIEW: the mood set and what each one means to a therapist.
 */
export type ArchMood = "idle" | "listening" | "working" | "done" | "resting" | "hello";

const BODY = "M48 180 V96 A22 22 0 0 1 76 66 A30 30 0 0 1 124 66 A22 22 0 0 1 152 96 V180 Q152 186 146 186 H54 Q48 186 48 180 Z";
const DOOR = "M78 169 V146 a22 22 0 0 1 44 0 V169 Q122 172 119 172 H81 Q78 172 78 169 Z";

export function Arch({ mood = "idle", className, label, followPointer = false, onClick }: {
  mood?: ArchMood;
  className?: string;
  /** Accessible description; omit when the surrounding text already says it. */
  label?: string;
  /** Let the eyes gently follow the mouse (hero only). */
  followPointer?: boolean;
  onClick?: () => void;
}) {
  const eyes = useRef<SVGGElement>(null);
  const svg = useRef<SVGSVGElement>(null);

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

  const openEyes = mood === "idle" || mood === "listening" || mood === "working";
  const lightOn = mood !== "resting";

  const picture = (
    <svg
      ref={svg}
      viewBox="30 50 140 150"
      className={`arch ${className ?? ""}`}
      data-mood={mood}
      role={label && !onClick ? "img" : undefined}
      aria-label={onClick ? undefined : label}
      aria-hidden={label && !onClick ? undefined : true}
    >
      <ellipse cx="100" cy="194" rx="58" ry="4.5" className="arch-shadow" />
      <g className="arch-hop">
        <ellipse cx="74" cy="187" rx="15" ry="6" className="arch-feet" />
        <ellipse cx="126" cy="187" rx="15" ry="6" className="arch-feet" />
        <g className="arch-breath">
          <circle cx="100" cy="152" r="34" className="arch-aura" />
          <path d={BODY} className="arch-body" />
          <path d="M60 92 A14 14 0 0 1 74 76" className="arch-shine" />
          <path d={DOOR} className="arch-door" />
          <circle cx="100" cy="152" r="13" className="arch-glow" data-on={lightOn} />
          <circle cx="100" cy="152" r="7" className="arch-light" data-on={lightOn} />
          {mood === "done" && (
            <g className="arch-note">
              <rect x="91" y="128" width="18" height="22" rx="3" />
              <path d="M95 135 h10 M95 140 h10 M95 145 h6" />
            </g>
          )}
          <ellipse cx="73" cy="113" rx="7" ry="4" className="arch-cheek" />
          <ellipse cx="127" cy="113" rx="7" ry="4" className="arch-cheek" />
          {openEyes ? (
            <g ref={eyes} className="arch-eyes">
              <g className="arch-blink">
                <ellipse cx="86" cy="100" rx="5.5" ry="7" className="arch-ink" />
                <ellipse cx="114" cy="100" rx="5.5" ry="7" className="arch-ink" />
                <circle cx="88" cy="97" r="2" className="arch-catchlight" />
                <circle cx="116" cy="97" r="2" className="arch-catchlight" />
              </g>
            </g>
          ) : mood === "resting" ? (
            <path d="M80 101 q6 5 12 0 M108 101 q6 5 12 0" className="arch-line" />
          ) : (
            <path d="M80 102 q6 -7 12 0 M108 102 q6 -7 12 0" className="arch-line" />
          )}
          <path d={mood === "working" ? "M96 114 h8" : "M94 112 q6 5 12 0"} className="arch-line arch-mouth" />
        </g>
      </g>
    </svg>
  );

  if (!onClick) return picture;
  return (
    <button type="button" onClick={onClick} className="arch-button rounded-[24px]" aria-label={label}>
      {picture}
    </button>
  );
}
