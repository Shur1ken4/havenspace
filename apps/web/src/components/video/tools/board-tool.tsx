"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eraser, Undo2 } from "lucide-react";
import { BOARD_COLORS, BOARD_SIZES, type Stroke, type ToolAction, type ToolState } from "@/lib/tools/model";
import type { Role } from "./use-tools";

type Board = Extract<ToolState, { kind: "board" }>;
const ASPECT = 10 / 16; // the board is 16:10 on every screen

/** Draws strokes (0–1000 coordinates) onto a canvas of any size. */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], width: number, height: number) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    const p = s.pts;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = (s.size * width) / 1000;
    ctx.beginPath();
    ctx.moveTo((p[0] * width) / 1000, (p[1] * height) / 1000);
    if (p.length === 2) ctx.lineTo((p[0] * width) / 1000 + 0.01, (p[1] * height) / 1000);
    // Smooth the line through the midpoints between recorded points.
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = ((p[i] + p[i + 2]) / 2) * (width / 1000), my = ((p[i + 1] + p[i + 3]) / 2) * (height / 1000);
      ctx.quadraticCurveTo((p[i] * width) / 1000, (p[i + 1] * height) / 1000, mx, my);
    }
    if (p.length > 2) ctx.lineTo((p[p.length - 2] * width) / 1000, (p[p.length - 1] * height) / 1000);
    ctx.stroke();
  }
}

/** The board as a PNG picture with a white background, for saving to the client's card. */
export function boardPng(strokes: Stroke[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1000;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawStrokes(ctx, strokes, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function BoardTool({ tool, role, act, set }: { tool: Board; role: Role; act: (a: ToolAction) => void; set: (s: ToolState) => void }) {
  const t = useTranslations("tools");
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [color, setColor] = useState<string>(BOARD_COLORS[0]);
  const [thickness, setThickness] = useState<number>(BOARD_SIZES[1]);
  const live = useRef<number[] | null>(null);

  // Fit the 16:10 board into the space available.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => {
      const w = Math.min(el.clientWidth, el.clientHeight / ASPECT || el.clientWidth);
      setSize({ w: Math.floor(w), h: Math.floor(w * ASPECT) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paint = useCallback(() => {
    const c = canvas.current;
    if (!c || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    drawStrokes(ctx, tool.strokes, size.w, size.h);
    if (live.current) drawStrokes(ctx, [{ id: "live", by: role, color, size: thickness, pts: live.current }], size.w, size.h);
  }, [size, tool.strokes, role, color, thickness]);
  useEffect(paint, [paint]);

  const toBoard = (e: React.PointerEvent) => {
    const box = canvas.current!.getBoundingClientRect();
    const x = Math.round(((e.clientX - box.left) / box.width) * 1000), y = Math.round(((e.clientY - box.top) / box.height) * 1000);
    return [Math.min(1000, Math.max(0, x)), Math.min(1000, Math.max(0, y))];
  };
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = toBoard(e);
    paint();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const pts = live.current;
    if (!pts || pts.length >= 2998) return;
    const [x, y] = toBoard(e);
    const dx = x - pts[pts.length - 2], dy = y - pts[pts.length - 1];
    if (dx * dx + dy * dy < 9) return; // skip tiny movements
    pts.push(x, y);
    paint();
  }
  function up() {
    const pts = live.current;
    live.current = null;
    if (pts) act({ a: "stroke", stroke: { id: `${role[0]}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, by: role, color, size: thickness, pts } });
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("board")} className="flex gap-1.5">
          {BOARD_COLORS.map((c, i) => (
            <button key={c} type="button" aria-label={t("color", { n: i + 1 })} aria-pressed={color === c} onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full border-2 ${color === c ? "border-ink" : "border-surface"}`} style={{ background: c }} />
          ))}
        </div>
        <div role="group" className="flex gap-1">
          {BOARD_SIZES.map((s) => (
            <button key={s} type="button" aria-label={t(`size_${s}`)} aria-pressed={thickness === s} onClick={() => setThickness(s)}
              className={`flex h-9 w-9 items-center justify-center rounded-inner border ${thickness === s ? "border-primary bg-primary-soft" : "border-line"}`}>
              <span className="rounded-full bg-ink" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => act({ a: "undo" })} className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 text-sm text-muted hover:text-ink">
          <Undo2 size={15} aria-hidden /> <span className="hidden sm:inline">{t("undo")}</span><span className="sr-only sm:hidden">{t("undo")}</span>
        </button>
        {role === "therapist" && (
          <button type="button" onClick={() => set({ ...tool, strokes: [] })} className="inline-flex min-h-9 items-center gap-1.5 rounded-control border border-line px-3 text-sm text-muted hover:text-ink">
            <Eraser size={15} aria-hidden /> {t("clear")}
          </button>
        )}
      </div>
      <div ref={wrap} className="flex min-h-0 flex-1 items-center justify-center">
        <canvas ref={canvas} role="img" aria-label={t("board")} style={{ width: size.w, height: size.h }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          className="touch-none rounded-inner border border-line bg-white shadow-[var(--shadow)]" />
      </div>
    </div>
  );
}
