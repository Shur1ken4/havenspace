"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { addHours, buildPack, removeHours, saveExcerpts } from "./actions";

export function BuildPack({ month, hasPack, disabled, building }: { month: string; hasPack: boolean; disabled: boolean; building: boolean }) {
  const t = useTranslations("supervision");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [waiting, setWaiting] = useState(building);
  const busy = waiting && !hasPack;
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => router.refresh(), 3000);
    const stop = setTimeout(() => setWaiting(false), 120_000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [busy, router]);
  return (
    <Button size="sm" variant={hasPack ? "secondary" : "primary"} disabled={disabled || pending || busy}
      onClick={() => start(async () => { await buildPack(month); setWaiting(true); router.refresh(); })}>
      {busy ? t("building") : hasPack ? t("regenerate") : t("build")}
    </Button>
  );
}

type M = { key: string; pseudonym: string; date: string; kind: string; text: string; quote: string };

export function ExcerptPicker({ month, moments, selected }: { month: string; moments: M[]; selected: string[] }) {
  const t = useTranslations("review");
  const [chosen, setChosen] = useState<string[]>(selected);
  const [pending, start] = useTransition();
  const toggle = (k: string) => {
    const next = chosen.includes(k) ? chosen.filter((x) => x !== k) : [...chosen, k];
    setChosen(next);
    start(() => saveExcerpts(month, next));
  };
  const label = { strengths: t("strengths"), missed_openings: t("openings"), try_next: t("tryNext") } as Record<string, string>;
  return (
    <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1" aria-busy={pending}>
      {moments.map((m) => (
        <li key={m.key}>
          <label className="flex items-start gap-3 rounded-control border border-line p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
            <input type="checkbox" className="mt-1 accent-[var(--primary-strong)]" checked={chosen.includes(m.key)} onChange={() => toggle(m.key)} />
            <span className="space-y-1">
              <span className="flex flex-wrap gap-2 text-sm text-muted"><Chip tone="plain">{label[m.kind]}</Chip> {m.pseudonym} · {m.date}</span>
              <span className="block">{m.text}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function HoursForm({ month }: { month: string }) {
  const t = useTranslations("supervision");
  return (
    <form action={addHours} className="space-y-3 border-t border-line pt-4">
      <p className="font-medium">{t("addHours")}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("date")} htmlFor="occurredOn"><Input id="occurredOn" name="occurredOn" type="date" defaultValue={`${month}-01`} required /></Field>
        <Field label={t("minutes")} htmlFor="minutes"><Input id="minutes" name="minutes" type="number" min={5} max={600} defaultValue={60} required /></Field>
        <Field label={t("kind")} htmlFor="kind">
          <Select id="kind" name="kind"><option value="individual">{t("kind_individual")}</option><option value="group">{t("kind_group")}</option></Select>
        </Field>
        <Field label={t("supervisor")} htmlFor="supervisor"><Input id="supervisor" name="supervisor" maxLength={20} /></Field>
      </div>
      <Button type="submit" variant="secondary" size="sm">{t("addHours")}</Button>
    </form>
  );
}

export function RemoveHours({ id }: { id: string }) {
  const t = useTranslations("clients");
  const [pending, start] = useTransition();
  return (
    <button aria-label={t("remove")} disabled={pending} onClick={() => start(() => removeHours(id))} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"><X size={16} /></button>
  );
}
