import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { requireTherapist } from "@/lib/session";
import { CONSENT_VERSION } from "@/lib/consent";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { ConsentText } from "@/components/app/consent-text";
import { recordConsent } from "../../actions";
import { WithdrawConsent } from "./withdraw";

export default async function ConsentPage({ params, searchParams }: PageProps<"/clients/[id]/consent">) {
  const { id } = await params;
  const sp = await searchParams;
  const { therapist } = await requireTherapist();
  const t = await getTranslations("consent");
  const format = await getFormatter();
  const data = await withUser(therapist.id, async (db) => {
    const client = (await db.query("select id, pseudonym from clients where id = $1", [id])).rows[0];
    if (!client) return null;
    const consents = (await db.query(
      "select id, consent_version, method, given_at, withdrawn_at from consents where client_id = $1 order by given_at desc", [id],
    )).rows;
    return { client, consents };
  }).catch(() => null);
  if (!data) notFound();
  const active = data.consents.find((c) => !c.withdrawn_at);
  const next = typeof sp.next === "string" ? sp.next : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/clients/${id}`} className="text-sm text-muted hover:text-ink">← {data.client.pseudonym}</Link>
      <h1 className="text-4xl">{t("title", { pseudonym: data.client.pseudonym })}</h1>
      {active ? (
        <Notice tone="success" title={t("recorded", { date: format.dateTime(active.given_at, { dateStyle: "long" }), method: t(`method_${active.method}`) })}>
          {t("version", { version: active.consent_version })}
        </Notice>
      ) : (
        <p className="text-muted">{t("intro")}</p>
      )}
      <ConsentText />
      <p className="text-sm text-muted">{t("version", { version: CONSENT_VERSION })} · <a className="underline" href={`/resources/consent-template`}>{t("printable")}</a></p>

      {!active ? (
        <Card>
          <form action={recordConsent} className="space-y-5">
            <input type="hidden" name="clientId" value={id} />
            <input type="hidden" name="next" value={next} />
            <Field label={t("methodLabel")} htmlFor="method">
              <Select id="method" name="method" defaultValue="verbal_in_session">
                <option value="verbal_in_session">{t("method_verbal_in_session")}</option>
                <option value="signed_form">{t("method_signed_form")}</option>
                <option value="e_sign_link">{t("method_e_sign_link")}</option>
              </Select>
            </Field>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="confirmed" required className="mt-1 h-4 w-4 accent-[var(--primary-strong)]" />
              <span>{t("confirm")}</span>
            </label>
            <Button type="submit" size="lg">{t("record")}</Button>
          </form>
        </Card>
      ) : (
        <WithdrawConsent clientId={id} />
      )}

      {data.consents.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl">{t("history")}</h2>
          <ul className="space-y-1 text-muted">
            {data.consents.map((c) => (
              <li key={c.id}>
                {format.dateTime(c.given_at, { dateStyle: "medium", timeStyle: "short" })} · {t(`method_${c.method}`)} · {c.consent_version}
                {c.withdrawn_at && <> · {t("withdrawnOn", { date: format.dateTime(c.withdrawn_at, { dateStyle: "medium" }) })}</>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
