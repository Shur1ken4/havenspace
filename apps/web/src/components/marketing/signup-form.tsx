"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck, Clock } from "lucide-react";
import { joinList, type SignupState } from "@/app/(marketing)/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/components/ui/cn";

const professions = ["counsellor", "psychotherapist", "psychologist", "student", "supervisor", "other"] as const;
const sizes = ["solo", "small_team", "organisation", "student"] as const;

export function SignupForm() {
  const t = useTranslations();
  const [interest, setInterest] = useState<"demo" | "waitlist">("demo");
  const [state, action, pending] = useActionState<SignupState, FormData>(joinList, { status: "idle" });
  const v = state.values;
  if (state.status === "ok") {
    return <Notice tone="success" title={state.interest === "demo" ? t("signup.thanksDemo") : t("signup.thanksWaitlist")}>{t("signup.thanksBody")}</Notice>;
  }
  const options = [
    { id: "demo" as const, icon: CalendarCheck, title: t("signup.demoTitle"), body: t("signup.demoBody") },
    { id: "waitlist" as const, icon: Clock, title: t("signup.waitlistTitle"), body: t("signup.waitlistBody") },
  ];
  return (
    <form action={action} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-[15px] font-medium">{t("signup.choose")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <label key={o.id} className={cn("flex cursor-pointer gap-3 rounded-[14px] border p-4", interest === o.id ? "border-primary bg-primary-soft" : "border-line bg-surface hover:bg-surface-2")}>
              <input type="radio" name="interest" value={o.id} checked={interest === o.id} onChange={() => setInterest(o.id)} className="sr-only" aria-label={o.title} />
              <o.icon size={20} className="mt-0.5 shrink-0 text-primary-strong" aria-hidden />
              <span><span className="block font-medium text-ink">{o.title}</span><span className="block text-sm text-muted">{o.body}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={<>{t("signup.name")} <span className="font-normal text-muted">({t("common.optional")})</span></>} htmlFor="su-name">
          <Input id="su-name" name="name" autoComplete="name" maxLength={80} defaultValue={v?.name} key={`n${v?.name}`} />
        </Field>
        <Field label={t("signup.email")} htmlFor="su-email">
          <Input id="su-email" name="email" type="email" autoComplete="email" required defaultValue={v?.email} key={`e${v?.email}`} />
        </Field>
        <Field label={t("signup.profession")} htmlFor="su-profession">
          <Select id="su-profession" name="profession" required defaultValue={v?.profession ?? ""} key={`p${v?.profession}`}>
            <option value="" disabled>—</option>
            {professions.map((p) => <option key={p} value={p}>{t(`professions.${p}`)}</option>)}
          </Select>
        </Field>
        <Field label={<>{t("signup.practice")} <span className="font-normal text-muted">({t("common.optional")})</span></>} htmlFor="su-size">
          <Select id="su-size" name="practiceSize" defaultValue={v?.practiceSize ?? ""} key={`s${v?.practiceSize}`}>
            <option value="">—</option>
            {sizes.map((s) => <option key={s} value={s}>{t(`signup.size_${s}`)}</option>)}
          </Select>
        </Field>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-3 text-[15px] text-ink">
        <input type="checkbox" name="consent" required className="mt-1 h-4 w-4 accent-[var(--primary-strong)]" />
        <span>{t("signup.consent")}</span>
      </label>
      {state.status === "invalid" && <p role="alert" className="text-sm text-destructive">{t("signup.invalid")}</p>}
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{t("common.somethingWrong")}</p>}
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {interest === "demo" ? t("signup.submitDemo") : t("signup.submitWaitlist")}
      </Button>
    </form>
  );
}
