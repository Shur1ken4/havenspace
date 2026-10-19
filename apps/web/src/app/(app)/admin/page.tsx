import { getFormatter, getTranslations } from "next-intl/server";
import { ExternalLink, FileText } from "lucide-react";
import { withUser } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { REGISTER_LINKS, type PROFESSIONAL_BODIES } from "@/lib/professional";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { decideAccess, inviteFromList } from "./actions";

export async function generateMetadata() {
  return { title: (await getTranslations("admin"))("title") };
}

type Request = {
  id: string; email: string; display_name: string; profession: string | null; accreditation_stage: string | null;
  full_name: string | null; professional_body_other: string | null; documents: { id: string; filename: string }[];
  professional_body: (typeof PROFESSIONAL_BODIES)[number] | null; registration_number: string | null; country: string | null;
  access_status: "pending" | "approved" | "declined"; created_at: Date; access_decided_at: Date | null;
};
type Signup = {
  id: string; email: string; name: string; profession: string; practice_size: string | null; interest: string;
  language: string; created_at: Date; invited: boolean; has_account: boolean;
};

// Pilot access (ADR-11): approve therapists and invite people from the waiting list.
export default async function AdminPage() {
  const { therapist } = await requireAdmin();
  const t = await getTranslations();
  const format = await getFormatter();
  const { requests, signups } = await withUser(therapist.id, async (db) => ({
    requests: (await db.query<Request>(
      `select t.id, u.email, t.display_name, t.full_name, t.profession, t.accreditation_stage, t.professional_body,
              t.registration_number, t.professional_body_other, t.country, t.access_status, t.created_at, t.access_decided_at,
              coalesce((select json_agg(json_build_object('id', d.id, 'filename', d.filename) order by d.created_at)
                          from therapist_documents d where d.therapist_id = t.id and d.deleted_at is null), '[]') as documents
         from therapists t join "user" u on u.id = t.id
        where t.onboarding_completed_at is not null
        order by (t.access_status = 'pending') desc, t.created_at desc limit 200`,
    )).rows,
    signups: (await db.query<Signup>(
      `select s.id, s.email, s.name, s.profession, s.practice_size, s.interest, s.language, s.created_at,
              exists (select 1 from access_invites i where i.email = lower(s.email)) as invited,
              exists (select 1 from "user" u where lower(u.email) = lower(s.email)) as has_account
         from pilot_signups s order by s.created_at desc limit 500`,
    )).rows,
  }));
  const pending = requests.filter((r) => r.access_status === "pending");
  const decided = requests.filter((r) => r.access_status !== "pending");
  const date = (d: Date) => format.dateTime(d, { dateStyle: "medium" });
  const statusTone = { pending: "amber", approved: "sage", declined: "plain" } as const;

  const RequestCard = ({ r }: { r: Request }) => {
    const register = r.professional_body ? REGISTER_LINKS[r.professional_body] : undefined;
    return (
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-ink">{r.full_name || r.display_name || "—"} <span className="font-normal text-muted">· {r.email}</span></p>
            <p className="text-sm text-muted">
              {r.profession ? t(`professions.${r.profession}`) : "—"}
              {r.accreditation_stage ? ` · ${t(`stages.${r.accreditation_stage}`)}` : ""}
              {r.country ? ` · ${t(`countries.${r.country}`)}` : ""}
              {` · ${date(r.created_at)}`}
            </p>
          </div>
          <Chip tone={statusTone[r.access_status]}>{t(`admin.status_${r.access_status}`)}</Chip>
        </div>
        <p className="text-sm text-ink">
          {r.professional_body === "other" && r.professional_body_other ? r.professional_body_other
            : r.professional_body ? t(`professionalBodies.${r.professional_body}`) : "—"}
          {r.registration_number ? <> · <span className="tabular-nums">{r.registration_number}</span></> : null}
          {register && (
            <a href={register} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-primary-strong underline">
              {t("admin.checkRegister")} <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </p>
        {r.documents.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {r.documents.map((d) => (
              <li key={d.id}>
                <a href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm text-primary-strong hover:underline">
                  <FileText size={14} aria-hidden /> {d.filename}
                </a>
              </li>
            ))}
          </ul>
        ) : r.access_status === "pending" ? <p className="text-sm text-muted">{t("admin.noDocuments")}</p> : null}
        <div className="flex flex-wrap gap-2">
          {r.access_status !== "approved" && (
            <form action={decideAccess}>
              <input type="hidden" name="therapistId" value={r.id} />
              <input type="hidden" name="decision" value="approved" />
              <Button size="sm" type="submit">{t("admin.approve")}</Button>
            </form>
          )}
          {r.access_status !== "declined" && r.id !== therapist.id && (
            <form action={decideAccess}>
              <input type="hidden" name="therapistId" value={r.id} />
              <input type="hidden" name="decision" value="declined" />
              <Button size="sm" variant="ghost" type="submit">{r.access_status === "approved" ? t("admin.revoke") : t("admin.decline")}</Button>
            </form>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-4xl">{t("admin.title")}</h1>
        <p className="text-muted">{t("admin.intro")}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl">{t("admin.requestsTitle")} {pending.length > 0 && <Chip tone="amber">{pending.length}</Chip>}</h2>
        {pending.length === 0 ? <p className="text-muted">{t("admin.noRequests")}</p> : (
          <ul className="grid gap-3">{pending.map((r) => <li key={r.id}><RequestCard r={r} /></li>)}</ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">{t("admin.listTitle")}</h2>
        <p className="text-muted">{t("admin.listIntro")}</p>
        {signups.length === 0 ? <p className="text-muted">{t("admin.noSignups")}</p> : (
          <ul className="grid gap-3">
            {signups.map((s) => (
              <li key={s.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-medium text-ink">{s.name || "—"} <span className="font-normal text-muted">· {s.email}</span></p>
                    <p className="text-sm text-muted">
                      {t(`admin.interest_${s.interest}`)} · {t(`professions.${s.profession}`)}
                      {s.practice_size ? ` · ${t(`signup.size_${s.practice_size}`)}` : ""} · {date(s.created_at)}
                    </p>
                  </div>
                  {s.has_account ? <Chip tone="plain">{t("admin.hasAccount")}</Chip>
                    : s.invited ? <Chip>{t("admin.invited")}</Chip>
                    : (
                      <form action={inviteFromList}>
                        <input type="hidden" name="email" value={s.email} />
                        <input type="hidden" name="language" value={s.language} />
                        <Button size="sm" type="submit">{t("admin.invite")}</Button>
                      </form>
                    )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl">{t("admin.decidedTitle")}</h2>
          <ul className="grid gap-3">{decided.map((r) => <li key={r.id}><RequestCard r={r} /></li>)}</ul>
        </section>
      )}
    </div>
  );
}
