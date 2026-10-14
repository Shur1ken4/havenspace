"use client";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient, type ClientFormState } from "./actions";
import { looksLikeFullName } from "@/lib/pseudonym";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AddClientForm() {
  const t = useTranslations();
  const [value, setValue] = useState("");
  const [state, action, pending] = useActionState<ClientFormState, FormData>(createClient, {});
  const warn = looksLikeFullName(value);
  const error =
    state.error === "name" || warn ? t("clients.pseudonymLooksLikeName")
    : state.error === "taken" ? t("clients.pseudonymTaken")
    : state.error ? t("common.somethingWrong") : undefined;
  return (
    <form action={action} className="space-y-4" id="add">
      <Field label={t("clients.pseudonymLabel")} hint={t("clients.pseudonymHint")} htmlFor="pseudonym" error={error}>
        <Input id="pseudonym" name="pseudonym" required maxLength={40} autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Button type="submit" disabled={pending || warn || !value.trim()}>{t("clients.create")}</Button>
    </form>
  );
}
