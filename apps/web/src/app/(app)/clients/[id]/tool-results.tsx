import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { BalanceWheel } from "@/components/video/tools/balance-tool";
import { TOOL_ICONS } from "@/components/video/tools/icons";
import { artCard, artCardSrc } from "@/lib/tools/deck";
import { EMOTION_FAMILIES, type ToolKind } from "@/lib/tools/model";
import { DeleteToolResult } from "./delete-tool-result";

export type ToolResultRow = { id: string; kind: ToolKind; content: Record<string, unknown>; created_at: string; has_image: boolean };

type Scale = { question: string; low: string; high: string; value: number };
type Balance = { areas: { label: string; value: number | null }[] };
type Emotions = { picked: string[]; labels: string[] };
type Cards = { drawn: { id: string; note: string }[] };

/** "From sessions": what the therapist saved from the tools in video sessions (ADR-21). */
export async function ToolResults({ rows }: { rows: ToolResultRow[] }) {
  const t = await getTranslations("tools");
  const format = await getFormatter();
  // Earlier answers to the same scale question, oldest first, to show change over time.
  const earlier = (row: ToolResultRow) => rows
    .filter((r) => r.kind === "scale" && (r.content as Scale).question === (row.content as Scale).question && r.created_at < row.created_at)
    .map((r) => (r.content as Scale).value).reverse().slice(-6);

  return (
    <section aria-labelledby="tools-title" className="space-y-4">
      <h2 id="tools-title" className="text-2xl">{t("fromSessions")}</h2>
      {rows.length === 0 ? <p className="text-muted">{t("fromSessionsEmpty")}</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const Icon = TOOL_ICONS[r.kind];
            return (
              <li key={r.id}>
                <Card className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-strong"><Icon size={17} aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-ink">{t(`kind_${r.kind}`)}</h3>
                      <p className="text-xs text-muted">{t("savedFrom", { date: format.dateTime(new Date(r.created_at), { dateStyle: "medium", timeStyle: "short" }) })}</p>
                    </div>
                    <DeleteToolResult id={r.id} />
                  </div>

                  {r.kind === "scale" && (() => {
                    const c = r.content as Scale;
                    const before = earlier(r);
                    return (
                      <div className="space-y-2">
                        <p className="text-ink">{c.question}</p>
                        <p className="flex items-baseline gap-2"><span className="font-serif text-4xl text-primary-strong">{c.value}</span><span className="text-muted">/ 10</span></p>
                        <div className="h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-primary" style={{ width: `${c.value * 10}%` }} /></div>
                        <p className="flex justify-between text-xs text-muted"><span>0 — {c.low}</span><span>10 — {c.high}</span></p>
                        {before.length > 0 && <p className="text-sm text-muted">{t("earlier")}: {before.join(" → ")} → <span className="font-medium text-ink">{c.value}</span></p>}
                      </div>
                    );
                  })()}

                  {r.kind === "balance" && (
                    <div className="flex justify-center text-ink"><BalanceWheel areas={(r.content as Balance).areas} size={240} /></div>
                  )}

                  {r.kind === "emotions" && (
                    <div className="flex flex-wrap gap-1.5">
                      {(r.content as Emotions).picked.map((id, i) => {
                        const f = EMOTION_FAMILIES.find((x) => id.startsWith(`${x.id}.`));
                        return <span key={id} style={{ background: f?.color }} className="rounded-full px-3 py-1 text-sm text-[#1E2421]">{(r.content as Emotions).labels[i] ?? id}</span>;
                      })}
                    </div>
                  )}

                  {r.kind === "cards" && (
                    <ul className="flex flex-wrap gap-3">
                      {(r.content as Cards).drawn.map((d) => {
                        const card = artCard(d.id);
                        return (
                          <li key={d.id} className="w-24 space-y-1">
                            {/* eslint-disable-next-line @next/next/no-img-element -- static art from /public */}
                            <img src={artCardSrc(d.id)} alt={card ? t("card", { title: card.title }) : ""} loading="lazy" className="aspect-[3/4] w-full rounded-inner object-cover" />
                            {d.note && <p className="text-xs text-ink">«{d.note}»</p>}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {r.kind === "board" && r.has_image && (
                    // eslint-disable-next-line @next/next/no-img-element -- private image served by our own route
                    <img src={`/api/tools/${r.id}/image`} alt={t("board")} loading="lazy" className="aspect-[16/10] w-full rounded-inner border border-line bg-white object-contain" />
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
