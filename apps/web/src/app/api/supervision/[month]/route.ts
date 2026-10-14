import { NextResponse } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { withUser } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { fileResponse, toPdf } from "@/lib/export";
import { loadMonth } from "@/app/(app)/supervision/data";

export async function GET(_req: Request, ctx: RouteContext<"/api/supervision/[month]">) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { month } = await ctx.params;
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const data = await withUser(session.user.id, async (db) => {
    const d = await loadMonth(db, month);
    await audit(db, session.user.id, "supervision.export_pdf", "supervision_pack", month);
    return d;
  });
  const ai = data.pack?.content_json?.ai;
  if (!ai) return NextResponse.json({ error: "not_ready" }, { status: 404 });
  const t = await getTranslations();
  const f = await getFormatter();
  const monthLabel = f.dateTime(new Date(`${month}-01T12:00:00`), { month: "long", year: "numeric" });
  const selected = new Set<string>(data.pack.content_json.excerpts ?? []);
  const label = { strengths: t("review.strengths"), missed_openings: t("review.openings"), try_next: t("review.tryNext") } as Record<string, string>;
  const moments = data.moments.filter((m) => selected.has(m.key))
    .map((m) => `• ${m.pseudonym}, ${f.dateTime(new Date(m.date), { dateStyle: "medium" })} — ${label[m.kind]}: ${m.text}\n   “${m.quote}”`).join("\n\n");
  const clientHours = data.hours.client_seconds / 3600;
  const supHours = data.supervisionMinutes / 60;
  const hoursText = [
    `${t("supervision.clientHours")}: ${clientHours.toFixed(1)} (${t("supervision.sessionsCount", { count: data.hours.sessions })})`,
    `${t("supervision.supervisionHours")}: ${supHours.toFixed(1)}`,
    `${t("supervision.ratio")}: ${supHours > 0 ? `1:${(clientHours / supHours).toFixed(1)}` : "—"}`,
    ...data.supervision.map((h) => `${f.dateTime(new Date(h.occurred_on), { dateStyle: "medium" })} — ${h.minutes} min, ${t(`supervision.kind_${h.kind}`)}${h.supervisor ? `, ${h.supervisor}` : ""}`),
  ].join("\n");
  const pdf = await toPdf({
    title: t("supervision.packTitle", { month: monthLabel }),
    subtitle: t("supervision.pdfSubtitle"),
    blocks: [
      { heading: t("supervision.summary"), text: [ai.overview, ...ai.clients.map((c: { pseudonym: string; summary: string }) => `${c.pseudonym}: ${c.summary}`)].join("\n\n") },
      { heading: t("supervision.excerpts"), text: moments || "—" },
      { heading: t("supervision.growth"), text: ai.growth_themes.map((g: string) => `• ${g}`).join("\n") },
      { heading: t("supervision.questions"), text: ai.questions_for_supervision.map((g: string) => `• ${g}`).join("\n") },
      { heading: t("supervision.hoursLog"), text: hoursText },
    ],
    footer: t("export.footer"),
  });
  return fileResponse(pdf, `supervision-pack-${month}.pdf`, "application/pdf");
}
