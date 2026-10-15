import { getTranslations } from "next-intl/server";
import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { clock } from "./capture/live-panel";

// Live research mode (ADR-10): what was shown during the session, kept for
// the founders and the Clinical Lead to compare with the session afterwards.
export type LiveInsightRow = { id: number; offset_ms: number; content: { now: string; openings: { point: string; quote: string }[]; idea: string } };

export async function LiveInsights({ insights }: { insights: LiveInsightRow[] }) {
  const t = await getTranslations("live");
  return (
    <details className="group">
      <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-lg text-ink">
        {t("reviewTitle")} <Chip tone="amber">{t("badge")}</Chip> <Chip tone="plain">{insights.length}</Chip>
      </summary>
      <p className="mt-2 text-muted">{t("reviewBody")}</p>
      <ol className="mt-4 space-y-3">
        {insights.map((i) => (
          <li key={i.id}>
            <Card className="space-y-2 p-5">
              <p className="text-sm tabular-nums text-muted">{clock(i.offset_ms)}</p>
              <p className="text-ink">{i.content.now}</p>
              {i.content.openings.map((o, n) => (
                <p key={n} className="text-sm text-muted">{o.point} <span className="font-serif italic">“{o.quote}”</span></p>
              ))}
              {i.content.idea && <p className="flex gap-2 text-sm text-ink"><Lightbulb size={16} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden />{i.content.idea}</p>}
            </Card>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">{t("disclaimer")}</p>
    </details>
  );
}
