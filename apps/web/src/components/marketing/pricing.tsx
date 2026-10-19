"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Gift } from "lucide-react";
import { Card } from "@/components/ui/card";

// Planned prices after the pilot (nothing is billed yet). Yearly = 20% off,
// rounded to the nearest €5. A "session" = one session processed into a note.
const YEARLY_DISCOUNT = 0.2;
const yearly = (monthly: number) => Math.round((monthly * 12 * (1 - YEARLY_DISCOUNT)) / 5) * 5;

type Plan = { key: "Free" | "Solo" | "Growth" | "Supervisor"; monthly: number; perks: string[]; featured?: boolean };
const PLANS: Plan[] = [
  { key: "Free", monthly: 0, perks: ["perkFree1", "perkFree2"] },
  { key: "Solo", monthly: 39, perks: ["perkSolo1", "perkSolo2", "perkSolo3", "perkSolo4"], featured: true },
  { key: "Growth", monthly: 59, perks: ["perkGrowth1", "perkGrowth2", "perkGrowth3", "perkGrowth4"] },
  { key: "Supervisor", monthly: 0, perks: ["perkSup1", "perkSup2"] },
];

export function Pricing() {
  const t = useTranslations("landing");
  const [period, setPeriod] = useState<"month" | "year">("month");
  return (
    <div className="mt-8 space-y-6">
      <div role="radiogroup" aria-label={t("billingPeriod")} className="inline-flex rounded-full border border-line bg-surface p-1">
        {(["month", "year"] as const).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
            className={`rounded-full px-4 py-2 text-sm ${period === p ? "bg-primary-soft font-medium text-primary-strong" : "text-muted hover:text-ink"}`}>
            {p === "month" ? t("monthly") : <>{t("yearly")} <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-ink">{t("save20")}</span></>}
          </button>
        ))}
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const paid = p.monthly > 0;
          const shown = paid && period === "year" ? Math.floor(yearly(p.monthly) / 12) : p.monthly;
          return (
            <li key={p.key}>
              <Card className={`h-full space-y-3 ${p.featured ? "border-primary" : ""}`}>
                <h3 className="font-sans text-lg font-medium">{t(`plan${p.key}`)}</h3>
                <div>
                  <p><span className="font-serif text-4xl">€{shown}</span><span className="text-muted">{t("perMonth")}</span></p>
                  {paid && (
                    <p className="text-sm text-muted">
                      {period === "year" ? t("billedYearly", { total: yearly(p.monthly) }) : t("billedMonthly")}
                    </p>
                  )}
                </div>
                <p className="font-medium text-ink">{t(`plan${p.key}Body`)}</p>
                {p.key === "Supervisor" && <p className="text-sm text-muted">{t("supervisorWhat")}</p>}
                <ul className="space-y-1.5 text-sm text-muted">
                  {p.perks.map((perk) => (
                    <li key={perk} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden />{t(perk)}</li>
                  ))}
                </ul>
              </Card>
            </li>
          );
        })}
      </ul>
      <p className="flex items-start gap-2 text-muted">
        <Gift size={18} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden />
        <span><span className="font-medium text-ink">{t("referTitle")}</span> {t("referBody")}</span>
      </p>
    </div>
  );
}
