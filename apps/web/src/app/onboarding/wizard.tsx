"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";
import { VoiceCheck } from "@/components/app/voice-check";
import { completeOnboarding, type OnboardingInput } from "./actions";

const professions = ["counsellor", "psychotherapist", "psychologist", "other"] as const;
const stages = ["student", "pre_accredited", "accredited", "supervisor"] as const;
const modalities = ["cbt", "mi", "dbt", "person_centred", "solution_focused", "integrative", "psychodynamic", "systemic"] as const;
const formats = ["SOAP", "DAP", "BIRP", "FREE"] as const;

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" aria-pressed={selected} onClick={onClick}
      className={cn(
        "w-full rounded-[14px] border px-4 py-3 text-left",
        selected ? "border-primary bg-primary-soft text-ink" : "border-line bg-surface hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

export function OnboardingWizard({ initialLanguage }: { initialLanguage: "en" | "ru" }) {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, start] = useTransition();
  const [form, setForm] = useState<OnboardingInput>({
    displayName: "", profession: "counsellor", accreditationStage: "pre_accredited",
    modalities: [], noteFormat: "SOAP", language: initialLanguage,
  });
  const set = <K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function finish() {
    start(async () => {
      const res = await completeOnboarding(form);
      if (res.ok) { router.push("/today"); router.refresh(); }
    });
  }

  return (
    <Card className="space-y-6 sm:p-10">
      <div className="space-y-1">
        <p className="text-sm text-muted">{t("onboarding.stepOf", { n: step })}</p>
        <div className="flex gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((n) => <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= step ? "bg-primary" : "bg-surface-2")} />)}
        </div>
      </div>

      {step === 1 && (
        <section className="space-y-5 fade-up">
          <h1 className="text-3xl">{t("onboarding.professionTitle")}</h1>
          <p className="text-muted">{t("onboarding.professionBody")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {professions.map((p) => (
              <Choice key={p} selected={form.profession === p} onClick={() => set("profession", p)}>{t(`professions.${p}`)}</Choice>
            ))}
          </div>
          <Field label={t("onboarding.stageLabel")} htmlFor="stage">
            <Select id="stage" value={form.accreditationStage} onChange={(e) => set("accreditationStage", e.target.value as OnboardingInput["accreditationStage"])}>
              {stages.map((s) => <option key={s} value={s}>{t(`stages.${s}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("onboarding.nameLabel")} htmlFor="name">
            <Input id="name" value={form.displayName} maxLength={80} onChange={(e) => set("displayName", e.target.value)} autoComplete="given-name" />
          </Field>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5 fade-up">
          <h1 className="text-3xl">{t("onboarding.modalityTitle")}</h1>
          <p className="text-muted">{t("onboarding.modalityBody")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {modalities.map((m) => {
              const on = form.modalities.includes(m);
              return (
                <Choice key={m} selected={on} onClick={() => set("modalities", on ? form.modalities.filter((x) => x !== m) : [...form.modalities, m])}>
                  {t(`modalities.${m}`)}
                </Choice>
              );
            })}
          </div>
          {form.modalities.length > 1 && (
            <Field label={t("settings.primaryLabel")} hint={t("settings.primaryHint")} htmlFor="primary">
              <Select id="primary" value={form.modalities[0]}
                onChange={(e) => set("modalities", [e.target.value as OnboardingInput["modalities"][number], ...form.modalities.filter((m) => m !== e.target.value)])}>
                {form.modalities.map((m) => <option key={m} value={m}>{t(`modalities.${m}`)}</option>)}
              </Select>
            </Field>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-5 fade-up">
          <h1 className="text-3xl">{t("onboarding.formatTitle")}</h1>
          <p className="text-muted">{t("onboarding.formatBody")}</p>
          <div className="grid gap-2">
            {formats.map((f) => (
              <Choice key={f} selected={form.noteFormat === f} onClick={() => set("noteFormat", f)}>{t(`noteFormats.${f}`)}</Choice>
            ))}
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-5 fade-up">
          <h1 className="text-3xl">{t("onboarding.voiceTitle")}</h1>
          <p className="text-muted">{t("onboarding.voiceBody")}</p>
          <VoiceCheck />
        </section>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        {step > 1 ? <Button variant="ghost" onClick={() => setStep(step - 1)}>{t("common.back")}</Button> : <span />}
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 2 && form.modalities.length === 0}>{t("common.continue")}</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={finish} disabled={pending}>{t("onboarding.voiceSkip")}</Button>
            <Button onClick={finish} disabled={pending}>{pending ? t("onboarding.finishing") : t("onboarding.finish")}</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
