"use client";
import { useTranslations } from "next-intl";
import { SCALE_PRESETS, type ToolAction, type ToolState } from "@/lib/tools/model";
import type { Role } from "./use-tools";

type Scale = Extract<ToolState, { kind: "scale" }>;

/** A question and a number from 0 to 10, chosen by either person (usually the client). */
export function ScaleTool({ tool, role, act, set }: { tool: Scale; role: Role; act: (a: ToolAction) => void; set: (s: ToolState) => void }) {
  const t = useTranslations("tools");
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-6">
      {role === "therapist" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SCALE_PRESETS.map((p) => {
              const q = t(`scale_${p}`);
              return (
                <button key={p} type="button" aria-pressed={tool.question === q}
                  onClick={() => set({ ...tool, question: q, low: t(`scale_${p}_low`), high: t(`scale_${p}_high`), value: null })}
                  className={`rounded-full border px-3 py-1.5 text-left text-sm ${tool.question === q ? "border-primary bg-primary-soft text-ink" : "border-line text-muted hover:text-ink"}`}>
                  {q}
                </button>
              );
            })}
          </div>
          <label className="block">
            <span className="sr-only">{t("question")}</span>
            <input value={tool.question} maxLength={200} placeholder={t("questionPlaceholder")}
              onChange={(e) => set({ ...tool, question: e.target.value })}
              className="min-h-11 w-full rounded-control border border-line bg-surface px-3 text-ink" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-muted">{t("lowLabel")}
              <input value={tool.low} maxLength={60} onChange={(e) => set({ ...tool, low: e.target.value })} className="min-h-10 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-ink" />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">{t("highLabel")}
              <input value={tool.high} maxLength={60} onChange={(e) => set({ ...tool, high: e.target.value })} className="min-h-10 min-w-0 flex-1 rounded-control border border-line bg-surface px-3 text-ink" />
            </label>
          </div>
        </div>
      )}

      <p className="text-center font-serif text-2xl text-ink sm:text-3xl">{tool.question || "…"}</p>
      <p className="text-center font-serif text-6xl text-primary-strong" aria-live="polite">
        {tool.value ?? <span className="text-2xl text-muted">{t("notChosen")}</span>}
      </p>
      <div role="group" aria-label={tool.question} className="flex gap-1 sm:gap-1.5">
        {Array.from({ length: 11 }, (_, n) => (
          <button key={n} type="button" aria-pressed={tool.value === n} onClick={() => act({ a: "scale", value: n })}
            className={`h-12 min-w-0 flex-1 rounded-inner border text-base font-medium transition-colors ${
              tool.value === n ? "border-primary-strong bg-primary-strong text-on-primary" : "border-line bg-surface text-ink hover:border-primary"}`}>
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between gap-4 text-sm text-muted">
        <span>0 — {tool.low}</span>
        <span className="text-right">10 — {tool.high}</span>
      </div>
    </div>
  );
}
