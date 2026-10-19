import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { goToCode } from "./actions";

export async function generateMetadata() {
  return { title: (await getTranslations("join"))("title") };
}

// For clients who were given a code rather than a link.
export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const t = await getTranslations("join");
  const invalid = (await searchParams).invalid === "1";
  return (
    <Card className="space-y-5">
      <h1 className="text-3xl">{t("title")}</h1>
      <p className="text-muted">{t("enterCodeIntro")}</p>
      <form action={goToCode} className="space-y-4">
        <Field label={t("codeLabel")} htmlFor="code" hint={t("codeHint")} error={invalid ? t("invalid") : undefined}>
          <Input id="code" name="code" required autoComplete="off" autoCapitalize="characters" spellCheck={false}
            placeholder="K7P4-QM2X" maxLength={12} className="text-center font-serif text-2xl tracking-[0.2em]" />
        </Field>
        <Button type="submit" className="w-full">{t("continue")}</Button>
      </form>
      <p className="text-sm text-muted">{t("therapistHint")} <a href="/login" className="text-primary-strong underline underline-offset-4">{t("therapistLink")}</a></p>
    </Card>
  );
}
