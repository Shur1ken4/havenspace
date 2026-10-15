"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { Therapist } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { saveProfile, type ProfileState } from "./actions";

const professions = ["counsellor", "psychotherapist", "psychologist", "other"] as const;
const stages = ["student", "pre_accredited", "accredited", "supervisor"] as const;
const modalities = ["cbt", "mi", "dbt", "person_centred", "solution_focused", "integrative", "psychodynamic", "systemic"] as const;
const formats = ["SOAP", "DAP", "BIRP", "FREE"] as const;

export function ProfileForm({ therapist }: { therapist: Therapist }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  const [chosen, setChosen] = useState<string[]>(therapist.modalities);
  const [primary, setPrimary] = useState<string>(therapist.modalities[0] ?? "");
  return (
    <Card className="max-w-2xl">
      <form action={action} className="space-y-6">
        <Field label={t("onboarding.nameLabel")} htmlFor="displayName">
          <Input id="displayName" name="displayName" defaultValue={therapist.display_name} maxLength={80} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("onboarding.professionTitle")} htmlFor="profession">
            <Select id="profession" name="profession" defaultValue={therapist.profession ?? "counsellor"}>
              {professions.map((p) => <option key={p} value={p}>{t(`professions.${p}`)}</option>)}
            </Select>
          </Field>
          <Field label={t("onboarding.stageLabel")} htmlFor="accreditationStage">
            <Select id="accreditationStage" name="accreditationStage" defaultValue={therapist.accreditation_stage ?? "pre_accredited"}>
              {stages.map((s) => <option key={s} value={s}>{t(`stages.${s}`)}</option>)}
            </Select>
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-[15px] font-medium">{t("onboarding.modalityTitle")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {modalities.map((m) => (
              <label key={m} className="flex items-center gap-3 rounded-[12px] border border-line px-4 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="checkbox" name="modalities" value={m} checked={chosen.includes(m)} className="h-4 w-4 accent-[var(--primary-strong)]"
                  onChange={(e) => setChosen(e.target.checked ? [...chosen, m] : chosen.filter((x) => x !== m))} />
                {t(`modalities.${m}`)}
              </label>
            ))}
          </div>
        </fieldset>
        {chosen.length > 1 && (
          <Field label={t("settings.primaryLabel")} hint={t("settings.primaryHint")} htmlFor="primaryModality">
            <Select id="primaryModality" name="primaryModality" value={chosen.includes(primary) ? primary : chosen[0]} onChange={(e) => setPrimary(e.target.value)}>
              {chosen.map((m) => <option key={m} value={m}>{t(`modalities.${m}`)}</option>)}
            </Select>
          </Field>
        )}
        {chosen.length === 1 && <input type="hidden" name="primaryModality" value={chosen[0]} />}
        <Field label={t("onboarding.formatTitle")} htmlFor="noteFormat">
          <Select id="noteFormat" name="noteFormat" defaultValue={therapist.note_format}>
            {formats.map((f) => <option key={f} value={f}>{t(`noteFormats.${f}`)}</option>)}
          </Select>
        </Field>
        <Field label={t("settings.languageLabel")} hint={t("settings.languageHint")} htmlFor="language">
          <Select id="language" name="language" defaultValue={therapist.language === "ru" ? "ru" : "en"}>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </Select>
        </Field>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</Button>
          {state.ok && <span className="text-sm text-muted" role="status">{t("settings.saved")}</span>}
          {state.error && <span className="text-sm text-destructive" role="alert">{t("common.somethingWrong")}</span>}
        </div>
      </form>
    </Card>
  );
}
