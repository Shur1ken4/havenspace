"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withUser } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";

const month = z.string().regex(/^\d{4}-\d{2}$/);

export async function buildPack(m: string) {
  const session = await requireUser();
  month.parse(m);
  await withUser(session.user.id, async (db) => {
    const { rows: [p] } = await db.query(
      `insert into supervision_packs (therapist_id, month, status) values ($1, ($2 || '-01')::date, 'draft')
       on conflict (therapist_id, month) do update set status = 'draft' returning id`,
      [session.user.id, m],
    );
    await db.query("insert into jobs (therapist_id, kind, payload) values ($1, 'supervision_pack', $2)", [session.user.id, { pack_id: p.id }]);
    await audit(db, session.user.id, "supervision.build", "supervision_pack", p.id);
  });
  revalidatePath("/supervision");
}

export async function saveExcerpts(m: string, excerpts: string[]) {
  const session = await requireUser();
  month.parse(m);
  const clean = z.array(z.string().max(80)).max(30).parse(excerpts);
  await withUser(session.user.id, (db) => db.query(
    `insert into supervision_packs (therapist_id, month, content_json) values ($1, ($2 || '-01')::date, $3)
     on conflict (therapist_id, month) do update set content_json = supervision_packs.content_json || $3`,
    [session.user.id, m, { excerpts: clean }],
  ));
  revalidatePath("/supervision");
}

const hoursSchema = z.object({
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.coerce.number().int().min(5).max(600),
  kind: z.enum(["individual", "group"]),
  supervisor: z.string().trim().max(20),
});

export async function addHours(form: FormData) {
  const session = await requireUser();
  const d = hoursSchema.parse({ occurredOn: form.get("occurredOn"), minutes: form.get("minutes"), kind: form.get("kind"), supervisor: form.get("supervisor") });
  await withUser(session.user.id, (db) => db.query(
    "insert into supervision_hours (therapist_id, occurred_on, minutes, kind, supervisor) values ($1, $2, $3, $4, $5)",
    [session.user.id, d.occurredOn, d.minutes, d.kind, d.supervisor],
  ));
  revalidatePath("/supervision");
}

export async function removeHours(id: string) {
  const session = await requireUser();
  z.uuid().parse(id);
  await withUser(session.user.id, (db) => db.query("delete from supervision_hours where id = $1", [id]));
  revalidatePath("/supervision");
}
