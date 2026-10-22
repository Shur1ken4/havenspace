"use client";
import { useTranslations } from "next-intl";
import type { ToolAction, ToolState } from "@/lib/tools/model";
import type { Role } from "./use-tools";

type Balance = Extract<ToolState, { kind: "balance" }>;
const AREA_COLORS = ["#8FB09D", "#8FA9B8", "#E3C16F", "#C9A38A", "#D08E6A", "#7FB7B0", "#A99BC4", "#B5C98A"];

/** The wheel of balance drawn as a circle of eight areas, filled out to each score. */
export function BalanceWheel({ areas, size = 320, onPick }: { areas: Balance["areas"]; size?: number; onPick?: (index: number, value: number) => void }) {
  const c = 200, R = 150, n = areas.length;
  // Rounded, so the server and the browser draw exactly the same numbers.
  const point = (r: number, a: number) => [Math.round((c + r * Math.sin(a)) * 100) / 100, Math.round((c - r * Math.cos(a)) * 100) / 100];
  const sector = (r: number, i: number) => {
    const a0 = (i / n) * 2 * Math.PI, a1 = ((i + 1) / n) * 2 * Math.PI;
    const [x0, y0] = point(r, a0), [x1, y1] = point(r, a1);
    return `M ${c} ${c} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`;
  };
  function pick(e: React.PointerEvent<SVGSVGElement>) {
    if (!onPick) return;
    const box = e.currentTarget.getBoundingClientRect();
    // The picture is 620×420 units, starting at (-110, -10), so the area names fit around the circle.
    const x = -110 + ((e.clientX - box.left) / box.width) * 620 - c, y = -10 + ((e.clientY - box.top) / box.height) * 420 - c;
    const d = Math.hypot(x, y);
    if (d > R + 4) return;
    let a = Math.atan2(x, -y);
    if (a < 0) a += 2 * Math.PI;
    onPick(Math.min(n - 1, Math.floor((a / (2 * Math.PI)) * n)), Math.min(10, Math.max(1, Math.ceil((d / R) * 10))));
  }
  return (
    <svg viewBox="-110 -10 620 420" width={size * 1.55} height={size * 1.05} className={`h-auto max-w-full ${onPick ? "cursor-pointer touch-none" : ""}`} onPointerDown={pick} aria-hidden>
      {areas.map((a, i) => (
        <g key={i}>
          <path d={sector(R, i)} fill={AREA_COLORS[i % AREA_COLORS.length]} opacity={0.14} />
          {a.value ? <path d={sector((a.value / 10) * R, i)} fill={AREA_COLORS[i % AREA_COLORS.length]} opacity={0.85} /> : null}
        </g>
      ))}
      {Array.from({ length: 10 }, (_, k) => (
        <circle key={k} cx={c} cy={c} r={((k + 1) / 10) * R} fill="none" stroke="currentColor" strokeOpacity={k === 9 ? 0.35 : 0.12} />
      ))}
      {areas.map((_, i) => { const [x, y] = point(R, (i / n) * 2 * Math.PI); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.25} />; })}
      {areas.map((a, i) => {
        const mid = ((i + 0.5) / n) * 2 * Math.PI;
        const [x, y] = point(R + 26, mid);
        const anchor = Math.abs(Math.sin(mid)) < 0.2 ? "middle" : Math.sin(mid) > 0 ? "start" : "end";
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={17} fill="currentColor">
            {a.label.length > 16 ? `${a.label.slice(0, 15)}…` : a.label}{a.value ? ` · ${a.value}` : ""}
          </text>
        );
      })}
    </svg>
  );
}

export function BalanceTool({ tool, role, act, set }: { tool: Balance; role: Role; act: (a: ToolAction) => void; set: (s: ToolState) => void }) {
  const t = useTranslations("tools");
  return (
    <div className="grid h-full items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex justify-center px-6 text-ink">
        <BalanceWheel areas={tool.areas} size={360} onPick={(index, value) => act({ a: "balance", index, value })} />
      </div>
      <ul className="space-y-2">
        {tool.areas.map((a, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {role === "therapist" ? (
              <input aria-label={t("renameArea", { n: i + 1 })} value={a.label} maxLength={40}
                onChange={(e) => set({ ...tool, areas: tool.areas.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                className="min-h-9 w-full rounded-control border border-line bg-surface px-2 text-sm text-ink sm:w-40" />
            ) : (
              <span className="w-full text-sm text-ink sm:w-40">{a.label}</span>
            )}
            <div role="group" aria-label={a.label} className="flex min-w-0 flex-1 gap-1 sm:gap-0.5">
              {Array.from({ length: 10 }, (_, k) => k + 1).map((v) => (
                <button key={v} type="button" aria-label={`${a.label}: ${v}`} aria-pressed={a.value === v} onClick={() => act({ a: "balance", index: i, value: v })}
                  className={`h-9 min-w-0 flex-1 rounded-md text-xs ${a.value && v <= a.value ? "bg-primary-strong text-on-primary" : "bg-surface-2 text-muted hover:bg-primary-soft"}`}>
                  {v}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
