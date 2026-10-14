// Soft line illustrations with watercolour-like washes. Decorative only.
// Colours come from the design tokens so they follow light/dark mode.

type Props = { className?: string };

function Wash({ cx, cy, rx, ry, color, opacity = 0.55 }: { cx: number; cy: number; rx: number; ry: number; color: string; opacity?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} opacity={opacity} filter="url(#soften)" />;
}

function Defs() {
  return (
    <defs>
      <filter id="soften" x="-30%" y="-30%" width="160%" height="160%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" result="warped" />
        <feGaussianBlur in="warped" stdDeviation="6" />
      </filter>
    </defs>
  );
}

/** Two armchairs facing each other, a small table, a plant and window light. */
export function RoomIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 520 380" className={className} role="presentation" aria-hidden="true">
      <Defs />
      <Wash cx={360} cy={110} rx={110} ry={90} color="var(--accent-soft)" opacity={0.9} />
      <Wash cx={170} cy={250} rx={170} ry={90} color="var(--primary-soft)" opacity={0.9} />
      <Wash cx={420} cy={280} rx={80} ry={50} color="var(--calm-blue-soft)" opacity={0.8} />
      <g fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.78">
        {/* window */}
        <rect x="300" y="38" width="130" height="150" rx="6" />
        <line x1="365" y1="38" x2="365" y2="188" />
        <line x1="300" y1="113" x2="430" y2="113" />
        <path d="M300 188 L 250 300" opacity="0.25" />
        <path d="M430 188 L 470 300" opacity="0.25" />
        {/* left chair */}
        <path d="M70 300 C 66 250, 72 205, 100 196 C 128 188, 160 192, 170 214 L 176 262" />
        <path d="M62 262 C 60 248, 80 244, 86 258 L 92 300" />
        <path d="M92 262 L 196 262 C 206 262, 210 270, 206 280 L 200 300" />
        <path d="M70 300 L 200 300" />
        <line x1="80" y1="300" x2="76" y2="326" />
        <line x1="190" y1="300" x2="194" y2="326" />
        {/* right chair */}
        <path d="M450 300 C 454 250, 448 205, 420 196 C 392 188, 360 192, 350 214 L 344 262" />
        <path d="M458 262 C 460 248, 440 244, 434 258 L 428 300" />
        <path d="M428 262 L 324 262 C 314 262, 310 270, 314 280 L 320 300" />
        <path d="M450 300 L 320 300" />
        <line x1="440" y1="300" x2="444" y2="326" />
        <line x1="330" y1="300" x2="326" y2="326" />
        {/* side table with cup */}
        <ellipse cx="260" cy="268" rx="34" ry="7" />
        <line x1="260" y1="275" x2="260" y2="326" />
        <line x1="242" y1="326" x2="278" y2="326" />
        <path d="M250 262 L 252 250 L 268 250 L 270 262" />
        <path d="M268 253 C 276 253, 276 260, 269 260" />
        {/* plant */}
        <path d="M478 326 L 472 290 L 504 290 L 498 326 Z" />
        <path d="M488 290 C 486 260, 470 248, 458 240" />
        <path d="M488 290 C 492 258, 506 246, 516 236" />
        <path d="M488 290 C 488 262, 490 236, 486 214" />
        <path d="M458 240 C 466 238, 474 244, 476 254" />
        <path d="M516 236 C 508 236, 500 242, 498 252" />
        <path d="M486 214 C 494 220, 494 230, 489 238" />
        {/* floor */}
        <path d="M30 327 L 500 327" opacity="0.4" />
      </g>
    </svg>
  );
}

/** A window with soft light — used on calm empty states. */
export function WindowIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 240 200" className={className} role="presentation" aria-hidden="true">
      <Defs />
      <Wash cx={120} cy={90} rx={90} ry={70} color="var(--accent-soft)" opacity={0.95} />
      <g fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" opacity="0.75">
        <rect x="70" y="30" width="100" height="120" rx="6" />
        <line x1="120" y1="30" x2="120" y2="150" />
        <line x1="70" y1="90" x2="170" y2="90" />
        <path d="M60 150 L 180 150" />
        <path d="M150 150 L 146 128 L 166 128 L 162 150" />
        <path d="M156 128 C 154 114, 146 108, 140 104" />
        <path d="M156 128 C 158 112, 166 106, 172 100" />
      </g>
    </svg>
  );
}

/** A single leafy plant — small accent for cards. */
export function PlantIllustration({ className }: Props) {
  return (
    <svg viewBox="0 0 120 140" className={className} role="presentation" aria-hidden="true">
      <Defs />
      <Wash cx={60} cy={80} rx={46} ry={46} color="var(--primary-soft)" opacity={1} />
      <g fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" opacity="0.75">
        <path d="M44 128 L 40 100 L 80 100 L 76 128 Z" />
        <path d="M60 100 C 58 76, 44 64, 30 58 C 40 56, 52 62, 56 74" />
        <path d="M60 100 C 62 74, 76 62, 92 56 C 82 54, 68 60, 64 72" />
        <path d="M60 100 C 60 72, 62 50, 58 30 C 66 38, 68 50, 62 62" />
      </g>
    </svg>
  );
}

export function LogoMark({ className }: Props) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="var(--primary-soft)" />
      <path d="M9 20 C 9 14, 13 11, 16 11 C 19 11, 23 14, 23 20" fill="none" stroke="var(--primary-strong)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="20" r="2" fill="var(--accent)" />
    </svg>
  );
}
