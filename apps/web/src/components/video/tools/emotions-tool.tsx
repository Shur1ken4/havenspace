"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { EMOTION_FAMILIES, type ToolAction, type ToolState } from "@/lib/tools/model";

type Emotions = Extract<ToolState, { kind: "emotions" }>;
const TOTAL = EMOTION_FAMILIES.reduce((n, f) => n + f.words.length, 0);
const STEP = (2 * Math.PI) / TOTAL;
/** Where each family and word sits on the wheel (angles in radians, clockwise from the top). */
const SEGMENTS = (() => {
  let k = 0;
  return EMOTION_FAMILIES.map((f) => {
    const a0 = k * STEP;
    const words = f.words.map((w) => { const a = k * STEP; k += 1; return { key: `${f.id}.${w}`, a0: a, a1: a + STEP }; });
    return { ...f, a0, a1: k * STEP, words };
  });
})();

/** The emotion wheel: families of feelings inside, their words around the edge. */
export function EmotionsTool({ tool, act }: { tool: Emotions; act: (a: ToolAction) => void }) {
  const t = useTranslations("tools");
  const [focus, setFocus] = useState<string>(EMOTION_FAMILIES[0].id);
  const picked = new Set(tool.picked);
  const toggle = (word: string) => act({ a: "emotion", word, on: !picked.has(word) });
  const label = (key: string) => { const [f, w] = key.split("."); return t(`words.${f}.${w}`); };

  const c = 200, r0 = 46, r1 = 112, r2 = 196;
  const at = (r: number, a: number) => [c + r * Math.sin(a), c - r * Math.cos(a)] as const;
  const arc = (ra: number, rb: number, a0: number, a1: number) => {
    const [x0, y0] = at(rb, a0), [x1, y1] = at(rb, a1), [x2, y2] = at(ra, a1), [x3, y3] = at(ra, a0);
    const big = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${rb} ${rb} 0 ${big} 1 ${x1} ${y1} L ${x2} ${y2} A ${ra} ${ra} 0 ${big} 0 ${x3} ${y3} Z`;
  };
  const key = (e: React.KeyboardEvent, fn: () => void) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } };
  const segments = SEGMENTS;
  const family = EMOTION_FAMILIES.find((f) => f.id === focus)!;

  return (
    <div className="grid h-full items-center gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <svg viewBox="0 0 400 400" className="mx-auto h-auto w-full max-w-[460px] select-none text-ink" role="group" aria-label={t("kind_emotions")}>
        {segments.map((f) => {
          const mid = (f.a0 + f.a1) / 2;
          const [lx, ly] = at((r0 + r1) / 2, mid);
          const deg = (mid * 180) / Math.PI;
          const upright = deg > 90 && deg < 270 ? deg + 180 : deg; // keep text readable at the bottom
          return (
            <g key={f.id}>
              <path d={arc(r0, r1, f.a0, f.a1)} fill={f.color} opacity={focus === f.id ? 0.95 : 0.7} stroke="var(--bg)" strokeWidth={2}
                role="button" tabIndex={0} aria-label={t(`family_${f.id}`)} aria-pressed={focus === f.id}
                onClick={() => setFocus(f.id)} onKeyDown={(e) => key(e, () => setFocus(f.id))} className="cursor-pointer outline-none focus-visible:opacity-100" />
              <text x={lx} y={ly} transform={`rotate(${upright} ${lx} ${ly})`} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={600} fill="#1E2421" pointerEvents="none">
                {t(`family_${f.id}`)}
              </text>
              {f.words.map((w) => {
                const m = (w.a0 + w.a1) / 2;
                const on = picked.has(w.key);
                const [tx, ty] = at((r1 + r2) / 2, m);
                const d = (m * 180) / Math.PI;
                const rot = d < 180 ? d - 90 : d + 90; // read outwards on the right, inwards on the left
                return (
                  <g key={w.key} role="button" tabIndex={0} aria-pressed={on} aria-label={label(w.key)}
                    onClick={() => toggle(w.key)} onKeyDown={(e) => key(e, () => toggle(w.key))} className="cursor-pointer outline-none [&:focus-visible>path]:stroke-[var(--ink)]">
                    <path d={arc(r1, r2, w.a0, w.a1)} fill={f.color} opacity={on ? 1 : 0.22} stroke="var(--bg)" strokeWidth={1.5} />
                    <text x={tx} y={ty} transform={`rotate(${rot} ${tx} ${ty})`} textAnchor="middle" dominantBaseline="middle" fontSize={10.5}
                      fontWeight={on ? 700 : 400} fill={on ? "#1E2421" : "currentColor"} pointerEvents="none">
                      {label(w.key)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
        <circle cx={c} cy={c} r={r0 - 2} fill="var(--surface)" />
        <text x={c} y={c} textAnchor="middle" dominantBaseline="middle" fontSize={22} fill="currentColor" className="font-serif">{tool.picked.length || ""}</text>
      </svg>

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="font-medium text-ink">{t(`family_${family.id}`)}</p>
          <div className="flex flex-wrap gap-2">
            {family.words.map((w) => {
              const id = `${family.id}.${w}`;
              const on = picked.has(id);
              return (
                <button key={id} type="button" aria-pressed={on} onClick={() => toggle(id)}
                  style={on ? { background: family.color, borderColor: family.color } : undefined}
                  className={`min-h-11 rounded-full border px-4 text-sm ${on ? "font-semibold text-[#1E2421]" : "border-line bg-surface text-ink hover:border-primary"}`}>
                  {label(id)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2" aria-live="polite">
          <p className="text-sm text-muted">{t("chosen")}</p>
          {tool.picked.length === 0 ? <p className="text-sm text-muted">{t("noneChosen")}</p> : (
            <div className="flex flex-wrap gap-1.5">
              {tool.picked.map((id) => {
                const f = EMOTION_FAMILIES.find((x) => id.startsWith(`${x.id}.`));
                return <span key={id} style={{ background: f?.color }} className="rounded-full px-3 py-1 text-sm text-[#1E2421]">{label(id)}</span>;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
