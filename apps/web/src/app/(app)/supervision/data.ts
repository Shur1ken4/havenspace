import "server-only";
import type { Db } from "@/lib/db";

export type Moment = { key: string; session_id: string; pseudonym: string; date: string; kind: string; text: string; quote: string };

/** Everything the supervision page and its PDF need for one month. */
export async function loadMonth(db: Db, month: string) {
  const start = `${month}-01`;
  const { rows: [hours] } = await db.query(
    `select coalesce(sum(duration_seconds) filter (where status = 'ready'), 0)::int as client_seconds,
            count(*) filter (where status = 'ready')::int as sessions,
            count(distinct client_id) filter (where status = 'ready')::int as clients
       from sessions where started_at >= $1::date and started_at < $1::date + interval '1 month'`, [start],
  );
  const supervision = (await db.query(
    `select id, occurred_on, minutes, kind, supervisor from supervision_hours
      where occurred_on >= $1::date and occurred_on < $1::date + interval '1 month' order by occurred_on`, [start],
  )).rows;
  const pack = (await db.query(
    `select p.status, p.content_json, p.updated_at,
            exists (select 1 from jobs j where j.kind = 'supervision_pack' and j.status in ('queued','running')
                     and j.payload->>'pack_id' = p.id::text) as building
       from supervision_packs p where p.month = $1::date`, [start],
  )).rows[0] ?? null;
  const refl = (await db.query(
    `select r.session_id, r.content_json, c.pseudonym, s.started_at
       from reflections r join sessions s on s.id = r.session_id join clients c on c.id = s.client_id
      where s.started_at >= $1::date and s.started_at < $1::date + interval '1 month' order by s.started_at`, [start],
  )).rows;
  const moments: Moment[] = [];
  for (const r of refl) {
    for (const kind of ["strengths", "missed_openings", "try_next"] as const) {
      (r.content_json[kind] ?? []).forEach((it: { text: string; quote: string }, i: number) => moments.push({
        key: `${r.session_id}:${kind}:${i}`, session_id: r.session_id, pseudonym: r.pseudonym,
        date: new Date(r.started_at).toISOString(), kind, text: it.text, quote: it.quote,
      }));
    }
  }
  const supervisionMinutes = supervision.reduce((a, h) => a + h.minutes, 0);
  return { hours, supervision, supervisionMinutes, pack, moments };
}
