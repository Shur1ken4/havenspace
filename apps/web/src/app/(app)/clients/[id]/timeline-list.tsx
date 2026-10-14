"use client";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { addTimelineItem, updateTimelineItem } from "../actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Item = { id: string; text: string; status: string; source: string; session_date: string | null };

export function TimelineList({ clientId, kind, items }: { clientId: string; kind: string; items: Item[] }) {
  const t = useTranslations("clients");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className={`flex items-start justify-between gap-3 ${i.status === "done" ? "text-muted line-through" : ""}`}>
              <div>
                <p>{i.text}</p>
                <p className="text-xs text-muted no-underline">{i.source === "therapist" ? t("byYou") : i.session_date ? t("fromSession", { date: i.session_date }) : null}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {i.status !== "done" && kind !== "theme" && kind !== "change" && (
                  <button aria-label={t("markDone")} title={t("markDone")} disabled={pending} onClick={() => start(() => updateTimelineItem(i.id, clientId, "done"))} className="rounded-md p-1.5 text-muted hover:bg-primary-soft hover:text-primary-strong"><Check size={16} /></button>
                )}
                <button aria-label={t("remove")} title={t("remove")} disabled={pending} onClick={() => start(() => updateTimelineItem(i.id, clientId, "dropped"))} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink"><X size={16} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form action={addTimelineItem} className="flex gap-2">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="kind" value={kind} />
        <Input name="text" placeholder={t("itemPlaceholder")} aria-label={t("itemPlaceholder")} maxLength={500} required className="h-10" />
        <Button type="submit" variant="secondary" size="sm" className="h-10">{t("addItem")}</Button>
      </form>
    </div>
  );
}
