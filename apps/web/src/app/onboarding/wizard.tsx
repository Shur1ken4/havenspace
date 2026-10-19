"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { cn } from "@/components/ui/cn";
import { VoiceCheck } from "@/components/app/voice-check";
import { DocumentUpload } from "@/components/app/document-upload";
import { completeOnboarding, type OnboardingInput } from "./actions";
import { COUNTRIES, PROFESSIONAL_BODIES } from "@/lib/professional";

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
    fullName: "", displayName: "", profession: "counsellor", accreditationStage: "pre_accredited",
    professionalBody: "IACP", registrationNumber: "", country: "IE",
    modalities: [], noteFormat: "SOAP", language: initialLanguage,
  });
  // Students (and people not yet on a register) may skip the registration number.
  const needsReg = form.professionalBody !== "none_student" && form.accreditationStage !== "student";
  const step1Done = form.fullName.trim().length >= 2 && (!needsReg || form.registrationNumber.trim().length >= 2);
  const set = <K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function finish() {
    start(async () => {
      const res = await completeOnboarding(form);
      if (res.ok) { router.push(res.status === "approved" ? "/today" : "/pending"); router.refresh(); }
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
          <Field label={t("onboarding.fullNameLabel")} hint={t("onboarding.fullNameHint")} htmlFor="full-name">
            <Input id="full-name" value={form.fullName} maxLength={120} required onChange={(e) => set("fullName", e.target.value)} autoComplete="name" />
          </Field>
          <div className="space-y-4 rounded-[14px] border border-line p-4 sm:p-5">
            <div className="space-y-1">
              <p className="font-medium text-ink">{t("onboarding.verifyTitle")}</p>
              <p className="text-sm text-muted">{t("onboarding.verifyBody")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("onboarding.bodyLabel")} htmlFor="body">
                <Select id="body" value={form.professionalBody} onChange={(e) => set("professionalBody", e.target.value as OnboardingInput["professionalBody"])}>
                  {PROFESSIONAL_BODIES.map((b) => <option key={b} value={b}>{t(`professionalBodies.${b}`)}</option>)}
                </Select>
              </Field>
              <Field label={t("onboarding.countryLabel")} htmlFor="country">
                <Select id="country" value={form.country} onChange={(e) => set("country", e.target.value as OnboardingInput["country"])}>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{t(`countries.${c}`)}</option>)}
                </Select>
              </Field>
            </div>
            {needsReg && (
              <Field label={t("onboarding.regLabel")} hint={t("onboarding.regHint")} htmlFor="reg">
                <Input id="reg" value={form.registrationNumber} maxLength={60} required onChange={(e) => set("registrationNumber", e.target.value)} autoComplete="off" />
              </Field>
            )}
            <DocumentUpload />
          </div>
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
          <Button onClick={() => setStep(step + 1)} disabled={(step === 1 && !step1Done) || (step === 2 && form.modalities.length === 0)}>{t("common.continue")}</Button>
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
