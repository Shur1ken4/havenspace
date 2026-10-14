import { NextResponse } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { fileResponse, toDocx, toPdf } from "@/lib/export";
import type { NoteContent } from "@/lib/types";

export async function GET(req: Request, ctx: RouteContext<"/api/sessions/[id]/export">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const format = new URL(req.url).searchParams.get("format") === "docx" ? "docx" : "pdf";
  const row = await withUser(session.user.id, async (db) => {
    const r = (await db.query(
      `select s.started_at, s.duration_seconds, c.pseudonym, n.content_json, n.status, n.approved_at
         from sessions s join clients c on c.id = s.client_id join notes n on n.session_id = s.id where s.id = $1`, [id],
    )).rows[0];
    if (r) await audit(db, session.user.id, `note.export_${format}`, "session", id);
    return r;
  });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const t = await getTranslations();
  const f = await getFormatter();
  const content = row.content_json as NoteContent;
  const date = f.dateTime(row.started_at, { dateStyle: "long" });
  const doc = {
    title: `${row.pseudonym} — ${date}`,
    subtitle: [
      t(`noteFormats.${content.format}`),
      row.duration_seconds ? `${Math.round(row.duration_seconds / 60)} min` : null,
      row.status === "approved" ? t("review.approved", { date: f.dateTime(row.approved_at, { dateStyle: "medium" }) }) : t("review.draft"),
    ].filter(Boolean).join(" · "),
    blocks: content.sections.map((s) => ({ heading: t.has(`noteSections.${s.key}`) ? t(`noteSections.${s.key}`) : s.key, text: s.text })),
    footer: t("export.footer"),
  };
  const name = `note-${row.pseudonym}-${new Date(row.started_at).toISOString().slice(0, 10)}`;
  return format === "docx"
    ? fileResponse(await toDocx(doc), `${name}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    : fileResponse(await toPdf(doc), `${name}.pdf`, "application/pdf");
}
